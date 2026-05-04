# Validation — Russia (European grid) (`russia-mainland`)

Last updated: 2026-05-04 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

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

No public hourly archive accessible post-2022. SO UES (`so-ups.ru`) public pages do not expose unauthenticated hourly hydro-spill data, and Western sanctions plus reciprocal Russian access restrictions have foreclosed the previously available API endpoints. The loader emits a hydro-seasonal shape (`HYDRO_SEASONAL_SHARES["russia-mainland"]`) scaled to a ~1 TWh/yr anchor for European Russia hydro spill (primarily Volga / Kama cascades during spring melt). T3-modelled, ±40% envelope; see `docs/known-limitations.md` item 14 ("Russia (European grid) uses 1 TWh/yr seasonal hydro spill"). W. Siberia remains a separate flare region (Item 11) and is not reclassified here.

## Links

- Loader source: [`russia-mainland.json.ts`](../../src/data/russia-mainland.json.ts)
- Backfill archive: `data/historical/backfill/*_russia-mainland_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
