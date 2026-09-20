# Validation — Puerto Rico Wind (`puerto-rico-wind`)

Last updated: 2026-09-20 · Sprint: TSO-grid completeness · Paper section: Technical Validation §4.2

## Source

- **Region id:** `puerto-rico-wind`
- **Country:** PRI
- **Tier:** estimated
- **Kind:** wind
- **Source:** PREPA operationdata.prepa.pr.gov dataSource.js (utility-scale PPOA wind SiteTotal MW; abed NordVPN relay CSV). Waste unpublished — no curtailment column. EIA-930 has no PR BA. Not T1a.
- **Source URL:** [https://operationdata.prepa.pr.gov/](https://operationdata.prepa.pr.gov/)
- **Loader:** [`puerto-rico.json.ts`](../../src/data/puerto-rico.json.ts)
- **Structural gap:** no
- **Waste status:** unpublished. Missing ≠ zero. Live generation does not make waste T1a.

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** —
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

Relay lake starts from live `dataSource.js` snapshots (not EIA-930 — 83 respondents, no PREP/LUMA/CEPR). Until ≥24 distinct timestamps, generationProfile is empty unpublished. Do not read a zero `profile` as a measured waste finding. Utility-scale PPOA only — not rooftop DG.

## Known limitations

See `docs/methodology/historical-backfill.md` and STATUS.md TSO-grid completeness. Azure mirror is IP-forbidden from NZ; abed NordVPN is the 403 path.

## Links

- Loader source: [`puerto-rico.json.ts`](../../src/data/puerto-rico.json.ts)
- Relay fetch: [`puerto-rico-prepa-fetch.py`](../../scripts/relay/puerto-rico-prepa-fetch.py)
- Backfill archive: `data/historical/backfill/*_puerto-rico-wind_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
