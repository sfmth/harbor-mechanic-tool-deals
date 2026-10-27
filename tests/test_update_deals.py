"""Behavioral coverage for price integrity, eligibility, dates and failed refreshes."""
import copy
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from urllib.parse import parse_qs, urlparse
import xml.etree.ElementTree as ET


MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "update_deals.py"
SPEC = importlib.util.spec_from_file_location("update_deals", MODULE_PATH)
deals = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(deals)
NOW = datetime(2026, 10, 26, 18, 0, tzinfo=timezone.utc)


def offer(**changes):
    result = {
        "id": 1001,
        "link": "https://go.harborfreight.com/coupons/2026/10/example-59527/",
        "title": {"rendered": "VIKING Jump Starter for $69.99"},
        "content": {"rendered": "<p>Valid in-store and online while supplies last. See the official offer for restrictions.</p>"},
        "modified": "2026-10-26T10:00:00",
        "categories": [1],
        "acf": {
            "sku": "59527", "skus": "59527/73333", "couponvalue": "$69.99 ",
            "couponcode": "79002523", "startdate": "10/26/2026", "enddate": "10/29/2026",
            "pma_event_index": "184885", "coupontype": "Product Coupon",
            "savings_dollar": "$20 ", "savings_percent": "22%",
        },
    }
    for key, value in changes.items():
        if key == "acf":
            result["acf"].update(value)
        else:
            result[key] = value
    return result


def catalog_rows():
    return [{
        "Item Number": "59527", "Product": "Jump Starter", "_included": True,
        "Size Review Status": "Size continuity not applicable",
        "_enrichment": {"specs": {"SKU(s)": "59527, 73333"}},
    }]


def normalized(**changes):
    return deals.normalize_offer(offer(**changes), {}, deals.catalog_index(catalog_rows()))


class OfferNormalizationTests(unittest.TestCase):
    def test_exact_price_aliases_and_audited_catalog_identity(self):
        result = normalized()
        self.assertEqual(result["price"], 69.99)
        self.assertEqual(result["skus"], ["59527", "73333"])
        self.assertEqual(result["eligible_catalog_skus"], ["59527"])
        self.assertEqual(result["catalog_matches"][1]["match_type"], "audited_alias")
        self.assertEqual(result["retailer_savings_dollars"], 20)
        self.assertEqual(result["redemption_channels"], ["in_store", "online"])
        self.assertNotIn("image", result)

    def test_member_category_is_required_not_inferred_from_sentinel(self):
        public = normalized(acf={"couponcode": "100000000"})
        member = normalized(categories=[1, 12678], acf={"couponcode": "100000000"})
        self.assertFalse(public["membership_required"])
        self.assertTrue(member["membership_required"])
        self.assertIsNone(public["coupon_code"])
        self.assertIsNone(member["coupon_code"])
        self.assertEqual(member["kind"], "member_deal")

    def test_official_short_and_zero_padded_item_ids_share_one_identity(self):
        source = offer(acf={"sku": "00996", "skus": "996/00996"})
        rows = [{"Item Number": "996", "Product": "Chain Hoist", "_included": True, "Size Review Status": "Size continuity not applicable"}]
        result = deals.normalize_offer(source, {}, deals.catalog_index(rows))
        self.assertEqual(result["sku"], "996")
        self.assertEqual(result["skus"], ["996"])
        self.assertEqual(result["source_sku"], "00996")
        self.assertEqual(result["eligible_catalog_skus"], ["996"])

    def test_conditional_bundle_never_becomes_exact_zero_price_deal(self):
        result = normalized(
            title={"rendered": "Buy a CHIEF Air Hammer, Get a Chisel Set FREE"},
            acf={"sku": "0", "skus": "", "couponvalue": "", "couponcode": "100000000", "coupontype": "Percentage Off"},
        )
        self.assertEqual(result["kind"], "conditional")
        self.assertIsNone(result["price"])
        self.assertEqual(result["skus"], [])
        self.assertTrue(result["requires_terms_review"])
        self.assertTrue(result["source_url"].startswith("https://go.harborfreight.com/"))

    def test_conflicting_price_or_bad_dates_fails_instead_of_guessing(self):
        for change in [{"couponvalue": "$49.99"}, {"couponvalue": "garbled"}, {"enddate": "10/20/2026"}]:
            with self.subTest(change=change), self.assertRaises(deals.RefreshError):
                normalized(acf=change)

    def test_inclusive_pacific_day_and_winter_offset(self):
        result = normalized()
        self.assertTrue(deals.is_active(result, datetime(2026, 10, 30, 6, 59, tzinfo=timezone.utc)))
        self.assertFalse(deals.is_active(result, datetime(2026, 10, 30, 7, 0, tzinfo=timezone.utc)))
        winter = {**result, "starts_on": "2026-11-02", "ends_on": "2026-11-02"}
        self.assertTrue(deals.is_active(winter, datetime(2026, 11, 3, 7, 59, tzinfo=timezone.utc)))
        self.assertFalse(deals.is_active(winter, datetime(2026, 11, 3, 8, 0, tzinfo=timezone.utc)))
        self.assertFalse(deals.is_active(result, datetime(2026, 10, 26, 6, 59, tzinfo=timezone.utc)))

    def test_unknown_and_explicit_size_exclusion_cannot_gain_eligibility_from_alias(self):
        rows = catalog_rows() + [{
            "Item Number": "73333", "Product": "Excluded Set", "_included": False,
            "Size Review Status": "Confirmed size gaps",
        }]
        source = offer(acf={"sku": "73333", "skus": "73333"})
        excluded = deals.normalize_offer(source, {}, deals.catalog_index(rows))
        self.assertEqual(excluded["eligible_catalog_skus"], [])
        self.assertFalse(excluded["catalog_matches"][0]["included"])
        unknown = normalized(acf={"sku": "99999", "skus": "99999"})
        self.assertEqual(unknown["unreviewed_skus"], ["99999"])
        self.assertEqual(unknown["eligible_catalog_skus"], [])

    def test_snapshot_separates_members_filters_dates_and_retains_review_candidates(self):
        public = offer()
        member = offer(id=1002, categories=[1, 12678], acf={"sku": "99999", "skus": "99999"})
        expired = offer(id=1003, acf={"startdate": "10/1/2026", "enddate": "10/25/2026"})
        future = offer(id=1004, acf={"startdate": "10/27/2026"})
        result = deals.build_snapshot([public, member, expired, future], [], deals.catalog_index(catalog_rows()), NOW, {})
        self.assertEqual(len(result["public_offers"]), 1)
        self.assertEqual(len(result["member_offers"]), 1)
        self.assertEqual(result["refresh"]["source_counts"]["future_or_expired_posts"], 2)
        self.assertFalse(result["review_candidates"][0]["automatic_recommendation_allowed"])


class PaginationTests(unittest.TestCase):
    def requester(self, mode="ok"):
        def request(url):
            page = int(parse_qs(urlparse(url).query)["page"][0])
            rows = [{"id": i} for i in range(1, 101)] if page == 1 else [{"id": 101}]
            if mode == "duplicate" and page == 2:
                rows = [{"id": 100}]
            total = "102" if mode == "changed" and page == 2 else "101"
            return rows, {"X-WP-Total": total, "X-WP-TotalPages": "2"}
        return request

    def test_every_page_is_fetched_and_counted(self):
        rows, counts = deals.fetch_posts(1, self.requester())
        self.assertEqual(len(rows), 101)
        self.assertEqual(counts, {"posts": 101, "pages": 2})

    def test_duplicates_and_changing_source_are_rejected(self):
        for mode in ["duplicate", "changed"]:
            with self.subTest(mode=mode), self.assertRaises(deals.RefreshError):
                deals.fetch_posts(1, self.requester(mode))


class HistoryTests(unittest.TestCase):
    def test_identical_refresh_is_not_a_new_episode_and_price_reversion_is_recorded(self):
        first = normalized()
        history = deals.update_history(None, [first], NOW)
        later = datetime(2026, 10, 26, 19, 0, tzinfo=timezone.utc)
        history = deals.update_history(history, [first], later)
        self.assertEqual(len(history["observations"]), 2)  # two explicitly eligible aliases
        self.assertEqual(history["observations"][0]["observed_at"], deals.timestamp(NOW))
        self.assertEqual(history["observations"][0]["last_seen_at"], deals.timestamp(later))
        changed = {**first, "price": 59.99}
        history = deals.update_history(history, [changed], later)
        history = deals.update_history(history, [first], later)
        self.assertEqual(len(history["observations"]), 6)
        summary = deals.history_by_sku(history)["59527"]
        self.assertEqual(summary["public"]["lowest_observed_price"], 59.99)
        self.assertEqual(summary["public"]["deal_episodes"], 2)
        self.assertEqual(summary["public"]["observations_count"], 3)
        self.assertIsNone(summary["member"]["lowest_observed_price"])

    def test_public_and_member_baselines_do_not_mix(self):
        public = normalized()
        member = {**public, "id": "1002", "price": 49.99, "membership_required": True}
        history = deals.update_history(None, [public, member], NOW)
        result = deals.history_by_sku(history)["59527"]
        self.assertEqual(result["lowest_observed_price"], 49.99)
        self.assertEqual(result["public"]["lowest_observed_price"], 69.99)
        self.assertEqual(result["member"]["lowest_observed_price"], 49.99)
        self.assertEqual(result["first_observed_at"], deals.timestamp(NOW))


class PersistenceAndRssTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.site = Path(self.temporary.name)
        (self.site / "index.html").write_text('<script id="catalog-data" type="application/json">' + json.dumps(catalog_rows()) + '</script>')

    def requester(self, url):
        category = parse_qs(urlparse(url).query)["categories"][0]
        rows = [offer()] if category == "1" else []
        return rows, {"x-wp-total": str(len(rows)), "x-wp-totalpages": "1" if rows else "0"}

    def test_failed_request_preserves_last_good_prices_history_and_success_timestamp(self):
        good, success = deals.refresh(self.site, NOW, self.requester)
        self.assertTrue(success)
        history_before = (self.site / "data" / "deal-history.json").read_bytes()

        def blocked(url):
            raise deals.RefreshError("Official source returned HTTP 403")

        later = datetime(2026, 10, 26, 19, 0, tzinfo=timezone.utc)
        failed, success = deals.refresh(self.site, later, blocked)
        self.assertFalse(success)
        self.assertEqual(failed["refresh"]["status"], "error")
        self.assertEqual(failed["last_success"], good["last_success"])
        self.assertEqual(failed["public_offers"], good["public_offers"])
        self.assertEqual(failed["history_by_sku"], good["history_by_sku"])
        self.assertEqual((self.site / "data" / "deal-history.json").read_bytes(), history_before)
        self.assertNotEqual(failed["last_checked"], good["last_checked"])

    def test_invalid_new_payload_does_not_replace_previous_good_offer(self):
        good, _ = deals.refresh(self.site, NOW, self.requester)

        def bad(url):
            rows, headers = self.requester(url)
            if rows:
                rows[0]["acf"]["enddate"] = "not-a-date"
            return rows, headers

        failed, success = deals.refresh(self.site, NOW, bad)
        self.assertFalse(success)
        self.assertEqual(failed["public_offers"], good["public_offers"])

    def test_rss_excludes_unknown_size_excluded_over_budget_and_expired(self):
        included = normalized()
        member = {**included, "id": "1002", "membership_required": True}
        unknown = {**included, "id": "1003", "eligible_catalog_skus": []}
        expensive = {**included, "id": "1004", "price": 201}
        expired = {**included, "id": "1005", "ends_on": "2026-10-25"}
        snapshot = {"public_offers": [included, unknown, expensive, expired], "member_offers": [member], "refresh": {"status": "ok"}}
        root = ET.fromstring(deals.rss_text(snapshot, NOW))
        items = root.findall("channel/item")
        self.assertEqual(len(items), 2)
        self.assertTrue(any(item.findtext("title").startswith("[ITC]") for item in items))
        self.assertTrue(all("not a historical-low claim" in item.findtext("description") for item in items))
        self.assertEqual(len({item.findtext("guid") for item in items}), 2)

    def test_rss_shared_coupon_names_only_the_accepted_canonical_variant(self):
        rows = [
            {"Item Number": "64215", "Product": "3/8 in. Drive SAE Chrome Deep Socket Set, 10-Piece", "_included": True,
             "Size Review Status": "No skipped standard sizes found"},
            {"Item Number": "64216", "Product": "Metric socket set with size gaps", "_included": False,
             "Size Review Status": "Confirmed size gaps"},
        ]
        source = offer(
            title={"rendered": "QUINN Chrome Deep Socket Set, 10-Piece for $9.99"},
            acf={"sku": "64216", "skus": "64216/64215/99999", "couponvalue": "$9.99"},
        )
        mixed = deals.normalize_offer(source, {}, deals.catalog_index(rows))
        self.assertEqual(mixed["eligible_catalog_skus"], ["64215"])
        snapshot = {"public_offers": [mixed], "member_offers": [], "refresh": {"status": "ok"}}
        item = ET.fromstring(deals.rss_text(snapshot, NOW)).find("channel/item")
        title, description = item.findtext("title"), item.findtext("description")
        for text in [title, description]:
            self.assertIn("3/8 in. Drive SAE Chrome Deep Socket Set, 10-Piece (SKU 64215)", text)
            self.assertNotIn("64216", text)
            self.assertNotIn("99999", text)
            self.assertNotIn("Metric socket set with size gaps", text)
        self.assertIn("choose only the audited eligible SKUs listed above", description)
        self.assertIn("other variants are not audited eligible", description)
        self.assertIn("$9.99", title)
        self.assertEqual(item.findtext("link"), mixed["source_url"])

    def test_rss_documented_aliases_display_one_canonical_item_without_false_variant_warning(self):
        included = normalized()
        snapshot = {"public_offers": [included], "member_offers": [], "refresh": {"status": "ok"}}
        item = ET.fromstring(deals.rss_text(snapshot, NOW)).find("channel/item")
        self.assertIn("Jump Starter (SKU 59527)", item.findtext("title"))
        self.assertNotIn("73333", item.findtext("title"))
        self.assertNotIn("other variants", item.findtext("description"))


if __name__ == "__main__":
    unittest.main()
