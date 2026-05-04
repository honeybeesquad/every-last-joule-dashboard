# Validation — S. Iraq (`s-iraq`)

Last updated: 2026-05-04 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `s-iraq`
- **Country:** IRQ
- **Tier:** flare
- **Kind:** flare
- **Source:** VIIRS + GGFR
- **Source URL:** [https://www.worldbank.org/en/programs/gasflaringreduction](https://www.worldbank.org/en/programs/gasflaringreduction)
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

- **TSO annual curtailment (latest published):** GGFR 2024 South Iraq flaring ~20 Bcm ≈ 58 TWh equivalent
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

Base-load associated-gas flare region covering Basra, Rumaila, West Qurna, Majnoon, and the wider southern Iraq oilfield cluster. GGFR 2024 anchor ~20 Bcm (≈58 TWh equivalent), the largest single tracked flare basin in the dataset and roughly 14% of global flaring by volume. Iraq is a 2030-zero-routine-flaring signatory but project economics and limited gas-capture infrastructure have kept actual reduction slow; flare volumes have remained broadly flat 2019–2024 with mild downward trend since the Basra Gas Company expansion. Hourly shape is flat by construction — flaring is a 24/7 disposal mode tied to crude production, not grid-driven curtailment — so Item 11 in `docs/known-limitations.md` (flare regions modelled as flat 24/7) applies. ±20% envelope reflecting GGFR's documented VIIRS-attribution uncertainty. Distinct from `iraq-mainland` (PV) and `kurdistan` (PV) which sit in the renewable-curtailment pillar of the dataset. See `permian.md` for the canonical flat-shape justification.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_s-iraq_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
