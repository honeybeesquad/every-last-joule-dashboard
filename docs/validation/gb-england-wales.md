# Validation — GB England+Wales (`gb-england-wales`)

Last updated: 2026-04-26 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `gb-england-wales`
- **Country:** GBR
- **Tier:** live
- **Kind:** mixed
- **Source:** Elexon BMRS wind+solar (England+Wales share)
- **Source URL:** [https://www.elexon.co.uk/data/](https://www.elexon.co.uk/data/)
- **Loader:** _(no single-file loader — see multi-region source)_
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2024 | — | — | 3.300 | — | — |

## Published anchors

- **TSO annual curtailment (latest published):** NESO 2024 constraint actions ~11 TWh total, ~30% E+W share
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_gb-england-wales_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
