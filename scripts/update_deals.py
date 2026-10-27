#!/usr/bin/env python3
"""Refresh factual Harbor Freight offers from its public coupon-site REST API.

The retailer advertises this WordPress API and uses it on its own coupon home
page. This client performs ordinary unauthenticated GETs. It does not solve
challenges, impersonate a browser, fetch private account data, or mirror artwork.
Only already-audited catalog entries become eligible tool recommendations.
"""
from __future__ import annotations

import argparse
import copy
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from email.utils import format_datetime
from html import unescape
from html.parser import HTMLParser
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]
API = "https://go.harborfreight.com/wp-json/wp/v2/posts"
SOURCE = "https://go.harborfreight.com/"
SITE_URL = "https://sfmth.github.io/harbor-mechanic-tool-deals/"
PACIFIC = ZoneInfo("America/Los_Angeles")
UTC = timezone.utc
SCHEMA_VERSION = 1
ITC_CATEGORY = 12678
NO_CODE = {"", "0", "10000000", "100000000"}
FIELDS = "id,date,modified,link,title,content,categories,acf"
USER_AGENT = (
    "HarborMechanicToolDeals/1.0 "
    "(+https://github.com/sfmth/harbor-mechanic-tool-deals)"
)


class RefreshError(Exception):
    """A source or validation failure that must not erase valid saved offers."""


class TextParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []

    def handle_data(self, value):
        self.parts.append(value)


class CatalogParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.inside = False
        self.parts = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script" and attrs.get("id") == "catalog-data":
            self.inside = True

    def handle_endtag(self, tag):
        if tag == "script":
            self.inside = False

    def handle_data(self, value):
        if self.inside:
            self.parts.append(value)


def plain_text(value):
    parser = TextParser()
    parser.feed(str(value or ""))
    return " ".join(unescape(" ".join(parser.parts)).split())


def timestamp(now):
    if now.tzinfo is None:
        raise ValueError("An aware timestamp is required")
    return now.astimezone(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def parse_source_date(value, field):
    try:
        return datetime.strptime(str(value), "%m/%d/%Y").date()
    except (ValueError, TypeError) as exc:
        raise RefreshError(f"Invalid {field} date") from exc


def is_active(offer, now):
    """End dates are inclusive in the retailer's published Pacific timezone."""
    today = now.astimezone(PACIFIC).date()
    try:
        return date.fromisoformat(offer["starts_on"]) <= today <= date.fromisoformat(offer["ends_on"])
    except (KeyError, ValueError, TypeError):
        return False


def money(value, *, optional=False):
    value = str(value or "").strip()
    if not value and optional:
        return None
    match = re.fullmatch(r"\$\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)", value)
    if not match:
        if optional:
            return None
        raise RefreshError("Invalid monetary value")
    try:
        amount = Decimal(match.group(1).replace(",", ""))
    except InvalidOperation as exc:
        raise RefreshError("Invalid monetary value") from exc
    if not amount.is_finite() or amount < 0 or amount > 1_000_000:
        raise RefreshError("Monetary value is outside the accepted range")
    return float(amount)


def savings_percent(value):
    value = str(value or "").strip()
    if not value:
        return None
    match = re.fullmatch(r"(\d+(?:\.\d+)?)\s*%", value)
    if not match or not 0 <= float(match.group(1)) <= 100:
        raise RefreshError("Invalid retailer savings percentage")
    return float(match.group(1))


def sku_list(value):
    """The official ACF skus field explicitly lists eligible SKU aliases."""
    raw = str(value or "").strip()
    if not raw or raw == "0":
        return []
    if not re.fullmatch(r"\d{1,6}(?:\s*[/,;]\s*\d{1,6})*", raw):
        raise RefreshError("Invalid eligible SKU list")
    skus = [str(int(sku)) for sku in re.findall(r"\d{1,6}", raw)]
    if "0" in skus:
        raise RefreshError("Zero is not an eligible product SKU")
    return list(dict.fromkeys(skus))


def load_catalog(path):
    parser = CatalogParser()
    parser.feed(Path(path).read_text())
    try:
        rows = json.loads("".join(parser.parts))
    except (ValueError, TypeError) as exc:
        raise RefreshError("Catalog JSON could not be read") from exc
    if not isinstance(rows, list) or not rows:
        raise RefreshError("The audited catalog is empty or malformed")
    return catalog_index(rows)


def catalog_index(rows):
    """Use exact IDs and explicit audited spec aliases, never fuzzy names."""
    index = {}
    for row in rows:
        canonical = str(row["Item Number"])
        aliases = re.findall(r"\b\d{1,6}\b", str(row.get("_enrichment", {}).get("specs", {}).get("SKU(s)", "")))
        lookup_canonical = str(int(canonical))
        for sku in dict.fromkeys([lookup_canonical] + [str(int(alias)) for alias in aliases]):
            match = {
                "sku": sku,
                "catalog_sku": canonical,
                "included": row.get("_included") is True,
                "size_review_status": row.get("Size Review Status", "Size coverage unverified"),
                "product": str(row.get("Product", "")),
                "match_type": "exact" if sku == lookup_canonical else "audited_alias",
            }
            index.setdefault(sku, []).append(match)
    return index


def catalog_matches(skus, catalog):
    matches = []
    for sku in skus:
        candidates = catalog.get(sku, [])
        # A directly audited SKU takes precedence over a broad specification alias.
        exact = [match for match in candidates if match["match_type"] == "exact"]
        matches.extend(copy.deepcopy(exact or candidates))
    return matches


def official_link(value):
    parsed = urllib.parse.urlparse(str(value or ""))
    if parsed.scheme != "https" or parsed.netloc != "go.harborfreight.com":
        raise RefreshError("Unexpected offer source URL")
    return parsed.geturl()


def event_map(posts):
    result = {}
    for post in posts:
        acf = post.get("acf")
        if not isinstance(acf, dict):
            raise RefreshError("Event ACF schema is missing")
        event_id = str(acf.get("pma_event_index") or "")
        if not event_id:
            continue
        result[event_id] = {
            "id": event_id,
            "title": plain_text(post.get("title", {}).get("rendered")),
            "source_url": official_link(post.get("link")),
            "starts_on": parse_source_date(acf.get("startdate"), "event start").isoformat(),
            "ends_on": parse_source_date(acf.get("enddate"), "event end").isoformat(),
        }
    return result


def normalize_offer(post, events, catalog):
    if not isinstance(post, dict) or not isinstance(post.get("acf"), dict):
        raise RefreshError("Offer ACF schema is missing")
    acf = post["acf"]
    post_id = post.get("id")
    if not isinstance(post_id, int) or isinstance(post_id, bool) or post_id <= 0:
        raise RefreshError("Offer ID is invalid")
    categories = post.get("categories")
    if not isinstance(categories, list) or not all(isinstance(x, int) for x in categories):
        raise RefreshError("Offer membership categories are missing")
    if 1 not in categories:
        raise RefreshError("Offer is missing the expected coupon category")
    if 1518 in categories:
        raise RefreshError("Expired-category post appeared in the current feed")
    title = plain_text(post.get("title", {}).get("rendered"))
    if not title:
        raise RefreshError("Offer title is missing")
    start = parse_source_date(acf.get("startdate"), "start")
    end = parse_source_date(acf.get("enddate"), "end")
    if start > end:
        raise RefreshError("Offer ends before it starts")
    source_sku = str(acf.get("sku") or "").strip()
    representative = source_sku
    skus = sku_list(acf.get("skus"))
    if representative not in {"", "0"}:
        if not re.fullmatch(r"\d{1,6}", representative):
            raise RefreshError("Representative SKU is invalid")
        representative = str(int(representative))
        if representative == "0":
            raise RefreshError("Zero is not a product SKU")
        skus = list(dict.fromkeys([representative] + skus))
    price = money(acf.get("couponvalue"), optional=True)
    title_price = re.search(r"\sfor\s+(\$[\d,]+(?:\.\d{1,2})?)\s*$", title, re.I)
    if title_price and price is not None and money(title_price.group(1)) != price:
        raise RefreshError(f"Offer {post_id} has conflicting structured and title prices")
    # A monetary product offer with a broken structured price is a failed schema,
    # not a zero-dollar deal or a silently discarded record.
    if skus and title_price and price is None:
        raise RefreshError(f"Offer {post_id} has no valid structured product price")
    code = str(acf.get("couponcode") or "").strip()
    if code not in NO_CODE and not re.fullmatch(r"\d{4,20}", code):
        raise RefreshError("Coupon code is invalid")
    code = None if code in NO_CODE else code
    member = ITC_CATEGORY in categories
    event_id = str(acf.get("pma_event_index") or "")
    if not event_id:
        raise RefreshError("Offer event identity is missing")
    event = events.get(event_id, {})
    exact_price = bool(skus) and price is not None and str(acf.get("coupontype") or "") == "Product Coupon"
    if not exact_price:
        kind = "conditional"
    elif member:
        kind = "member_deal"
    elif code:
        kind = "coupon"
    elif "instant savings" in event.get("title", "").lower():
        kind = "instant_savings"
    else:
        kind = "sale"
    text = plain_text(post.get("content", {}).get("rendered"))
    words = text.split()
    channels = []
    if re.search(r"valid in[- ]store and online", text, re.I):
        channels = ["in_store", "online"]
    elif re.search(r"valid in[- ]store", text, re.I):
        channels = ["in_store"]
    matches = catalog_matches(skus, catalog)
    safe = {"No skipped standard sizes found", "Size continuity not applicable"}
    eligible = sorted({m["catalog_sku"] for m in matches if m["included"] and m["size_review_status"] in safe})
    return {
        "id": str(post_id),
        "event_id": event_id,
        "event_title": event.get("title", ""),
        "title": title,
        "sku": representative if representative not in {"", "0"} else None,
        "skus": skus,
        "source_sku": source_sku,
        "source_skus": str(acf.get("skus") or ""),
        "price": price if exact_price else None,
        "coupon_code": code,
        "starts_on": start.isoformat(),
        "ends_on": end.isoformat(),
        "membership_required": member,
        "kind": kind,
        "retailer_savings_dollars": money(acf.get("savings_dollar"), optional=True),
        "retailer_savings_percent": savings_percent(acf.get("savings_percent")),
        "savings_basis": "Retailer-reported savings; not independently observed price history",
        "source_url": official_link(post.get("link")),
        "source_modified": str(post.get("modified") or ""),
        "redemption_channels": channels,
        "conditions_excerpt": " ".join(words[:24]) + ("…" if len(words) > 24 else ""),
        "conditions_complete": False,
        "requires_terms_review": not exact_price,
        "catalog_matches": matches,
        "eligible_catalog_skus": eligible,
        "unreviewed_skus": [sku for sku in skus if sku not in catalog],
    }


def request_json(url, timeout=25):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            if response.status != 200 or "application/json" not in response.headers.get("Content-Type", ""):
                raise RefreshError("Official source did not return JSON")
            raw = response.read(12_000_001)
            if len(raw) > 12_000_000:
                raise RefreshError("Official source response exceeded the size limit")
            return json.loads(raw), dict(response.headers)
    except urllib.error.HTTPError as exc:
        # Stop on challenges/rate limiting. Do not rotate identities or bypass it.
        raise RefreshError(f"Official source returned HTTP {exc.code}") from exc
    except (urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
        raise RefreshError(f"Official source request failed ({type(exc).__name__})") from exc


def fetch_posts(category, requester=request_json, max_pages=50):
    records = []
    expected_total = expected_pages = None
    for page in range(1, max_pages + 1):
        params = urllib.parse.urlencode({
            "categories": category, "categories_exclude": 1518,
            "per_page": 100, "page": page, "_fields": FIELDS,
        })
        rows, headers = requester(API + "?" + params)
        headers = {key.lower(): value for key, value in headers.items()}
        try:
            total = int(headers["x-wp-total"])
            pages = int(headers["x-wp-totalpages"])
        except (KeyError, ValueError, TypeError) as exc:
            raise RefreshError("Official pagination headers are missing") from exc
        if not isinstance(rows, list) or total < 0 or pages < 0 or pages > max_pages:
            raise RefreshError("Official pagination schema is invalid")
        if expected_total is None:
            expected_total, expected_pages = total, pages
        elif (total, pages) != (expected_total, expected_pages):
            raise RefreshError("Official feed changed during pagination; retry next refresh")
        if len(rows) > 100 or (page < pages and len(rows) != 100):
            raise RefreshError("Official feed contains an incomplete page")
        records.extend(rows)
        if page >= pages:
            break
    ids = [row.get("id") for row in records if isinstance(row, dict)]
    if len(records) != expected_total or len(ids) != len(records) or len(set(ids)) != len(ids):
        raise RefreshError("Official feed totals or unique post identities do not match")
    return records, {"posts": len(records), "pages": expected_pages}


def empty_history(now):
    return {"schema_version": SCHEMA_VERSION, "tracking_started_at": timestamp(now), "updated_at": timestamp(now), "observations": []}


def update_history(history, offers, now):
    result = copy.deepcopy(history or empty_history(now))
    if result.get("schema_version") != SCHEMA_VERSION or not isinstance(result.get("observations"), list):
        raise RefreshError("Saved deal history has an unsupported schema")
    result["updated_at"] = timestamp(now)
    latest = {}
    for observation in result["observations"]:
        latest[(observation["offer_id"], observation["event_id"], observation["sku"])] = observation
    for offer in offers:
        for sku in offer["skus"]:
            identity = (offer["id"], offer["event_id"], sku)
            facts = {key: offer[key] for key in ["price", "membership_required", "starts_on", "ends_on", "coupon_code"]}
            previous = latest.get(identity)
            if previous and all(previous.get(key) == value for key, value in facts.items()):
                previous["last_seen_at"] = timestamp(now)
                continue
            observation = {
                "offer_id": offer["id"], "event_id": offer["event_id"], "sku": sku,
                **facts, "observed_at": timestamp(now), "last_seen_at": timestamp(now),
                "source_url": offer["source_url"],
                "price_type": "advertised_offer",
            }
            result["observations"].append(observation)
            latest[identity] = observation
    return result


def history_by_sku(history):
    """Compact observed offer history; eligibility tiers never share a baseline."""
    grouped = {}
    for observation in history["observations"]:
        grouped.setdefault(observation["sku"], []).append(observation)

    def summarize(observations):
        return {
            "lowest_observed_price": min((o["price"] for o in observations), default=None),
            "first_observed_at": min((o["observed_at"] for o in observations), default=None),
            "last_observed_at": max((o["last_seen_at"] for o in observations), default=None),
            "deal_episodes": len({(o["event_id"], o["price"], o["membership_required"]) for o in observations}),
            "observations_count": len(observations),
        }

    return {sku: {
        **summarize(observations),
        "public": summarize([o for o in observations if not o["membership_required"]]),
        "member": summarize([o for o in observations if o["membership_required"]]),
    } for sku, observations in sorted(grouped.items())}


def build_snapshot(posts, event_posts, catalog, now, source_counts):
    events = event_map(event_posts)
    normalized = []
    for post in posts:
        try:
            normalized.append(normalize_offer(post, events, catalog))
        except RefreshError as exc:
            identity = post.get("id", "unknown") if isinstance(post, dict) else "unknown"
            raise RefreshError(f"Offer {identity}: {exc}") from exc
    active = [offer for offer in normalized if is_active(offer, now)]
    exact = [offer for offer in active if offer["kind"] != "conditional"]
    conditionals = [offer for offer in active if offer["kind"] == "conditional"]
    candidates = [{
        "offer_id": offer["id"], "event_id": offer["event_id"],
        "title": offer["title"], "price": offer["price"],
        "membership_required": offer["membership_required"],
        "skus": offer["unreviewed_skus"], "source_url": offer["source_url"],
        "starts_on": offer["starts_on"], "ends_on": offer["ends_on"],
        "status": "requires_catalog_and_size_review",
        "automatic_recommendation_allowed": False,
    } for offer in exact if offer["unreviewed_skus"]]
    source_counts = {
        **source_counts, "active_exact_offers": len(exact), "active_conditional_offers": len(conditionals),
        "future_or_expired_posts": len(normalized) - len(active),
        "public_offers": sum(not offer["membership_required"] for offer in exact),
        "member_offers": sum(offer["membership_required"] for offer in exact),
        "matched_recommendable_offers": sum(bool(offer["eligible_catalog_skus"]) for offer in exact),
        "review_candidate_offers": len(candidates),
    }
    checked = timestamp(now)
    return {
        "schema_version": SCHEMA_VERSION,
        "last_checked": checked,
        "last_success": checked,
        "timezone": "America/Los_Angeles",
        "source_url": SOURCE,
        "source_description": "Official public Harbor Freight coupon-site WordPress feed",
        "coverage_note": "Advertised public and ITC coupon-site offers; not a guarantee of every local, clearance, personalized, or bundle promotion.",
        "refresh": {"status": "ok", "errors": [], "source_counts": source_counts},
        "events": [event for event in events.values() if is_active(event, now)],
        "public_offers": [offer for offer in exact if not offer["membership_required"]],
        "member_offers": [offer for offer in exact if offer["membership_required"]],
        "conditional_offers": conditionals,
        "review_candidates": candidates,
    }


def failure_snapshot(previous, now, error):
    result = copy.deepcopy(previous or {
        "schema_version": SCHEMA_VERSION, "last_success": None,
        "timezone": "America/Los_Angeles", "source_url": SOURCE,
        "public_offers": [], "member_offers": [], "conditional_offers": [],
        "review_candidates": [], "events": [],
    })
    result["last_checked"] = timestamp(now)
    result["refresh"] = {
        "status": "error", "errors": [str(error)],
        "source_counts": copy.deepcopy(result.get("refresh", {}).get("source_counts", {})),
    }
    # Preserve the last successful snapshot. Clients must test dates at display
    # time; the RSS below also excludes entries that have since expired.
    return result


def rss_text(snapshot, now):
    root = ET.Element("rss", version="2.0")
    channel = ET.SubElement(root, "channel")
    for key, value in {
        "title": "Harbor Mechanic Tool Deals",
        "link": SITE_URL,
        "description": "Advertised deals for the audited mechanic tool catalog. ITC eligibility is labelled. Prices exclude tax and shipping.",
        "language": "en-us", "ttl": "60",
        "lastBuildDate": format_datetime(now.astimezone(UTC), usegmt=True),
    }.items():
        ET.SubElement(channel, key).text = value
    offers = snapshot.get("public_offers", []) + snapshot.get("member_offers", [])
    offers = [o for o in offers if is_active(o, now) and o.get("eligible_catalog_skus") and isinstance(o.get("price"), (int, float)) and 0 < o["price"] <= 200]
    offers.sort(key=lambda o: (-(o.get("retailer_savings_percent") or 0), -(o.get("retailer_savings_dollars") or 0), o["id"]))
    for offer in offers:
        item = ET.SubElement(channel, "item")
        # A retailer coupon can cover both an accepted set and a set with gaps.
        # Name only the audited canonical items, rather than the shared coupon's
        # generic title or its first (potentially excluded) source SKU.
        eligible_skus = list(dict.fromkeys(str(sku) for sku in offer["eligible_catalog_skus"]))
        eligible_set = set(eligible_skus)
        names = {}
        for match in offer.get("catalog_matches", []):
            sku = str(match.get("catalog_sku") or match.get("sku") or "")
            if match.get("included") and sku in eligible_set and match.get("product"):
                names.setdefault(sku, plain_text(match["product"]))
        audited_items = [f"{names[sku]} (SKU {sku})" if names.get(sku) else f"SKU {sku}" for sku in eligible_skus]
        name = "; ".join(audited_items)
        prefix = "[ITC] " if offer["membership_required"] else ""
        ET.SubElement(item, "title").text = f"{prefix}{name} — ${offer['price']:.2f}"
        ET.SubElement(item, "link").text = offer["source_url"]
        key = json.dumps([offer["id"], offer["event_id"], offer["price"], offer["membership_required"], offer["starts_on"], offer["ends_on"]])
        guid = ET.SubElement(item, "guid", isPermaLink="false")
        guid.text = "urn:harbor-mechanic-tool-deals:" + hashlib.sha256(key.encode()).hexdigest()[:24]
        conditions = [f"${offer['price']:.2f}; valid through {offer['ends_on']} Pacific time."]
        conditions.append("Paid Inside Track Club membership required." if offer["membership_required"] else "Public offer.")
        conditions.append("Audited eligible catalog items: " + "; ".join(audited_items) + ".")
        other_variants = bool(offer.get("unreviewed_skus")) or any(
            not match.get("included") or str(match.get("catalog_sku") or match.get("sku") or "") not in eligible_set
            for match in offer.get("catalog_matches", [])
        )
        if other_variants:
            conditions.append("This retailer offer also covers other variants. For this catalog, choose only the audited eligible SKUs listed above; other variants are not audited eligible.")
        if offer.get("coupon_code"):
            conditions.append("Coupon code: " + offer["coupon_code"] + ".")
        if offer.get("retailer_savings_percent") is not None:
            conditions.append(f"Retailer-reported savings: {offer['retailer_savings_percent']:g}%.")
        conditions.append("Check the official offer for redemption terms and stock. This is not a historical-low claim.")
        if snapshot.get("refresh", {}).get("status") != "ok":
            conditions.append("Refresh failed; this is the last successful saved offer.")
        ET.SubElement(item, "description").text = " ".join(conditions)
    ET.indent(root, space="  ")
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding="unicode") + "\n"


def atomic_write(path, content):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, prefix="." + path.name, delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(content)
        os.replace(temporary, path)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def read_saved(path):
    if not Path(path).exists():
        return None
    try:
        result = json.loads(Path(path).read_text())
    except (OSError, ValueError) as exc:
        raise RefreshError(f"Saved {Path(path).name} could not be read") from exc
    if not isinstance(result, dict) or result.get("schema_version") != SCHEMA_VERSION:
        raise RefreshError(f"Saved {Path(path).name} has an unsupported schema")
    return result


def refresh(site=ROOT / "site", now=None, requester=request_json):
    now = now or datetime.now(UTC)
    site = Path(site)
    output = site / "data" / "deals.json"
    history_path = site / "data" / "deal-history.json"
    previous = read_saved(output)
    try:
        history = read_saved(history_path)
        catalog = load_catalog(site / "index.html")
        posts, coupon_counts = fetch_posts(1, requester=requester)
        if not posts:
            raise RefreshError("Official source returned no current offer posts; retaining the previous snapshot")
        events, event_counts = fetch_posts(1610, requester=requester)
        snapshot = build_snapshot(posts, events, catalog, now, {
            "coupon_posts": coupon_counts["posts"], "coupon_pages": coupon_counts["pages"],
            "event_posts": event_counts["posts"], "event_pages": event_counts["pages"],
        })
        all_exact = snapshot["public_offers"] + snapshot["member_offers"]
        next_history = update_history(history, all_exact, now)
        snapshot["history_tracking_started_at"] = next_history["tracking_started_at"]
        snapshot["history_note"] = "Observed advertised offer prices only, starting on the tracking date. No pre-tracking history or all-time-low claim. Public and member observations are separated."
        snapshot["history_by_sku"] = history_by_sku(next_history)
        atomic_write(history_path, json.dumps(next_history, ensure_ascii=False, indent=2) + "\n")
        atomic_write(output, json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n")
        atomic_write(site / "deals.xml", rss_text(snapshot, now))
        return snapshot, True
    except (RefreshError, OSError, ValueError, TypeError, KeyError, AttributeError) as exc:
        snapshot = failure_snapshot(previous, now, exc)
        atomic_write(output, json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n")
        atomic_write(site / "deals.xml", rss_text(snapshot, now))
        return snapshot, False


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site-dir", type=Path, default=ROOT / "site")
    args = parser.parse_args()
    try:
        snapshot, success = refresh(args.site_dir)
    except (RefreshError, OSError) as exc:
        print(json.dumps({"status": "error", "error": str(exc)}), file=sys.stderr)
        return 1
    print(json.dumps({
        "status": snapshot["refresh"]["status"], "last_checked": snapshot["last_checked"],
        "last_success": snapshot["last_success"], "source_counts": snapshot["refresh"]["source_counts"],
        "errors": snapshot["refresh"]["errors"],
    }, indent=2))
    return 0 if success else 1


if __name__ == "__main__":
    raise SystemExit(main())
