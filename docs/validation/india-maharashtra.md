# Validation — Maharashtra (`india-maharashtra`)

Last updated: 2026-08-20 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `india-maharashtra`
- **Country:** IND
- **Tier:** anchored
- **Kind:** mixed
- **Source:** MSLDC (Maharashtra State Load Despatch Centre) Monthly Curtailment Reports — MEASURED daily wind+solar curtailment with operator cause codes (mr10_MMYYYY.pdf). 33.28 GWh across 15 published months (2025-01 → 2026-06); ~26.8 GWh/yr annualised. Monthly publication, 1–2 month lag, months skipped — not a live feed, hence T2 not T1. Supersedes the prior Ember-rate estimate, which overstated by ~46x
- **Source URL:** [https://mahasldc.in/](https://mahasldc.in/)
- **Loader:** [`india-maharashtra.json.ts`](../../src/data/india-maharashtra.json.ts)
- **Structural gap:** no


<!-- BEGIN MANUAL -->
- **Region id:** `india-maharashtra`
- **Country:** IND
- **Tier:** anchored
- **Methodology note:** T2-annual-calibrated (generation denominator from CEA official source; curtailment rate modelled from Ember India 2024). Tier bucket stays T3 until tier-resolution.ts gains a T2-static path.
- **Source provenance:** `verified` — curtailment energy is measured and published by the state grid operator itself; no rate is applied
- **Kind:** mixed (solar + wind)
- **Source:** CEA Renewable Project Monitoring Division — daily generation Excel, State-Wise sheet (`gen-re.cea.gov.in`)
- **Source URL:** [https://gen-re.cea.gov.in/reports](https://gen-re.cea.gov.in/reports)
- **Excel URL pattern:** `https://gen-re.cea.gov.in/public/uploads/dailyReport/excel/Report-YYYY-MM-DD.xlsx`
- **Loader:** [`india-maharashtra.json.ts`](../../src/data/india-maharashtra.json.ts)
- **CSV:** `data/historical/india-maharashtra-gen-daily.csv` — committed, refreshed daily by britta
<!-- END MANUAL -->
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
- **CEA annual generation (trailing 365 days from CSV):** populated after bootstrap run
- **Ember curtailment rate:** ~2% combined (Ember India 2024)
- **Ember estimated curtailment:** ~0.3 TWh/yr
- **Fallback anchor (no CSV):** 0.3 TWh/yr mixed (POSOCO Western Region 2024, unchanged)
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
## Bad-conversions check

| # | Item | Verdict | Reason |
|---|------|---------|--------|
| 1 | DSM / deviation values used as curtailment | no | Ember curtailment rate applied to CEA generation; neither figure is a deviation/scheduling settlement |
| 2 | Capacity-at-risk MW used as curtailed energy MWh | no | CEA data is MU (= GWh, energy), not MW (capacity) |
| 3 | Instruction percentage without a generation denominator | no | Ember rate applied to actual combined generation TWh from CEA; denominator is explicit and official |
| 4 | Blank or dash treated as zero | no | Missing daily rows use `withFallback` to prior anchor; absent dates are not zeroed |
| 5 | Modelled fallback labelled as verified measurement | partial | `sourceNote` explicitly states: "Annual curtailed energy is derived from CEA official generation data (denominator) × Ember India 2024 state curtailment rate (modelled). Hourly shape is synthetic. Only the generation denominator is from a primary official source." |
<!-- END MANUAL -->
## Discrepancy analysis

_Pending: no backfill parquet yet for this region. Once HB.1 / HB.2 land the per-year totals for this region, this section will summarise the Δ vs TSO/Ember/IRENA and flag any year exceeding ±25%._

## Known limitations

<!-- BEGIN MANUAL -->
- Curtailment rate (2%) is Ember's estimate; Maharashtra's mixed portfolio (Solapur solar + Satara/Dhule wind) has lower aggregate curtailment than pure-solar/wind states
- Solar/wind split derived from CSV ratios; will update automatically as CEA data accumulates
- Hourly shape remains synthetic (mixed solar + wind typical profiles)
- The MSLDC source (`msldc.mahavedha.com`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->


<!-- BEGIN MANUAL -->
- Curtailment rate (2%) is Ember's estimate; Maharashtra's mixed portfolio (Solapur solar + Satara/Dhule wind) has lower aggregate curtailment than pure-solar/wind states
- Solar/wind split derived from CSV ratios; will update automatically as CEA data accumulates
- Hourly shape remains synthetic (mixed solar + wind typical profiles)
- The MSLDC source (`msldc.mahavedha.com`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->


<!-- BEGIN MANUAL -->
- Curtailment rate (2%) is Ember's estimate; Maharashtra's mixed portfolio (Solapur solar + Satara/Dhule wind) has lower aggregate curtailment than pure-solar/wind states
- Solar/wind split derived from CSV ratios; will update automatically as CEA data accumulates
- Hourly shape remains synthetic (mixed solar + wind typical profiles)
- The MSLDC source (`msldc.mahavedha.com`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (2%) is Ember's estimate; Maharashtra's mixed portfolio (Solapur solar + Satara/Dhule wind) has lower aggregate curtailment than pure-solar/wind states
- Solar/wind split derived from CSV ratios; will update automatically as CEA data accumulates
- Hourly shape remains synthetic (mixed solar + wind typical profiles)
- The MSLDC source (`msldc.mahavedha.com`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->


<!-- BEGIN MANUAL -->
- Curtailment rate (2%) is Ember's estimate; Maharashtra's mixed portfolio (Solapur solar + Satara/Dhule wind) has lower aggregate curtailment than pure-solar/wind states
- Solar/wind split derived from CSV ratios; will update automatically as CEA data accumulates
- Hourly shape remains synthetic (mixed solar + wind typical profiles)
- The MSLDC source (`msldc.mahavedha.com`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (2%) is Ember's estimate; Maharashtra's mixed portfolio (Solapur solar + Satara/Dhule wind) has lower aggregate curtailment than pure-solar/wind states
- Solar/wind split derived from CSV ratios; will update automatically as CEA data accumulates
- Hourly shape remains synthetic (mixed solar + wind typical profiles)
- The MSLDC source (`msldc.mahavedha.com`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (2%) is Ember's estimate; Maharashtra's mixed portfolio (Solapur solar + Satara/Dhule wind) has lower aggregate curtailment than pure-solar/wind states
- Solar/wind split derived from CSV ratios; will update automatically as CEA data accumulates
- Hourly shape remains synthetic (mixed solar + wind typical profiles)
- The MSLDC source (`msldc.mahavedha.com`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (2%) is Ember's estimate; Maharashtra's mixed portfolio (Solapur solar + Satara/Dhule wind) has lower aggregate curtailment than pure-solar/wind states
- Solar/wind split derived from CSV ratios; will update automatically as CEA data accumulates
- Hourly shape remains synthetic (mixed solar + wind typical profiles)
- The MSLDC source (`msldc.mahavedha.com`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
## Links

- Loader source: [`india-maharashtra.json.ts`](../../src/data/india-maharashtra.json.ts)
- Backfill archive: `data/historical/backfill/*_india-maharashtra_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)

<!-- BEGIN MANUAL -->
- Loader: [`india-maharashtra.json.ts`](../../src/data/india-maharashtra.json.ts)
- Bootstrap script: [`scripts/bootstrap-india-gen-re.py`](../../scripts/bootstrap-india-gen-re.py)
- Britta fetcher: `~/code/elj-relay/fetchers/india-gen-re.sh`
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
| # | Item | Verdict | Reason |
|---|------|---------|--------|
| 1 | DSM / deviation values used as curtailment | no | Ember curtailment rate applied to CEA generation; neither figure is a deviation/scheduling settlement |
| 2 | Capacity-at-risk MW used as curtailed energy MWh | no | CEA data is MU (= GWh, energy), not MW (capacity) |
| 3 | Instruction percentage without a generation denominator | no | Ember rate applied to actual combined generation TWh from CEA; denominator is explicit and official |
| 4 | Blank or dash treated as zero | no | Missing daily rows use `withFallback` to prior anchor; absent dates are not zeroed |
| 5 | Modelled fallback labelled as verified measurement | partial | `sourceNote` explicitly states: "Annual curtailed energy is derived from CEA official generation data (denominator) × Ember India 2024 state curtailment rate (modelled). Hourly shape is synthetic. Only the generation denominator is from a primary official source." |
<!-- END MANUAL -->
