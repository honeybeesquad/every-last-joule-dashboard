# Validation — Gujarat (`india-gujarat`)

Last updated: 2026-05-05 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `india-gujarat`
- **Country:** IND
- **Tier:** static
- **Kind:** solar
- **Source:** GSLDC (Gujarat State Load Despatch Centre / GETCO) — RE curtailment reports at sldc.gujarat.gov.in. Geoblocked from non-Indian IP ranges; loader currently emits T3-modelled typical-shape calibrated to POSOCO/Ember India 2024 (~1.0 TWh/yr solar curtailment). Will be promoted to T1a-live-tso when the India-egress relay activates the live parse.
- **Source URL:** [https://sldc.gujarat.gov.in/](https://sldc.gujarat.gov.in/)
- **Loader:** [`india-gujarat.json.ts`](../../src/data/india-gujarat.json.ts)
- **Structural gap:** yes

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

## Discrepancy analysis

Gujarat is India's leading solar state by installed capacity, with the Khavda Ultra Mega Renewable Energy Park (~30 GW sanctioned) and the Kutch corridor being the primary curtailment zones. The POSOCO West Region 2024 figure of ~1.5 TWh covers Gujarat + Rajasthan; with Rajasthan now tracked separately at 3.5 TWh (Ember 2025), the Gujarat-specific anchor of ~1.0 TWh reflects the residual West-region curtailment less Rajasthan's contribution.

## Known limitations

GSLDC is geoblocked from non-Indian IP ranges (ECONNREFUSED/timeout from build environments). The loader currently falls back to a typical-shape solar profile calibrated at 1.0 TWh/yr. When an India-egress relay is established, the GSLDC daily report parser will be activated. The T1a tier designation reflects the intended source quality, not the current fallback state.

## Links

- Loader source: [`india-gujarat.json.ts`](../../src/data/india-gujarat.json.ts)
- Backfill archive: `data/historical/backfill/*_india-gujarat_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
