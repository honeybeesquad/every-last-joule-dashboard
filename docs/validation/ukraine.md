# Validation — Ukraine (`ukraine`)

Last updated: 2026-05-04 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `ukraine`
- **Country:** UKR
- **Tier:** static
- **Kind:** solar
- **Source:** Ember Ukraine 2024 (ENTSO-E absent post-war)
- **Source URL:** [https://ember-energy.org/global-insights/ukraine-electricity-tracker/](https://ember-energy.org/global-insights/ukraine-electricity-tracker/)
- **Loader:** _(no single-file loader — see multi-region source)_
- **Structural gap:** yes

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** Ember 2024 Ukraine (ENTSO-E absent post-war); ~0.4 TWh solar curtailment
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

Region is a **structural gap**: no public hourly archive available, so backfill is not possible. Current live snapshot is populated from an annual anchor (Ember / IRENA / GGFR) and scaled by a typical-day profile where applicable. See `docs/known-limitations.md` for the full structural-gap list.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_ukraine_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
