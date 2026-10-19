# Validation — Rajasthan (`india-rajasthan`)

Last updated: 2026-10-19 · T2 on RRVPNL PDF event energy (#964)

## Source

- **Region id:** `india-rajasthan`
- **Country:** IND
- **Tier:** anchored
- **Kind:** solar
- **Source:** RRVPNL (Rajasthan SLDC) re-curtailment PDFs — MEASURED Relief-MW × duration event energy. 0.052 TWh in the Jan–May 2026 published reports (75 rows, 52 medium-confidence manual-from-scan). Dashboard 30-day figure spreads that floor across the 151-day report window; not annualised to a TWh/yr. Monthly PDFs, not a live feed, hence T2 not T1. Flat 24/7 profile: events are not an hourly series. Supersedes CEA×Ember ~4.6 TWh/yr, which overstated this floor by ~50× (issue #964).
- **Source URL:** [https://sldc.rajasthan.gov.in/rrvpnl/re-curtailment](https://sldc.rajasthan.gov.in/rrvpnl/re-curtailment)
- **Loader:** [`india-rajasthan.json.ts`](../../src/data/india-rajasthan.json.ts)
- **Structural gap:** no


<!-- BEGIN MANUAL -->
- **Methodology note:** T2-annual-calibrated (measured RRVPNL re-curtailment PDF event energy; 30-day figure spreads 0.052 TWh across the 151-day Jan–May 2026 report window). Not T1a — monthly PDFs, not a live feed. Not annualised to a TWh/yr.
- **Source provenance:** `verified` — event energy is published by RRVPNL; 52 of 75 rows are medium-confidence manual-from-scan of official image-only PDFs.
<!-- END MANUAL -->
## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill


<!-- BEGIN MANUAL -->
- **Energy source:** RRVPNL `re-curtailment` PDFs, `Relief MW × duration hours`
- **Committed extraction:** `data/historical/india-rajasthan-rrvpnl-curtailed-events.csv` (75 rows, 0.052327 TWh, 52 `manual_from_scanned_pdf`)
- **30-day dashboard figure:** `0.052327 × 30 / 151` — report-window rate, not a TWh/yr
- **Superseded path:** CEA generation × Ember India 2024 6% (~4.6 TWh/yr) is no longer plotted
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
- **TSO published floor (plotted):** RRVPNL `re-curtailment` PDFs — **0.052 TWh for Jan–May 2026** (0.050 solar / 0.002 wind; 75 rows, 52 manual-from-scan). Not annualised. Issue [#964](https://github.com/honeybeesquad/every-last-joule-dashboard/issues/964).
- **Dashboard 30-day:** ≈0.010 TWh (`0.052 × 30 / 151`)
- **Superseded CEA×Ember modelled annual:** ≈4.6 TWh/yr (~71 TWh solar × 6% / 0.94). The previous ~6.3 TWh/yr included Excel serial 45944 as energy.
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
## Bad-conversions check

| # | Item | Verdict | Reason |
|---|------|---------|--------|
| 1 | DSM / deviation values used as curtailment | no | Energy is `Relief MW × duration hours` from RRVPNL event tables, not a DSM/deviation settlement |
| 2 | Capacity-at-risk MW used as curtailed energy MWh | no | Each row multiplies relief MW by duration hours to get MWh |
| 3 | Instruction percentage without a generation denominator | no | Source is event energy, not an instruction % |
| 4 | Blank or dash treated as zero | no | February/Nov/Dec image-only reports are OCR-reviewed as no obvious rows, not audited zeroes; they sit inside the 151-day window without invented daily NIL rows |
| 5 | Modelled fallback labelled as verified measurement | no | Dashboard plots the RRVPNL PDF floor. CEA×Ember ~4.6 TWh/yr is named as the superseded estimate. 52 of 75 rows remain medium-confidence manual-from-scan |
<!-- END MANUAL -->
## Discrepancy analysis

_Pending: no backfill parquet yet for this region. Once HB.1 / HB.2 land the per-year totals for this region, this section will summarise the Δ vs TSO/Ember/IRENA and flag any year exceeding ±25%._


<!-- BEGIN MANUAL -->
The dashboard plots the RRVPNL PDF floor (0.052 TWh over Jan–May 2026), not CEA×Ember. That floor is **>50× below** the superseded modelled annual (~4.6 TWh/yr). Caveats: 52 of 75 rows are manual-from-scan; February/Nov/Dec image-only reports were OCR-reviewed as no obvious rows, not audited zeroes; `Relief MW × duration` may undercount if a report layout is not energy; the 30-day figure is the floor × 30/151, not a TWh/yr. The modelled annual had moved 6.3 → 4.6 TWh/yr earlier because a 2025-10-14 Excel serial-date parse error (~46 TWh of fake solar) was repaired.
<!-- END MANUAL -->
## Known limitations

<!-- BEGIN MANUAL -->
- **The plotted figure is a five-month PDF floor, not a calendar-year total.** 0.052 TWh in published Jan–May 2026 reports; 30-day dashboard energy is that floor × 30/151. Not annualised. 52 of 75 rows are medium-confidence manual-from-scan.
- Hourly shape is flat 24/7: the source is event energy, not a 24-hour series. A solar typical-shape would have kept this in T3.
- The RRVPNL listing (`sldc.rajasthan.gov.in/rrvpnl/re-curtailment`) still 403s/times out from non-Indian IPs; later-2026 PDFs are not in this sample. Not T1a.
- Grid-India NLDC daily VRE reports and third-party aggregators of them are not this region's source.
<!-- END MANUAL -->
## Links

- Loader source: [`india-rajasthan.json.ts`](../../src/data/india-rajasthan.json.ts)
<!-- BEGIN MANUAL -->
- Production CSV: [`india-rajasthan-rrvpnl-curtailed-events.csv`](../../data/historical/india-rajasthan-rrvpnl-curtailed-events.csv). Research extraction: [`rajasthan-curtailment-reconciliation.mjs`](../../scripts/research/rajasthan-curtailment-reconciliation.mjs); status [`2026-05-07-rajasthan-source-elevation-status.md`](../research/2026-05-07-rajasthan-source-elevation-status.md); Jan–May 2026 report [`2026-05-07-rajasthan-curtailment-2026-01-2026-02-2026-03-2026-04-2026-05.md`](../research/2026-05-07-rajasthan-curtailment-2026-01-2026-02-2026-03-2026-04-2026-05.md); listing inventory [`2026-05-07-rajasthan-curtailment-listing-inventory-2025-01-2026-05.md`](../research/2026-05-07-rajasthan-curtailment-listing-inventory-2025-01-2026-05.md); February OCR review [`2026-05-07-rajasthan-february-ocr-review.md`](../research/2026-05-07-rajasthan-february-ocr-review.md).
<!-- END MANUAL -->
- Backfill archive: `data/historical/backfill/*_india-rajasthan_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
