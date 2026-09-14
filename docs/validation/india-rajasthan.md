# Validation — Rajasthan (`india-rajasthan`)

Last updated: 2026-09-15 · Honesty pass on the CEA×Ember vs RRVPNL PDF gap (#964)

## Source

- **Region id:** `india-rajasthan`
- **Country:** IND
- **Tier:** estimated
- **Kind:** solar
- **Source:** CEA gen-re.cea.gov.in daily Excel × Ember India 2024 6% rate (≈6.3 TWh/yr at ~98 TWh/yr solar). Hourly shape is synthetic. RRVPNL SLDC (sldc.rajasthan.gov.in) is login-gated (HTTP 403) — not the live source. Official RRVPNL re-curtailment PDFs for Jan–May 2026 sum to 0.052 TWh, >50× below this modelled anchor (issue #964). Not a measured TSO series.
- **Source URL:** [https://gen-re.cea.gov.in/](https://gen-re.cea.gov.in/)
- **Loader:** [`india-rajasthan.json.ts`](../../src/data/india-rajasthan.json.ts)
- **Structural gap:** no


<!-- BEGIN MANUAL -->
- **Methodology note:** T2-annual-calibrated (generation denominator from CEA official source; curtailment rate modelled from Ember India 2024). Tier bucket stays T3 until tier-resolution.ts gains a T2-static path.
- **Source provenance:** `official-lead` — generation denominator from CEA official daily Excel; curtailment rate modelled from Ember India 2024. The dashboard does **not** plot RRVPNL instruction energy.
<!-- END MANUAL -->
## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill


<!-- BEGIN MANUAL -->
- **Generation source:** CEA gen-re.cea.gov.in daily Excel, State-Wise sheet, Solar Energy (MU) column
- **Curtailment rate:** ~6% solar — Ember India 2024 state-level estimate
- **Formula:** `annual_curtailed_TWh = annual_generation_TWh × 0.06 / (1 − 0.06)`
- **Ember convention:** rate expressed as fraction of potential (curtailed / (generated + curtailed))
<!-- END MANUAL -->
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
- **TSO annual (not used in production):** research extraction of RRVPNL `re-curtailment` PDFs — **0.052 TWh for Jan–May 2026** (0.050 solar / 0.002 wind; 75 rows, 52 manual-from-scan). Not annualised. Issue [#964](https://github.com/honeybeesquad/every-last-joule-dashboard/issues/964).
- **CEA annual generation (trailing 365 days from CSV):** ~98 TWh solar (loader `sourceNote`)
- **Ember curtailment rate:** ~6% solar (Ember India 2024)
- **Dashboard modelled curtailment:** ≈6.3 TWh/yr
- **Fallback anchor (no CSV):** 3.5 TWh/yr solar (older Ember-anchor, superseded 2026-08-20 when CEA CSV is present)
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
## Bad-conversions check

| # | Item | Verdict | Reason |
|---|------|---------|--------|
| 1 | DSM / deviation values used as curtailment | no | Ember curtailment rate applied to CEA generation; neither figure is a deviation/scheduling settlement |
| 2 | Capacity-at-risk MW used as curtailed energy MWh | no | CEA data is MU (= GWh, energy), not MW (capacity) |
| 3 | Instruction percentage without a generation denominator | no | Ember rate applied to actual generation TWh from CEA; denominator is explicit and official |
| 4 | Blank or dash treated as zero | no | Missing daily rows use `withFallback` to prior anchor; CSV rows with no report date are simply absent, not zeroed |
| 5 | Modelled fallback labelled as verified measurement | partial | `sourceNote` states the 6.3 TWh/yr is CEA generation × Ember 6%, and that RRVPNL PDFs (0.052 TWh Jan–May 2026) are not what the dashboard plots. Region `sourceUrl` is now `gen-re.cea.gov.in`, not the SLDC portal. |
<!-- END MANUAL -->
## Discrepancy analysis

_Pending: no backfill parquet yet for this region. Once HB.1 / HB.2 land the per-year totals for this region, this section will summarise the Δ vs TSO/Ember/IRENA and flag any year exceeding ±25%._


<!-- BEGIN MANUAL -->
The dashboard plots CEA generation × Ember 6%, not RRVPNL instructions. The official PDF floor for five months of 2026 is **>50× below** that modelled annual. Caveats on the PDF side: 52 of 75 rows are manual-from-scan; February/Nov/Dec image-only reports were OCR-reviewed as no obvious rows, not audited zeroes; the extractor uses `Relief MW × duration`, which may undercount if the report layout is not energy. Caveat on the dashboard side: a national/regional Ember rate is applied uniformly to Rajasthan. **The 6.3 TWh/yr figure is not replaced here** — changing a headline T3 anchor needs a source-verified annual, which the five-month sample is not.
<!-- END MANUAL -->
## Known limitations

<!-- BEGIN MANUAL -->
- **The plotted 6.3 TWh/yr is modelled (CEA × Ember 6%), not RRVPNL measured curtailment.** Official `re-curtailment` PDFs for Jan–May 2026 extract to 0.052 TWh — >50× below. That floor is not annualised and is not swapped in as the headline.
- Curtailment rate (6%) is Ember's national/regional estimate applied uniformly to Rajasthan; actual rate varies by season (summer peak curtailment) and grid conditions
- Hourly shape remains synthetic (typical solar profile centred on 06:30 UTC)
- The RRVPNL SLDC portal (`sldc.rajasthan.gov.in`) remains login-gated / 403 from unauthenticated clients; T1a promotion is still gated on a working Indian-IP fetch of instruction energy, not on this modelled path
<!-- END MANUAL -->
## Links

- Loader source: [`india-rajasthan.json.ts`](../../src/data/india-rajasthan.json.ts)
<!-- BEGIN MANUAL -->
- Research (May 2026, not production): official RRVPNL `re-curtailment` PDF extraction — [`rajasthan-curtailment-reconciliation.mjs`](../../scripts/research/rajasthan-curtailment-reconciliation.mjs); status [`2026-05-07-rajasthan-source-elevation-status.md`](../research/2026-05-07-rajasthan-source-elevation-status.md); Jan–May 2026 extraction [`2026-05-07-rajasthan-curtailment-2026-01-2026-02-2026-03-2026-04-2026-05.md`](../research/2026-05-07-rajasthan-curtailment-2026-01-2026-02-2026-03-2026-04-2026-05.md) (75 rows, 0.052 TWh, 52 manual-from-scan); listing inventory [`2026-05-07-rajasthan-curtailment-listing-inventory-2025-01-2026-05.md`](../research/2026-05-07-rajasthan-curtailment-listing-inventory-2025-01-2026-05.md); February OCR review [`2026-05-07-rajasthan-february-ocr-review.md`](../research/2026-05-07-rajasthan-february-ocr-review.md); India source discovery [`2026-05-07-india-curtailment-source-discovery.md`](../research/2026-05-07-india-curtailment-source-discovery.md).
<!-- END MANUAL -->
- Backfill archive: `data/historical/backfill/*_india-rajasthan_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
