# Validation — Andhra Pradesh (`india-andhra-pradesh`)

Last updated: 2026-06-18 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `india-andhra-pradesh`
- **Country:** IND
- **Tier:** estimated
- **Kind:** solar
- **Source:** APTRANSCO / APSLDC (Andhra Pradesh Transmission Corporation Ltd / State Load Despatch Centre) — probed 2026-05-09 from Indian-IP Bangalore DO droplet: apsldc.in timed out (no response). Site not publicly reachable even from Indian IPs. T1 blocked. Loader emits T3-modelled typical-shape calibrated to POSOCO Southern Region 2024 (~0.4 TWh/yr solar curtailment).
- **Source URL:** [https://apsldc.in/](https://apsldc.in/)
- **Loader:** [`india-andhra-pradesh.json.ts`](../../src/data/india-andhra-pradesh.json.ts)
- **Structural gap:** no


<!-- BEGIN MANUAL -->
- **Region id:** `india-andhra-pradesh`
- **Country:** IND
- **Tier:** estimated
- **Methodology note:** T2-annual-calibrated (generation denominator from CEA official source; curtailment rate modelled from Ember India 2024). Tier bucket stays T3 until tier-resolution.ts gains a T2-static path.
- **Source provenance:** `official-lead` — generation denominator from CEA official daily Excel; curtailment rate modelled from Ember India 2024
- **Kind:** solar
- **Source:** CEA Renewable Project Monitoring Division — daily generation Excel, State-Wise sheet (`gen-re.cea.gov.in`)
- **Source URL:** [https://gen-re.cea.gov.in/reports](https://gen-re.cea.gov.in/reports)
- **Excel URL pattern:** `https://gen-re.cea.gov.in/public/uploads/dailyReport/excel/Report-YYYY-MM-DD.xlsx`
- **Loader:** [`india-andhra-pradesh.json.ts`](../../src/data/india-andhra-pradesh.json.ts)
- **CSV:** `data/historical/india-andhra-pradesh-gen-daily.csv` — committed, refreshed daily by britta
<!-- END MANUAL -->
## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill


<!-- BEGIN MANUAL -->
- **Generation source:** CEA gen-re.cea.gov.in daily Excel, State-Wise sheet, Solar Energy (MU) column
- **Curtailment rate:** ~3% solar — Ember India 2024 state-level estimate
- **Formula:** `annual_curtailed_TWh = annual_generation_TWh × 0.03 / (1 − 0.03)`
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
- **CEA annual generation (trailing 365 days from CSV):** populated after bootstrap run
- **Ember curtailment rate:** ~3% solar (Ember India 2024)
- **Ember estimated curtailment:** ~0.4 TWh/yr
- **Fallback anchor (no CSV):** 0.4 TWh/yr solar (POSOCO Southern Region 2024, unchanged)
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
## Bad-conversions check

| # | Item | Verdict | Reason |
|---|------|---------|--------|
| 1 | DSM / deviation values used as curtailment | no | Ember curtailment rate applied to CEA generation; neither figure is a deviation/scheduling settlement |
| 2 | Capacity-at-risk MW used as curtailed energy MWh | no | CEA data is MU (= GWh, energy), not MW (capacity) |
| 3 | Instruction percentage without a generation denominator | no | Ember rate applied to actual generation TWh from CEA; denominator is explicit and official |
| 4 | Blank or dash treated as zero | no | Missing daily rows use `withFallback` to prior anchor; absent dates are not zeroed |
| 5 | Modelled fallback labelled as verified measurement | partial | `sourceNote` explicitly states: "Annual curtailed energy is derived from CEA official generation data (denominator) × Ember India 2024 state curtailment rate (modelled). Hourly shape is synthetic. Only the generation denominator is from a primary official source." |
<!-- END MANUAL -->
## Discrepancy analysis

_Pending: no backfill parquet yet for this region. Once HB.1 / HB.2 land the per-year totals for this region, this section will summarise the Δ vs TSO/Ember/IRENA and flag any year exceeding ±25%._

## Known limitations

<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->


<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->


<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->


<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->


<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->


<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->


<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->


<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
- Curtailment rate (3%) is Ember's estimate; Andhra Pradesh curtailment concentrated in Anantapur and Kadapa districts, varies with seasonal irradiance and SLDC scheduling
- Hourly shape remains synthetic (typical solar profile)
- The APSLDC source (`apsldc.in`) remains geoblocked; T1a promotion gated on Indian residential IP relay
<!-- END MANUAL -->
## Links

- Loader source: [`india-andhra-pradesh.json.ts`](../../src/data/india-andhra-pradesh.json.ts)
- Backfill archive: `data/historical/backfill/*_india-andhra-pradesh_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)

<!-- BEGIN MANUAL -->
- Loader: [`india-andhra-pradesh.json.ts`](../../src/data/india-andhra-pradesh.json.ts)
- Bootstrap script: [`scripts/bootstrap-india-gen-re.py`](../../scripts/bootstrap-india-gen-re.py)
- Britta fetcher: `~/code/elj-relay/fetchers/india-gen-re.sh`
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
| # | Item | Verdict | Reason |
|---|------|---------|--------|
| 1 | DSM / deviation values used as curtailment | no | Ember curtailment rate applied to CEA generation; neither figure is a deviation/scheduling settlement |
| 2 | Capacity-at-risk MW used as curtailed energy MWh | no | CEA data is MU (= GWh, energy), not MW (capacity) |
| 3 | Instruction percentage without a generation denominator | no | Ember rate applied to actual generation TWh from CEA; denominator is explicit and official |
| 4 | Blank or dash treated as zero | no | Missing daily rows use `withFallback` to prior anchor; absent dates are not zeroed |
| 5 | Modelled fallback labelled as verified measurement | partial | `sourceNote` explicitly states: "Annual curtailed energy is derived from CEA official generation data (denominator) × Ember India 2024 state curtailment rate (modelled). Hourly shape is synthetic. Only the generation denominator is from a primary official source." |
<!-- END MANUAL -->
