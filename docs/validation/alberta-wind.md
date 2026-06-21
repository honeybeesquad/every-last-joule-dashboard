# Validation — Alberta Wind (`alberta-wind`)

Last updated: 2026-06-21 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `alberta-wind`
- **Country:** CAN
- **Tier:** live
- **Kind:** wind
- **Source:** AESO wind snapshot
- **Source URL:** [http://ets.aeso.ca/ets_web/ip/Market/Reports/CSDReportServlet](http://ets.aeso.ca/ets_web/ip/Market/Reports/CSDReportServlet)
- **Loader:** [`alberta.json.ts`](../../src/data/alberta.json.ts)
- **Structural gap:** no


<!-- BEGIN MANUAL -->
- **Source provenance:** `verified` — AESO publishes the live wind snapshot AND the calibrated 5% curtailment rate; both are own-jurisdiction feeds, no fallback shape involved. (See [tier-classification-guide.md#source-provenance-orthogonal-to-tier](../methodology/tier-classification-guide.md#source-provenance-orthogonal-to-tier).)
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
## Bad-conversions check

See [`docs/methodology/tier-classification-guide.md#bad-conversions-you-must-reject`](../methodology/tier-classification-guide.md#bad-conversions-you-must-reject) for the full checklist.

| # | Item | Verdict | Reason |
|---|------|---------|--------|
| 1 | DSM / deviation values used as curtailment | no | AESO publishes the wind-supply snapshot directly; no deviation table is being substituted. The 5% Alberta calibrated proxy is applied to the live wind feed, not to a deviation series. |
| 2 | Capacity-at-risk MW used as curtailed energy MWh | no | The published 5% rate is calibrated against AESO operational disclosure (not back-calculated from installed capacity × CF × assumed rate). |
| 3 | Instruction percentage without a generation denominator | no | The 5% rate is paired with the live AESO wind-supply MW feed at every emission, giving a defined energy denominator. |
| 4 | Blank or dash treated as zero | no | The loader treats AESO fetch failures via `withFallback` (last-good or stale-fallback), not by coercing missing values to zero. |
| 5 | Modelled fallback labelled as verified measurement | no | Hourly trace is sourced from the live AESO supply snapshot; only the 5% rate is calibration-derived. The validation doc states the rate provenance explicitly. |
<!-- END MANUAL -->
## Discrepancy analysis

No wind-only backfill is currently archived. The loader uses AESO's live wind supply row and applies the Alberta calibrated 5% curtailment proxy.

## Known limitations

AESO CSD is a current-supply snapshot rather than a historical curtailment feed. The wind child keeps the wind component separate from solar so no dashboard bar bundles multiple energy types.

## Links

- Loader source: [`alberta.json.ts`](../../src/data/alberta.json.ts)
- Backfill archive: `data/historical/backfill/*_alberta-wind_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)

<!-- BEGIN MANUAL -->
See [`docs/methodology/tier-classification-guide.md#bad-conversions-you-must-reject`](../methodology/tier-classification-guide.md#bad-conversions-you-must-reject) for the full checklist.

| # | Item | Verdict | Reason |
|---|------|---------|--------|
| 1 | DSM / deviation values used as curtailment | no | AESO publishes the wind-supply snapshot directly; no deviation table is being substituted. The 5% Alberta calibrated proxy is applied to the live wind feed, not to a deviation series. |
| 2 | Capacity-at-risk MW used as curtailed energy MWh | no | The published 5% rate is calibrated against AESO operational disclosure (not back-calculated from installed capacity × CF × assumed rate). |
| 3 | Instruction percentage without a generation denominator | no | The 5% rate is paired with the live AESO wind-supply MW feed at every emission, giving a defined energy denominator. |
| 4 | Blank or dash treated as zero | no | The loader treats AESO fetch failures via `withFallback` (last-good or stale-fallback), not by coercing missing values to zero. |
| 5 | Modelled fallback labelled as verified measurement | no | Hourly trace is sourced from the live AESO supply snapshot; only the 5% rate is calibration-derived. The validation doc states the rate provenance explicitly. |
<!-- END MANUAL -->
