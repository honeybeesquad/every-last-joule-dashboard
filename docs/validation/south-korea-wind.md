# Validation — South Korea Wind (`south-korea-wind`)

Last updated: 2026-08-20 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `south-korea-wind`
- **Country:** KOR
- **Tier:** estimated
- **Kind:** wind
- **Source:** Curtailment = Ember/OWID 2025 wind generation 3.64 TWh × 4.1% published 2024 curtailment rate (MDPI 2024, citing IEA; mainland excl. Jeju). KPX live feed needs a serviceKey (Korean identity verification) — documented blocker, not wired.
- **Source URL:** [https://ourworldindata.org/grapher/electricity-mix?country=KOR&metric=share_of_generation&source=wind](https://ourworldindata.org/grapher/electricity-mix?country=KOR&metric=share_of_generation&source=wind)
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

- **TSO annual curtailment (latest published):** —
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor parquet. Region relies on the published IEA/KPX annual anchor split across the typical-shape profile; solar reads 0 at local night by construction._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_south-korea-wind_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
