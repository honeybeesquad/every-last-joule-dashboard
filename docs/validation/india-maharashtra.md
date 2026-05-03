# Validation — Maharashtra (`india-maharashtra`)

Last updated: 2026-05-02 · Sprint: India W3 · Paper section: Technical Validation §4.2

## Source

- **Region id:** `india-maharashtra`
- **Country:** IND
- **Tier:** live (T1a — MSLDC direct live path)
- **Kind:** mixed
- **Source:** MSLDC (Maharashtra State Load Despatch Centre / MSEDCL) — RE curtailment and system data at msldc.mahavedha.com. Geoblocked from non-Indian IP ranges; India-egress relay activates live path. Calibrated to POSOCO Western Region 2024 (~0.3 TWh/yr mixed solar+wind curtailment; Solapur solar + Satara/Dhule wind corridor). T1a-live-tso, ±15% fallback.
- **Source URL:** [https://msldc.mahavedha.com/](https://msldc.mahavedha.com/)
- **Loader:** [`india-maharashtra.json.ts`](../../src/data/india-maharashtra.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated once MSLDC parser is complete)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** POSOCO 2024 Western Region (~0.3 TWh/yr mixed solar+wind; Solapur solar parks + Satara/Dhule wind corridor)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** MNRE 2024 MW-weighted capacity split: 55% solar / 45% wind

## Discrepancy analysis

Maharashtra has ~20 GW of renewable capacity with a significant wind legacy (Satara, Dhule, Osmanabad districts) and fast-growing solar (Solapur). Curtailment arises from the Konkan transmission corridor and Western Region inter-state constraints. The 0.3 TWh anchor is conservative relative to capacity, reflecting Maharashtra's relatively better grid integration compared to Rajasthan and Gujarat. The 55/45 solar/wind split is based on MNRE 2024 installed capacity weighting. A direct MSLDC data pull will refine both the total and the mix once the parser is built.

## Known limitations

The MSLDC live parser is not yet implemented. The site is geoblocked from non-Indian IP addresses, so the live path requires an India-egress relay to activate. The loader currently falls back to a typical-shape mixed profile (55% solar + 45% wind) calibrated at 0.3 TWh/yr with solar peak centred at UTC 07 and wind baseline spread across all hours.

## Links

- Loader source: [`india-maharashtra.json.ts`](../../src/data/india-maharashtra.json.ts)
- Backfill archive: `data/historical/backfill/*_india-maharashtra_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
