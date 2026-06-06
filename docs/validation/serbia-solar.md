# Validation — Serbia Solar (`serbia-solar`)

Last updated: 2026-06-06 · Reverted live→estimated (ENTSO-E A75 B16 unreliable) · Paper section: Technical Validation §4.2

## Source

- **Region id:** `serbia-solar`
- **Country:** SRB
- **Tier:** estimated (reverted from live 2026-06-06)
- **Kind:** solar
- **Source:** IRENA RCS 2025 (modelled-fallback anchor)
- **Source URL:** [https://www.irena.org/Publications/2025/Mar/Renewable-capacity-statistics-2025](https://www.irena.org/Publications/2025/Mar/Renewable-capacity-statistics-2025)
- **Loader:** `statics.json.ts` anchor (was `entsoe.json.ts` ZONES)
- **Structural gap:** no

## Revert rationale

ENTSO-E A75 B16 (solar PV) data for EMS Serbia ceased returning usable data around 2026-05-13. Investigation showed this is structural:

- Serbia is a non-EU **Energy Community Contracting Party**, not an EU member state.
- EU Regulation 543/2013 (which mandates A75 generation reporting) **does not legally bind** non-EU Energy Community TSOs.
- Energy Community TSOs are "encouraged" to submit data but are not obligated to do so consistently.
- Serbia-wind (B19) continues to work because wind reporting has better compliance; solar (B16) lapsed.

## Calibration

- **Installed capacity:** 241 MW end-2024 (80 MW added in 2024); 318 MW end-2025 (source: pv-magazine 2025–2026)
- **Annual generation (modelled):** ~0.12 TWh/yr at 1500 FLH
- **Curtailment rate:** 2% (regional default; USEA 2022 study noted curtailment negligible at current capacity levels)
- **Annual curtailment anchor:** 0.007 TWh/yr
- **localSolarPeakUTC:** 10.5 (Serbia ~21°E; solar noon ≈ UTC 10:36)

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill — modelled anchor only)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** — (not published)
- **IRENA annual:** ~0.007 TWh modelled (IRENA RCS 2025 capacity basis)
- **Other:** pv-magazine Serbia installs 134.3 MW in 2025 (Jan 2026)

## Known limitations

ENTSO-E B16 data for Serbia is non-compliant as Serbia is a non-EU Energy Community TSO. Curtailment at current capacity (241–318 MW) is likely genuinely small; the USEA 2022 large-scale RES integration study noted curtailment only occurs in high-penetration scenarios (≫1 GW). This anchor should be revisited if Serbia's solar capacity grows substantially (>500 MW) or if a machine-readable national curtailment source becomes available.

## Links

- Loader source: `src/data/statics.json.ts` (anchor key: `"serbia-solar"`)
- Backfill archive: `data/historical/backfill/*_serbia-solar_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
