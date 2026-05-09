# Validation — Maharashtra (`india-maharashtra`)

Last updated: 2026-05-09 · Sprint: India gen-re anchor

## Source

- **Region id:** `india-maharashtra`
- **Country:** IND
- **Tier:** static
- **Methodology note:** T2-annual-calibrated (generation denominator from CEA official source; curtailment rate modelled from Ember India 2024). Tier bucket stays T3 until tier-resolution.ts gains a T2-static path.
- **Source provenance:** `official-lead` — generation denominator from CEA official daily Excel; curtailment rate modelled from Ember India 2024
- **Kind:** mixed (solar + wind)
- **Source:** CEA Renewable Project Monitoring Division — daily generation Excel, State-Wise sheet (`gen-re.cea.gov.in`)
- **Source URL:** [https://gen-re.cea.gov.in/reports](https://gen-re.cea.gov.in/reports)
- **Excel URL pattern:** `https://gen-re.cea.gov.in/public/uploads/dailyReport/excel/Report-YYYY-MM-DD.xlsx`
- **Loader:** [`india-maharashtra.json.ts`](../../src/data/india-maharashtra.json.ts)
- **CSV:** `data/historical/india-maharashtra-gen-daily.csv` — committed, refreshed daily by britta

## Calibration

- **Generation source:** CEA gen-re.cea.gov.in daily Excel, State-Wise sheet, Wind Energy + Solar Energy (MU) columns combined
- **Curtailment rate:** ~2% combined — Ember India 2024 state-level estimate
- **Formula:** `annual_curtailed_TWh = annual_generation_TWh × 0.02 / (1 − 0.02)`
- **Ember convention:** rate expressed as fraction of potential (curtailed / (generated + curtailed))
- **Solar/wind split:** derived from actual CEA CSV ratios; fallback 55% solar / 45% wind (MNRE 2024 capacity-weighted)

## Published anchors

- **CEA annual generation (trailing 365 days from CSV):** populated after bootstrap run
- **Ember curtailment rate:** ~2% combined (Ember India 2024)
- **Ember estimated curtailment:** ~0.3 TWh/yr
- **Fallback anchor (no CSV):** 0.3 TWh/yr mixed (POSOCO Western Region 2024, unchanged)

## Bad-conversions check

| # | Item | Verdict | Reason |
|---|------|---------|--------|
| 1 | DSM / deviation values used as curtailment | no | Ember curtailment rate applied to CEA generation; neither figure is a deviation/scheduling settlement |
| 2 | Capacity-at-risk MW used as curtailed energy MWh | no | CEA data is MU (= GWh, energy), not MW (capacity) |
| 3 | Instruction percentage without a generation denominator | no | Ember rate applied to actual combined generation TWh from CEA; denominator is explicit and official |
| 4 | Blank or dash treated as zero | no | Missing daily rows use `withFallback` to prior anchor; absent dates are not zeroed |
| 5 | Modelled fallback labelled as verified measurement | partial | `sourceNote` explicitly states: "Annual curtailed energy is derived from CEA official generation data (denominator) × Ember India 2024 state curtailment rate (modelled). Hourly shape is synthetic. Only the generation denominator is from a primary official source." |

## Known limitations

- Curtailment rate (2%) is Ember's estimate; Maharashtra's mixed portfolio (Solapur solar + Satara/Dhule wind) has lower aggregate curtailment than pure-solar/wind states
- Solar/wind split derived from CSV ratios; will update automatically as CEA data accumulates
- Hourly shape remains synthetic (mixed solar + wind typical profiles)
- The MSLDC source (`msldc.mahavedha.com`) remains geoblocked; T1a promotion gated on Indian residential IP relay

## Links

- Loader: [`india-maharashtra.json.ts`](../../src/data/india-maharashtra.json.ts)
- Bootstrap script: [`scripts/bootstrap-india-gen-re.py`](../../scripts/bootstrap-india-gen-re.py)
- Britta fetcher: `~/code/elj-relay/fetchers/india-gen-re.sh`
