# Validation — North Macedonia Solar (`north-macedonia-solar`)

Last updated: 2026-06-06 · Reverted live→estimated (ENTSO-E A75 B16 unreliable) · Paper section: Technical Validation §4.2

## Source

- **Region id:** `north-macedonia-solar`
- **Country:** MKD
- **Tier:** estimated
- **Kind:** solar
- **Source:** IRENA RCS 2025 / pv-magazine 2026 (modelled-fallback anchor)
- **Source URL:** [https://www.irena.org/Publications/2025/Mar/Renewable-capacity-statistics-2025](https://www.irena.org/Publications/2025/Mar/Renewable-capacity-statistics-2025)
- **Loader:** `statics.json.ts` anchor (was `entsoe.json.ts` ZONES)
- **Structural gap:** no

## Revert rationale

ENTSO-E A75 B16 (solar PV) data for MEPSO North Macedonia ceased returning usable data around 2026-05-13. Investigation showed this is structural:

- North Macedonia is a non-EU **Energy Community Contracting Party**, not an EU member state.
- EU Regulation 543/2013 **does not legally bind** non-EU Energy Community TSOs.
- The Energy Community Secretariat Annual Implementation Report 2023 explicitly found: *"Transparency is well below the level required in North Macedonia"* and *"Reporting obligations have not been transposed in legislation."*
- North Macedonia-wind (B19) continues to work with better compliance; solar (B16) lapsed.

**Note on scale:** North Macedonia's solar capacity is growing rapidly — 833 MW installed by end-2024 (65% annual growth), ~1.2 GW by end-2025. Solar generation is already influencing day-ahead power exchange prices. The 0.02 TWh/yr anchor will understate actual curtailment as the grid continues to absorb this capacity.

## Calibration

- **Installed capacity:** 833 MW end-2024; ~1,200 MW end-2025 (source: IRENA RCS 2025, pv-magazine Feb 2026)
- **Annual generation (modelled):** ~1.1 TWh/yr at 1,300 FLH (2,400–2,600 sunshine hours/yr)
- **Curtailment rate:** 2% (regional default; curtailment is real given solar driving power exchange prices but no published rate available)
- **Annual curtailment anchor:** 0.02 TWh/yr (likely understates as capacity grows)
- **localSolarPeakUTC:** 10.5 (North Macedonia ~21.5°E; solar noon ≈ UTC 10:30)

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill — modelled anchor only)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** — (not published)
- **IRENA annual:** ~0.02 TWh modelled (IRENA RCS 2025 capacity basis)
- **Other:** pv-magazine — North Macedonia adds 210 MW of solar in 2025 (Feb 2026); Balkan Green Energy News — solar production driving prices on North Macedonia power exchange (2024)

## Known limitations

MEPSO B16 reporting is non-compliant per the Energy Community Secretariat (IR 2023). The 0.02 TWh/yr anchor is based on end-2024 capacity; with 1.2 GW installed by end-2025 and strong curtailment signals from power exchange price impacts, the true figure is likely 0.03–0.05 TWh/yr and growing. This anchor is a known underestimate and should be recalibrated if a national curtailment source (e.g. MEPSO annual report or power exchange data) becomes machine-readable.

## Links

- Loader source: `src/data/statics.json.ts` (anchor key: `"north-macedonia-solar"`)
- Backfill archive: `data/historical/backfill/*_north-macedonia-solar_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
