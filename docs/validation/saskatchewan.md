# Validation — Saskatchewan (`saskatchewan`)

Last updated: 2026-11-18 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `saskatchewan`
- **Country:** CAN
- **Tier:** estimated
- **Kind:** wind
- **Source:** No curtailment series collected; grid present, waste unpublished. SaskPower publishes one generation-by-fuel snapshot a day, not a series. The former ~0.15 TWh/yr wind-curtailment shape served here had no source: its loader never read SaskPower, and the SaskPower Annual Report 2024 ~0.2 TWh anchor in the validation file has no URL and was inferred, so it was dropped on 2026-11-18.
- **Source URL:** [https://www.saskpower.com/](https://www.saskpower.com/)
- **Loader:** _(unpublished grid marker — see `src/lib/tso-grid-markers.ts`)_
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** none found. `scripts/validation/external-anchors.json` lists "SaskPower 2024 wind curtailment ~0.2 TWh" (method `inferred`, provenance `saskpower-2024-annual` with no URL, added by an AI pass on 2026-04-26); it is unverified and no longer served.
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: `src/lib/tso-grid-markers.ts` (unpublished grid marker)
- Backfill archive: `data/historical/backfill/*_saskatchewan_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
