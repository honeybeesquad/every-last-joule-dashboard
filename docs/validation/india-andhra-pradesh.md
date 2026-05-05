# Validation — Andhra Pradesh (`india-andhra-pradesh`)

Last updated: 2026-05-05 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `india-andhra-pradesh`
- **Country:** IND
- **Tier:** static
- **Kind:** solar
- **Source:** APTRANSCO / APSLDC (Andhra Pradesh Transmission Corporation Ltd / State Load Despatch Centre) — RE curtailment data at apsldc.in. Geoblocked from non-Indian IP ranges; loader currently emits T3-modelled typical-shape calibrated to POSOCO Southern Region 2024 (~0.4 TWh/yr solar curtailment). Will be promoted to T1a-live-tso when the India-egress relay activates the live parse.
- **Source URL:** [https://apsldc.in/](https://apsldc.in/)
- **Loader:** [`india-andhra-pradesh.json.ts`](../../src/data/india-andhra-pradesh.json.ts)
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

Andhra Pradesh has ~15 GW of solar capacity (Anantapur and Kadapa districts host some of India's largest solar parks) and significant curtailment driven by transmission constraints from the southern grid. The 0.4 TWh anchor is derived from POSOCO Southern Region 2024 residual after Tamil Nadu and Karnataka allocations. A direct APSLDC data pull will refine this once the parser is built and the India-egress relay is operational.

## Known limitations

The APSLDC live parser is not yet implemented. The site is geoblocked from non-Indian IP addresses, so the live path requires an India-egress relay to activate. The loader currently falls back to a typical-shape solar profile calibrated at 0.4 TWh/yr with a peak shape centred at UTC 06 (local noon ~12:30 IST).

## Links

- Loader source: [`india-andhra-pradesh.json.ts`](../../src/data/india-andhra-pradesh.json.ts)
- Backfill archive: `data/historical/backfill/*_india-andhra-pradesh_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
