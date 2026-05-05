# Validation — GB Scotland (`gb-scotland`)

Last updated: 2026-05-05 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `gb-scotland`
- **Country:** GBR
- **Tier:** live
- **Kind:** wind
- **Source:** Elexon BMRS wind+solar (Scotland share, ~70% via NESO constraint boundary)
- **Source URL:** [https://www.neso.energy/data-portal/monthly-operational-metered-wind-output](https://www.neso.energy/data-portal/monthly-operational-metered-wind-output)
- **Loader:** _(no single-file loader — see multi-region source)_
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2024 | — | — | 7.700 | — | — |

## Published anchors

- **TSO annual curtailment (latest published):** NESO 2024 constraint actions ~11 TWh total, ~70% Scottish wind
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** NESO Markets Roadmap 2024

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_gb-scotland_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
