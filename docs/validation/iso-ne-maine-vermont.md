# Validation — ISO-NE Maine/Vermont (`iso-ne-maine-vermont`)

Last updated: 2026-05-02 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `iso-ne-maine-vermont`
- **Country:** USA
- **Tier:** live
- **Kind:** wind
- **Source:** EIA ISO-NE wind (ME+VT share, 93% of NE curtailment per IMM)
- **Source URL:** [https://www.iso-ne.com/static-assets/documents/100023/2024-annual-markets-report.pdf](https://www.iso-ne.com/static-assets/documents/100023/2024-annual-markets-report.pdf)
- **Loader:** _(no single-file loader — see multi-region source)_
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2024 | — | — | 0.032 | — | — |

## Published anchors

- **TSO annual curtailment (latest published):** ISO-NE ~0.034 TWh renewable curtailment (2024 IMM) × 93% ME/VT share
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_iso-ne-maine-vermont_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
