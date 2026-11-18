# Validation — Nicaragua (`nicaragua`)

Last updated: 2026-11-18 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `nicaragua`
- **Country:** NIC
- **Tier:** estimated
- **Kind:** solar
- **Source:** CNDC hourly solar generation by type (cndc.org.ni consultarGeneracionPorTipo), captured nightly because CNDC serves the current day only. Waste unpublished: CNDC publishes no curtailment series. The former 0.1 TWh/yr anchor (IRENA Nicaragua VRE statistics 2024) was 3.3× Nicaragua's 2024 solar generation of 0.03 TWh (Our World in Data, from Ember and the Energy Institute), so it was dropped on 2026-09-29.
- **Source URL:** [https://www.cndc.org.ni/graficos/consultarGeneracionPorTipo](https://www.cndc.org.ni/graficos/consultarGeneracionPorTipo)
- **Loader:** [`nicaragua.json.ts`](../../src/data/nicaragua.json.ts) (capture: `scripts/capture/nicaragua-cndc.ts`, `.github/workflows/nicaragua-capture.yml`)
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

Generation only; waste is unpublished. CNDC serves the current Nicaragua-time day only, with no date parameter, so history exists only from the nightly capture, which began on 2026-11-18. A day counts when it has local hours 00:00–19:00; until seven such days exist the loader serves an empty unpublished record that says so. The 30-day figure is the window's diurnal profile × 30. If the capture workflow stops, the series goes stale and the loader marks it `degraded` after four days.

See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_nicaragua_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
