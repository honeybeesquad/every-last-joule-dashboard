# Validation — Rajasthan (`india-rajasthan`)

Last updated: 2026-05-09 · Sprint: India gen-re anchor

## Source

- **Region id:** `india-rajasthan`
- **Country:** IND
- **Tier:** estimated
- **Methodology note:** T2-annual-calibrated (generation denominator from CEA official source; curtailment rate modelled from Ember India 2024). Tier bucket stays T3 until tier-resolution.ts gains a T2-static path.
- **Source provenance:** `official-lead` — generation denominator from CEA official daily Excel; curtailment rate modelled from Ember India 2024
- **Kind:** solar
- **Source:** CEA Renewable Project Monitoring Division — daily generation Excel, State-Wise sheet (`gen-re.cea.gov.in`)
- **Source URL:** [https://gen-re.cea.gov.in/reports](https://gen-re.cea.gov.in/reports)
- **Excel URL pattern:** `https://gen-re.cea.gov.in/public/uploads/dailyReport/excel/Report-YYYY-MM-DD.xlsx`
- **Loader:** [`india-rajasthan.json.ts`](../../src/data/india-rajasthan.json.ts)
- **CSV:** `data/historical/india-rajasthan-gen-daily.csv` — committed, refreshed daily by britta

## Calibration

- **Generation source:** CEA gen-re.cea.gov.in daily Excel, State-Wise sheet, Solar Energy (MU) column
- **Curtailment rate:** ~6% solar — Ember India 2024 state-level estimate
- **Formula:** `annual_curtailed_TWh = annual_generation_TWh × 0.06 / (1 − 0.06)`
- **Ember convention:** rate expressed as fraction of potential (curtailed / (generated + curtailed))
- **Curtailment rate source:** Ember India 2024 state-level estimates

## Published anchors

- **CEA annual generation (trailing 365 days from CSV):** populated after bootstrap run
- **Ember curtailment rate:** ~6% solar (Ember India 2024)
- **Ember estimated curtailment:** ~3.5 TWh/yr
- **Fallback anchor (no CSV):** 3.5 TWh/yr solar (Ember India 2025, unchanged)

## Bad-conversions check

| # | Item | Verdict | Reason |
|---|------|---------|--------|
| 1 | DSM / deviation values used as curtailment | no | Ember curtailment rate applied to CEA generation; neither figure is a deviation/scheduling settlement |
| 2 | Capacity-at-risk MW used as curtailed energy MWh | no | CEA data is MU (= GWh, energy), not MW (capacity) |
| 3 | Instruction percentage without a generation denominator | no | Ember rate applied to actual generation TWh from CEA; denominator is explicit and official |
| 4 | Blank or dash treated as zero | no | Missing daily rows use `withFallback` to prior anchor; CSV rows with no report date are simply absent, not zeroed |
| 5 | Modelled fallback labelled as verified measurement | partial | `sourceNote` explicitly states: "Annual curtailed energy is derived from CEA official generation data (denominator) × Ember India 2024 state curtailment rate (modelled). Hourly shape is synthetic. Only the generation denominator is from a primary official source." |

## Known limitations

- Curtailment rate (6%) is Ember's national/regional estimate applied uniformly to Rajasthan; actual rate varies by season (summer peak curtailment) and grid conditions
- Hourly shape remains synthetic (typical solar profile centred on 06:30 UTC)
- The RRVPNL SLDC source (`sldc.rajasthan.gov.in`) remains geoblocked from non-Indian IPs; T1a promotion is still gated on an Indian residential IP relay

## Links

- Loader: [`india-rajasthan.json.ts`](../../src/data/india-rajasthan.json.ts)
- Bootstrap script: [`scripts/bootstrap-india-gen-re.py`](../../scripts/bootstrap-india-gen-re.py)
- Britta fetcher: `~/code/elj-relay/fetchers/india-gen-re.sh`
- Methodology: [`docs/methodology/tier-classification-guide.md`](../methodology/tier-classification-guide.md)
