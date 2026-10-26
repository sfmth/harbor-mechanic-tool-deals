# Harbor Mechanic Tool Deals

A visual review of Harbor Freight mechanic and garage tools with saved public prices of **$200 or less per item**.

**[Open the website](https://sfmth.github.io/harbor-mechanic-tool-deals/)**

The catalog is an **October 26, 2026 snapshot**, not a live deal or inventory feed. Prices are before tax and shipping; no coupon or paid membership is assumed. Official product pages and indexed official copies have different retrieval ages, recorded in each item's evidence. Verify the current price and availability with the retailer.

## What is included

- 2,208 included tools and garage items, with 1,506 additions from the expanded coverage audit.
- 179 size exclusions: 170 confirmed gaps and 9 sets with unverified size coverage.
- 2,387 saved official product photos and additional specifications for 2,079 entries.
- Explicit decisions for all 1,213 unique listings across 34 pages of the audited automotive collection, supplemented by 287 distinct official category and source pages.
- Search, category/brand/price filters, size checks, power-package and audit filters, comparisons, shortlists, review notes, and CSV export.

Individual functional tools are allowed. Graduated wrench, socket, drill-bit, and similar families require complete sets without skipped standard increments within their advertised ranges. Tool-only cordless products are labeled because batteries and chargers can add cost. Chemicals, fluids, replacement parts, installation hardware, disposable supplies, and unrelated products are excluded from this tooling catalog. Cosmetic colors and documented SKU aliases may share one verified entry.

## Download the data

- [Included tools — 2,208 rows](site/downloads/harbor_freight_mechanic_tools_under_200_no_skipped_sizes.csv)
- [Size exclusions — 179 rows](site/downloads/harbor_freight_mechanic_tools_under_200_size_exclusions.csv)
- [Automotive collection coverage ledger — 1,213 rows](site/downloads/harbor_freight_automotive_coverage_audit.csv)

The same files are available under `downloads/` on the published website. The app also exports the current filtered results or full shortlist, including your own review states and notes.

## Browser storage and privacy

Shortlists, review states, and personal notes stay in your browser's local storage. There is no account, backend, analytics, or third-party script/font dependency. Product images are served from this repository. Retailer links open Harbor Freight when selected.

Browser storage is separate for the published website and the original local HTML file. To transfer a previous shortlist or notes, use **Backup** in the original file and **Restore** on the website. Your browser backup is personal data; do not commit it to this repository.

## Run locally

No package installation or build framework is required. Use Python 3 and Node.js for the checks:

```sh
python3 scripts/check_site.py
node --check site/assets/app.js
python3 -m http.server 8000 --directory site
```

Open `http://localhost:8000/`. The website lives in `site/`: `index.html` contains the audited catalog JSON, `assets/` contains the stylesheet, application JavaScript, and product photos, and `downloads/` contains the current CSVs.

## GitHub Pages deployment

Pushes to `main` run `.github/workflows/pages.yml`. The workflow checks the catalog, images, CSV parity, and JavaScript syntax; stages only the public site into `_site/`; and deploys it to the `github-pages` environment. It can also be run manually from Actions.

`scripts/build_site.py` creates `_site/release.json` with the Git commit, catalog counts, and SHA-256 hashes of every published asset. This makes the deployed snapshot traceable to a repository commit.

## Attribution

This is an independent review project and is not affiliated with Harbor Freight. Product photographs, trademarks, and brief retailer excerpts belong to their respective owners. Product facts and source links are retained for review. The repository name does not imply that a saved price is a current promotion.
