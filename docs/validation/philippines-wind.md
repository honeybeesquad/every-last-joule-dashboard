# Validation — Philippines Wind (`philippines-wind`)

Last updated: 2026-05-02 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `philippines-wind`
- **Country:** PHL
- **Tier:** static
- **Kind:** wind
- **Source:** IRENA Philippines RE Statistics 2024 anchor; IEMOP RTD endpoint exposes current-day dispatch schedules, not curtailed-energy. The 2% rate previously applied was an invented placeholder with no published source. Held at T3 until IEMOP/WESM publishes a citable curtailment rate.
- **Source URL:** [https://www.iemop.ph/market-data/rtd-prices-and-schedules/](https://www.iemop.ph/market-data/rtd-prices-and-schedules/)
- **Loader:** [`philippines.json.ts`](../../src/data/philippines.json.ts)
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

_Pending: no backfill parquet yet for this region. Once HB.1 / HB.2 land the per-year totals for this region, this section will summarise the Δ vs TSO/Ember/IRENA and flag any year exceeding ±25%._

## Known limitations

Region is a **structural gap**: no public hourly archive available, so backfill is not possible. Current live snapshot is populated from an annual anchor (Ember / IRENA / GGFR) and scaled by a typical-day profile where applicable. See `docs/known-limitations.md` for the full structural-gap list.

## Links

- Loader source: [`philippines.json.ts`](../../src/data/philippines.json.ts)
- Backfill archive: `data/historical/backfill/*_philippines-wind_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
