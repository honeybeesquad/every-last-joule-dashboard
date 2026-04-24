# Validation — Russia (European grid) (`russia-mainland`)

Last updated: 2026-04-24 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `russia-mainland`
- **Country:** RUS
- **Tier:** static
- **Kind:** hydro
- **Source:** SO UES fallback
- **Source URL:** [https://www.so-ups.ru/](https://www.so-ups.ru/)
- **Loader:** [`russia-mainland.json.ts`](../../src/data/russia-mainland.json.ts)
- **Structural gap:** yes

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** SO UPS no public data; structural gap
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

Structural gap: no public hourly archive accessible post-2022.

## Links

- Loader source: [`russia-mainland.json.ts`](../../src/data/russia-mainland.json.ts)
- Backfill archive: `data/historical/backfill/*_russia-mainland_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
