# Validation — Tasmania Wind (`aemo-tas-wind`)

Last updated: 2026-06-21 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `aemo-tas-wind`
- **Country:** AUS
- **Tier:** live
- **Kind:** wind
- **Source:** AEMO NEMWeb wind SEMIDISPATCHCAP
- **Source URL:** [https://nemweb.com.au/Reports/Current/Next_Day_Dispatch/](https://nemweb.com.au/Reports/Current/Next_Day_Dispatch/)
- **Loader:** [`aemo.json.ts`](../../src/data/aemo.json.ts)
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

Wind units are selected from the local AEMO DUID fuel map. The child row is single-fuel and does not carry `fuelShare`.

## Links

- Loader source: [`aemo.json.ts`](../../src/data/aemo.json.ts)
- Backfill archive: `data/historical/backfill/*_aemo-tas-wind_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
