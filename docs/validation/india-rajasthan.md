# Validation — Rajasthan (`india-rajasthan`)

Last updated: 2026-08-20 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `india-rajasthan`
- **Country:** IND
- **Tier:** estimated
- **Kind:** solar
- **Source:** RRVPNL SLDC (Rajasthan State Load Despatch Centre) — probed 2026-05-09 from Indian-IP Bangalore DO droplet: sldc.rajasthan.gov.in returns HTTP 403 on all paths. Login-gated portal, no public data surface. T1 blocked: no unauthenticated endpoint. Loader uses live CEA daily generation × Ember 2024 rate 6% / (1−rate) (≈6.3 TWh/yr at current 98 TWh/yr generation); supersedes the older ~3.5 TWh/yr Ember-anchor estimate.
- **Source URL:** [https://sldc.rajasthan.gov.in/](https://sldc.rajasthan.gov.in/)
- **Loader:** [`india-rajasthan.json.ts`](../../src/data/india-rajasthan.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** —
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —


<!-- BEGIN MANUAL -->
## Bad-conversions check

| # | Item | Verdict | Reason |
|---|------|---------|--------|
| 1 | DSM / deviation values used as curtailment | no | Ember curtailment rate applied to CEA generation; neither figure is a deviation/scheduling settlement |
| 2 | Capacity-at-risk MW used as curtailed energy MWh | no | CEA data is MU (= GWh, energy), not MW (capacity) |
| 3 | Instruction percentage without a generation denominator | no | Ember rate applied to actual generation TWh from CEA; denominator is explicit and official |
| 4 | Blank or dash treated as zero | no | Missing daily rows use `withFallback` to prior anchor; CSV rows with no report date are simply absent, not zeroed |
| 5 | Modelled fallback labelled as verified measurement | partial | `sourceNote` explicitly states: "Annual curtailed energy is derived from CEA official generation data (denominator) × Ember India 2024 state curtailment rate (modelled). Hourly shape is synthetic. Only the generation denominator is from a primary official source." |
<!-- END MANUAL -->
## Discrepancy analysis

_Pending: no backfill parquet yet for this region. Once HB.1 / HB.2 land the per-year totals for this region, this section will summarise the Δ vs TSO/Ember/IRENA and flag any year exceeding ±25%._

## Known limitations

- Curtailment rate (6%) is Ember's national/regional estimate applied uniformly to Rajasthan; actual rate varies by season (summer peak curtailment) and grid conditions
- Hourly shape remains synthetic (typical solar profile centred on 06:30 UTC)
- The RRVPNL SLDC source (`sldc.rajasthan.gov.in`) remains geoblocked from non-Indian IPs; T1a promotion is still gated on an Indian residential IP relay

## Links

- Loader source: [`india-rajasthan.json.ts`](../../src/data/india-rajasthan.json.ts)
<!-- BEGIN MANUAL -->
- Research (May 2026, not production): official RRVPNL `re-curtailment` PDF extraction — [`rajasthan-curtailment-reconciliation.mjs`](../../scripts/research/rajasthan-curtailment-reconciliation.mjs); status [`2026-05-07-rajasthan-source-elevation-status.md`](../research/2026-05-07-rajasthan-source-elevation-status.md); Jan–May 2026 extraction [`2026-05-07-rajasthan-curtailment-2026-01-2026-02-2026-03-2026-04-2026-05.md`](../research/2026-05-07-rajasthan-curtailment-2026-01-2026-02-2026-03-2026-04-2026-05.md) (75 rows, 0.052 TWh, 52 manual-from-scan); listing inventory [`2026-05-07-rajasthan-curtailment-listing-inventory-2025-01-2026-05.md`](../research/2026-05-07-rajasthan-curtailment-listing-inventory-2025-01-2026-05.md); February OCR review [`2026-05-07-rajasthan-february-ocr-review.md`](../research/2026-05-07-rajasthan-february-ocr-review.md); India source discovery [`2026-05-07-india-curtailment-source-discovery.md`](../research/2026-05-07-india-curtailment-source-discovery.md). That extraction sits >50× below the CEA × Ember anchor above — see `docs/research/2026-09-09-wip-triage.md` §4.
<!-- END MANUAL -->
- Backfill archive: `data/historical/backfill/*_india-rajasthan_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
