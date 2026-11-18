# Validation — Bolivia (`bolivia`)

Last updated: 2026-11-18 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `bolivia`
- **Country:** BOL
- **Tier:** estimated
- **Kind:** solar
- **Source:** CNDC 15-minute solar generation (cndc.bo wp-json rt/generacion). Waste unpublished: CNDC publishes no curtailment or spill series. The former 0.1 TWh/yr static (IRENA-derived, solar curtailment subset) was modelled, not a CNDC figure, and was dropped on 2026-11-18.
- **Source URL:** [https://www.cndc.bo/wp-json/cndc/v1/rt/generacion](https://www.cndc.bo/wp-json/cndc/v1/rt/generacion)
- **Loader:** [`bolivia.json.ts`](../../src/data/bolivia.json.ts)
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

Generation only; waste is unpublished. The 30-day figure is the 14-day window's diurnal profile × 30. CNDC's route answers from 2025-01-01 (2024-01-01 came back empty), so a backfill from 2025 is possible; its annual history route gives 0.355 TWh of solar for 2025. Against that annual total, the 0.1 TWh/yr static this replaces would mean over a quarter of solar output curtailed. CNDC's `datos-hidrologicos` and `embalses` routes carry reservoir levels and inflows, with no spill field.

See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_bolivia_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
