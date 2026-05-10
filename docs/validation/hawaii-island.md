# Validation — Hawaii (Big Island) (`hawaii-island`)

Last updated: 2026-05-10 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `hawaii-island`
- **Country:** USA
- **Tier:** estimated
- **Kind:** mixed
- **Source:** Hawaiian Electric historical curtailment XLSX 2026-05-09: Hawaii Island 2024 = 1.9 GWh curtailed from curtailable renewables. Annual file only — no daily/monthly programmatic feed. T1 not achievable.
- **Source URL:** [https://www.hawaiianelectric.com/documents/about_us/key_performance_metrics/historical/historical_03_curtailment.xlsx](https://www.hawaiianelectric.com/documents/about_us/key_performance_metrics/historical/historical_03_curtailment.xlsx)
- **Loader:** _(no single-file loader — see multi-region source)_
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** Hawaiian Electric 2024 Big Island curtailment ~0.1 TWh
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_hawaii-island_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
