# Validation — Guatemala (`guatemala`)

Last updated: 2026-11-18 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `guatemala`
- **Country:** GTM
- **Tier:** estimated
- **Kind:** solar
- **Source:** AMM hourly solar generation by fuel (IRRADIACIÓN; wl12.amm.org.gt graficaCombustible). Waste unpublished: AMM publishes no curtailment series. The former 0.4 TWh/yr IRENA anchor was dropped on 2026-09-29 (with guatemala-siepac's 0.1 it came to 1.8× Guatemala's 2024 solar generation of 0.28 TWh, Our World in Data).
- **Source URL:** [https://wl12.amm.org.gt/GraficaPW/graficaCombustible](https://wl12.amm.org.gt/GraficaPW/graficaCombustible)
- **Loader:** [`guatemala.json.ts`](../../src/data/guatemala.json.ts)
- **Structural gap:** no

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

_Pending: no backfill parquet yet for this region. Once HB.1 / HB.2 land the per-year totals for this region, this section will summarise the Δ vs TSO/Ember/IRENA and flag any year exceeding ±25%._

## Known limitations

Generation only; waste is unpublished. AMM solar output roughly quadrupled between mid-2025 (peak ~107 MW on 2025-06-15) and late 2026 (peak ~467 MW on 2026-10-15), so a 30-day window run-rate (~1.2 TWh/yr in November 2026) is well above the 2024 OWID figure of 0.28 TWh. AMM's endpoint returned no data before about 2025-05-20. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_guatemala_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
