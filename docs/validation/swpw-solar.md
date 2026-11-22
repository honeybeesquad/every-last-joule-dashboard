# Validation — SPP West Solar (`swpw-solar`)

Last updated: 2026-11-22 · Sprint: TSO-grid completeness, SPP VER measured · Paper section: Technical Validation §4.2

## Source

- **Region id:** `swpw-solar`
- **Country:** USA
- **Tier:** live
- **Kind:** solar
- **Source:** SPP VER Curtailments measured curtailment, SWPW; EIA-930 SWPW generation, waste unpublished if the report is unavailable
- **Source URL:** [https://portal.spp.org/pages/ver-curtailments](https://portal.spp.org/pages/ver-curtailments)
- **Loader:** [`swpw.json.ts`](../../src/data/swpw.json.ts) (parser shared with [`spp.json.ts`](../../src/data/spp.json.ts))
- **Structural gap:** no
- **Waste status:** measured from the SWPW rows of SPP's daily VER Curtailments report (wind/solar Redispatch + Manual, 5-minute intervals; CurtailedForEnergy is a subset of Redispatch and is left out). When the report cannot be read, the region serves EIA-930 generation only with waste unpublished. Missing ≠ zero.

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** —
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

SPP took over the former WACM balancing authority on 2026-04-01 as SWPW. The VER report's `BAA=SWPW` rows and EIA-930 respondent SWPW are the same balancing authority. The 30 days to 2026-11-20 measured about 0.002 TWh wind and 0.021 TWh solar curtailment. The committed snapshot predates the move and is generation-only (waste unpublished), so a zero `profile` there is not a measured finding.

## Known limitations

See `docs/methodology/historical-backfill.md` and STATUS.md TSO-grid completeness.

## Links

- Backfill archive: `data/historical/backfill/*_swpw-solar_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
