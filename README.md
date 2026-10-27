# Harbor Mechanic Tool Deals

Build a mechanic's tool collection over time by finding active Harbor Freight offers, avoiding tools you already cover, and planning purchases within a monthly budget. Qualifying recommendations stay at **$200 or less per item**, before tax and shipping.

**[Open the website](https://sfmth.github.io/harbor-mechanic-tool-deals/)** · **[Subscribe by RSS](https://sfmth.github.io/harbor-mechanic-tool-deals/deals.xml)**

## Start your buying plan

1. Open **Budget & shopping settings** and enter an optional monthly budget. Enable Inside Track Club pricing only if you have that membership. Public and member prices remain separate on product cards.
2. In **My tools**, add products you already own, enter socket or wrench sets from any brand, or select an explicit **I am set for…** family rule. The default hides covered products.
3. Choose **Build my collection · avoid overlap** for suggestions across remaining tool needs, or **Only my wish list / Want to buy** to limit suggestions to saved products and products marked **Want to buy**.
4. Review the suggested buying list, its price and coverage explanations, and the official offer's code, dates and restrictions. Suggestions consider advertised savings and the prices this tracker has actually observed; they do not predict the lowest future price or judge tool quality.
5. After buying a tool, use **Record purchase** and enter the actual unit price, quantity and date. This adds it to your owned tools and deducts the logged spend from that Pacific calendar month's budget.

The site creates a shopping plan; purchases still happen with the retailer. A blank monthly budget leaves the plan uncapped in total, while a zero budget produces no proposed spend. Logged purchases determine the remaining budget. Tax and shipping are not estimated automatically.

## Owned tools and coverage

Exact product ownership suppresses that product. An explicit whole-family rule, such as **I am set for sockets**, hides that family until you remove the rule. Use this broad option when you deliberately want to stop considering the entire category.

For more precise coverage, manual socket and wrench entries accept an explicit list of sizes and the relevant profiles. Socket matching distinguishes metric/SAE, drive size, depth, impact use, point count and profile. Wrench matching distinguishes the applicable wrench styles and other relevant properties. Compatible owned sets can combine their verified coverage across brands. Partial overlap stays visible with an explanation of what the candidate adds; uncertain contents or profiles stay visible for review.

**I own this** records existing ownership without inventing a purchase price. **Record purchase** records ownership and spending together. Manage owned entries and family rules in **My tools**; purchase records are managed in **History & alerts**. Removing a purchase log entry does not imply that you no longer own the tool.

## Automatic offer updates

The GitHub Actions workflow is scheduled **hourly, at minute 17**, and also runs on pushes to `main` and manual dispatch. It reads ordinary public JSON from the official [Harbor Freight coupon site](https://go.harborfreight.com/), whose own homepage advertises and uses the WordPress REST feed. The updater follows all reported pages, validates counts and unique offer IDs, and saves factual SKU, price, code, eligibility and date information. It does not use Harbor Freight account credentials, solve verification challenges, or mirror coupon artwork.

The initial October 26, 2026 seed contained **370 exact active offers: 173 public and 197 member**, plus **2 conditional promotions**. Counts change with subsequent refreshes. Public and member offers are separate; discounts are not automatically stacked. Start and expiry dates are checked in **America/Los_Angeles**, including daylight saving time, and an offer remains eligible through its stated end date.

An offer becomes a recommendation only when its exact SKU or an explicitly documented alias matches an included, size-reviewed catalog entry. Unknown tools and variants appear under additional offers needing catalog/size review. Generic percentage discounts, bundles and other offers without a verified exact product price remain conditional promotions. They are not silently converted into automatic product recommendations.

The official feed is an accessible source used by the retailer's interface, rather than a guaranteed third-party service. It does not establish complete coverage of personalized coupons, local open-box prices, every clearance markdown, or every event/bundle offer. Store stock and store-specific prices are not checked. Use the official offer to verify redemption restrictions and availability.

The browser checks the **published feed every 15 minutes while open**, and when returning to the page. **Check published updates** reloads that saved feed; it does not run the source-fetching workflow itself. If a source request, pagination check or schema check fails, the last successful offer snapshot and price history are preserved and the site shows refresh health and the actual last successful check. Expired saved offers still fail the date checks. A later scheduled or manual run retries the refresh.

GitHub's scheduler can [delay or drop scheduled runs during high load](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows). Public-repository schedules can also be [disabled after 60 days without repository activity](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows). To refresh manually, open **Actions → Deploy GitHub Pages → Run workflow → main**. Re-enable the workflow there if it was disabled, and inspect its latest run and the site's refresh timestamp if updates appear stale.

## Observed price history

Tracking began on **October 26, 2026 Pacific time** (`2026-10-27T00:41:24Z`). History records advertised offer prices when this project sees them, with separate public and member summaries. It does not reconstruct prices before tracking began or continuously observe a product's regular price between offers.

**Lowest observed** means the lowest eligible offer price recorded by this tracker for that price tier. It is not an all-time low. Identical hourly checks update the last-seen timestamp rather than inventing another sale episode. Episode counts use distinct recorded event/price combinations, and actual price changes remain in the observation log. Retailer-advertised savings are labelled separately; a competitor **Compare To** price is not treated as Harbor Freight's historical regular price.

## Alerts, location and private data

Enable deal alerts and choose a minimum advertised savings percentage in shopping settings. Matching alerts use your buying mode, wish list, ownership and membership settings. On-site alerts and optional browser notifications run **while this page is open**; this version does not provide background push, email or SMS delivery.

The [RSS feed](https://sfmth.github.io/harbor-mechanic-tool-deals/deals.xml) contains qualifying offers for the shared audited catalog, including clearly labelled ITC offers and the audited eligible SKU(s). A shared coupon may also mention other variants; only the listed audited SKUs qualify for this catalog. The feed is global: it does **not** apply your private ownership, budget or wish-list filters. A feed reader controls how often it polls and how it notifies you.

You can save a ZIP code, preferred store name/number and an official store-page link for reference. The settings also link to Harbor Freight's own locator and directory. Location preferences do not establish inventory, availability or local prices.

Your budget, owned tools, family rules, purchase log, shortlist, reviews, notes and alert preferences stay in this browser's local storage. There is no personal account, cloud synchronization, analytics or third-party script/font dependency. The shared GitHub refresh job handles public deal data only. Product images are served from this repository; choosing a retailer link opens Harbor Freight.

Use **Backup** regularly. Version 2 backups include the planner state as well as the original shortlist, review states and notes. **Restore** accepts both version 2 and the original version 1 backups; legacy products marked owned migrate into the inventory. Restoring merges saved products and matching records, while supplied preferences and rules take precedence. Browser storage is separate across devices, browsers, the published site and the original local HTML file. Move a backup with you when changing those environments. Backups are personal data: do not commit them to the public repository.

## Audited catalog and downloads

The underlying catalog remains an **October 26, 2026 audit**, supplemented by the automatically refreshed offer feed:

- **2,208 included tools and garage items**, with 1,506 additions from the expanded coverage audit.
- **179 size exclusions:** 170 confirmed gaps and 9 sets with unverified coverage.
- **2,387 saved product photos** and additional specifications for 2,079 entries.
- Recorded decisions for all **1,213 unique automotive-collection listings across 34 pages**, supplemented by 287 distinct official category/source pages.

Individual functional tools are allowed. Graduated wrench, socket, drill-bit and similar families require complete sets without skipped standard increments within their advertised ranges. Tool-only cordless products are labelled because batteries and chargers can add cost. Chemicals, fluids, replacement parts, installation hardware, disposable supplies and unrelated products are excluded from the tooling catalog. Cosmetic colors and documented SKU aliases may share an audited entry. The automatic offer feed does not override these inclusion or size rules.

- [Included catalog CSV — 2,208 rows](site/downloads/harbor_freight_mechanic_tools_under_200_no_skipped_sizes.csv)
- [Size exclusions CSV — 179 rows](site/downloads/harbor_freight_mechanic_tools_under_200_size_exclusions.csv)
- [Automotive coverage ledger CSV — 1,213 rows](site/downloads/harbor_freight_automotive_coverage_audit.csv)
- [Current normalized offers and refresh health](site/data/deals.json)
- [Observed offer-price history](site/data/deal-history.json)

The three original CSVs retain their audited snapshot prices. The app's result export adds current public/member offers, coupon codes and expiries in separate columns alongside the snapshot price and your own notes. Search, category/brand/price filters, comparisons, shortlists and the full excluded-set review remain available.

## Run and check locally

Use Python 3.9+ with timezone data and Node.js 18+; no package installation or build framework is required. Refreshing deals needs network access. Tests and site validation use the saved data.

```sh
python3 scripts/update_deals.py
python3 -m unittest discover -s tests -p 'test_*.py'
node --test tests/*.cjs
python3 scripts/check_site.py
for source in site/assets/*.js; do node --check "$source"; done
python3 -m http.server 8000 --directory site
```

Open `http://localhost:8000/`. The website lives in `site/`: `index.html` contains the audited catalog, `assets/` contains the interface and product photos, `data/` contains public feed/history/capability data, `downloads/` contains snapshot CSVs, and `deals.xml` is the public RSS feed. `scripts/build_capabilities.py` rebuilds conservative ownership descriptors when the audited catalog changes.

## GitHub Pages deployment

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) refreshes offers, runs the Python and Node behavioral tests and JavaScript syntax checks, commits only the refreshed public offer/history/RSS files, validates and stages the public site, and deploys it to the `github-pages` environment. Refresh failure is reported while preserved data and updated health can still be published. Personal browser state is never part of the deployment.

`scripts/build_site.py` creates `_site/release.json` with the Git commit, catalog counts, offer refresh status/time and SHA-256 hashes of the published assets. This connects a deployed release to its source commit and saved data.

## Attribution

This is an independent tool-planning project and is not affiliated with Harbor Freight. Product photographs, trademarks and brief retailer excerpts belong to their respective owners. Product facts and official source links are retained for review. A saved catalog price is a snapshot; active offer claims come from the dated offer feed and remain subject to the retailer's terms and availability.
