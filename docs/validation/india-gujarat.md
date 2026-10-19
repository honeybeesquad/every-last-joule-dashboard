# Validation — Gujarat (`india-gujarat`)

Last updated: 2026-10-19 · Grid-India NLDC REMC daily VRE MU · Paper section: Technical Validation §4.2

## Source

- **Region id:** `india-gujarat`
- **Country:** IND
- **Tier:** anchored
- **Kind:** solar
- **Source:** Grid-India NLDC REMC daily VRE reports — MEASURED RE State wind+solar curtailment (MU) from the first table (real-time system constraints). 1.285 TWh across 601 published days (2025-01-01 → 2026-10-16); ~0.78 TWh/yr annualised. Daily PDFs, not a live feed, hence T2 not T1. Flat 24/7 profile: daily energy only. GSLDC DSM/REC pages are not this series. Supersedes CEA×Ember ~1.4 TWh/yr.
- **Source URL:** [https://grid-india.in/](https://grid-india.in/)
- **Loader:** [`india-gujarat.json.ts`](../../src/data/india-gujarat.json.ts)
- **Structural gap:** no


<!-- BEGIN MANUAL -->
- **Region id:** `india-gujarat`
- **Country:** IND
- **Tier:** anchored
- **Methodology note:** T2-annual-calibrated (measured NLDC REMC daily MU annualised across the published record). Not T1a — daily PDFs in arrears, India-only CDN, no hourly shape.
- **Source provenance:** `verified` — curtailment energy is measured and published by Grid-India NLDC; no Ember rate is applied
- **Kind:** solar (measured split is ~74% solar / ~26% wind)
- **Source:** Grid-India NLDC REMC daily VRE PDF series (`DAILY_VRE_REPORT` on webapi.grid-india.in; CDN `webcdn.grid-india.in`). First table only: "VRE Curtailment Details due to real time system constraints". 2025-01–2025-05 layout is Wind MU / Solar MU / Wind MW / Solar MW; 2025-06 onward is Wind MW / Wind MU / Solar MW / Solar MU.
- **Source URL:** [https://grid-india.in/](https://grid-india.in/)
- **Loader:** [`india-gujarat.json.ts`](../../src/data/india-gujarat.json.ts)
- **CSV:** `data/historical/india-gujarat-nldc-curtailed-daily.csv` — committed; regenerate with `scripts/fetch-nldc-remc-vre.py` from an Indian IP
<!-- END MANUAL -->
## Calibration

- **Rate source documented in:** n/a — no rate. Energy is the operator's published MU.
- **Uniform across backfill years:** n/a — no backfill


<!-- BEGIN MANUAL -->
- **Generation source:** unused for this region's waste. CEA gen-re daily Excel remains in the Grid-India unpublished generation sum.
- **Curtailment energy:** NLDC RE State Gujarat row, 1 MU = 1 GWh
- **Annualisation:** `record_TWh × 365 / published_days` (601 days, including zeros)
<!-- END MANUAL -->
## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill — T2 uses the published NLDC window)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** ~0.78 TWh/yr annualised from 1.285 TWh / 601 NLDC days
- **Ember annual:** ~1.4 TWh/yr (CEA solar × 3% / (1−3%), superseded)
- **IRENA annual:** —
- **Other:** —


<!-- BEGIN MANUAL -->
- **NLDC published energy:** 1285.2 GWh (340.5 wind + 944.7 solar) across 601 days, 2025-01-01 → 2026-10-16
- **Annualised:** ~780.5 GWh/yr
- **Superseded Ember estimate:** ~1.4 TWh/yr (~1.8× the measured NLDC series)
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
## Bad-conversions check

| # | Item | Verdict | Reason |
|---|------|---------|--------|
| 1 | DSM / deviation values used as curtailment | no | NLDC table is labelled VRE curtailment due to real-time system constraints. GSLDC "UI RE DSM" and "certificates not to be issued" pages were inspected and not used. |
| 2 | Capacity-at-risk MW used as curtailed energy MWh | no | Energy is the MU column. MW is stored for audit only. 2025 H1 PDFs put MU before MW; the parser remaps that layout. A 269 GWh-from-362 MW reading is rejected. |
| 3 | Instruction percentage without a generation denominator | no | Source is MU, not a % instruction |
| 4 | Blank or dash treated as zero | no | A published RE State row with 0 MU is zero; a day with no Gujarat row is absent, not zeroed. Annualisation uses published-day count. |
| 5 | Modelled fallback labelled as verified measurement | no | Loader reads the committed NLDC CSV and throws if it is missing. Profile is flat 24/7 because the source has no hourly shape. CEA×Ember is no longer this region's waste path. |
<!-- END MANUAL -->
## Discrepancy analysis

NLDC Gujarat ~0.78 TWh/yr vs the previous CEA×Ember ~1.4 TWh/yr. The Ember path applied a 3% rate to ~46 TWh of CEA solar; that is a modelled rate, not operator MU. Maharashtra's MSLDC series is **not** replaced by NLDC (NLDC Maharashtra ~67 GWh/yr vs MSLDC ~27 GWh/yr — different publication, keep MSLDC). NLDC Rajasthan is a research remainder on this branch; the RRVPNL PDF floor is a separate source.

## Known limitations

<!-- BEGIN MANUAL -->
- Not T1a: daily PDFs, 1–2 day lag, CDN TLS-resets from outside India
- Intra-state SLDC instructions that never reach NLDC REMC are not in this series
- Emergency TRAS Down table is excluded (often MW with 0 MU)
- ISTS pooling-station rows are not summed into Gujarat; the RE State row is the state total
- `india-grid-india` is not T2'd from a national NLDC sum (would double-count Maharashtra)
- Hourly shape is not claimed (flat 24/7)
<!-- END MANUAL -->
## Links

- Loader source: [`india-gujarat.json.ts`](../../src/data/india-gujarat.json.ts)
- Fetch/parse: [`scripts/fetch-nldc-remc-vre.py`](../../scripts/fetch-nldc-remc-vre.py)
- State CSV: `data/historical/india-gujarat-nldc-curtailed-daily.csv`
- Long CSV: `data/historical/india-nldc-remc-vre-daily.csv`
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
