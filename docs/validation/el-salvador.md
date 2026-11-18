# Validation — El Salvador (`el-salvador`)

Last updated: 2026-11-18 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `el-salvador`
- **Country:** SLV
- **Tier:** estimated
- **Kind:** solar
- **Source:** UT hourly solar generation by technology (estadistico.ut.com.sv Operación Diaria). Waste unpublished: UT publishes no curtailment series. The former 0.2 TWh/yr static (IRENA-derived, El Salvador VRE share) was modelled, not a UT figure, and was dropped on 2026-11-18.
- **Source URL:** [https://estadistico.ut.com.sv/OperacionDiaria.aspx](https://estadistico.ut.com.sv/OperacionDiaria.aspx)
- **Loader:** [`el-salvador.json.ts`](../../src/data/el-salvador.json.ts)
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

Generation only; waste is unpublished. The 30-day figure is the 14-day window's diurnal profile × 30. UT's pivot omits hours with no records, which for solar are night hours; a missing hour outside 08:00–16:59 is read as zero, and a day missing any hour inside it is skipped. UT's series goes back to at least 2018, so a backfill is possible. The 0.2 TWh/yr static this replaces was IRENA-derived, not a UT figure; against UT's ~0.8 TWh/yr of solar in November 2026 it implied about a quarter of output curtailed.

See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_el-salvador_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
