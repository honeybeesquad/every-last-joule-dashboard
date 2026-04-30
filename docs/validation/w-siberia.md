# Validation — W. Siberia (`w-siberia`)

Last updated: 2026-04-30 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `w-siberia`
- **Country:** RUS
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

- **TSO annual curtailment (latest published):** GGFR 2024 West Siberia flaring ~15 Bcm ≈ 44 TWh equivalent
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

Base-load associated-gas flare region covering Khanty-Mansiysk, Yamalo-Nenets, and the wider West Siberian oil province. GGFR 2024 anchor ~15 Bcm (≈44 TWh equivalent), second-largest in the tracked set after s-iraq. Russia's flaring increased post-2022 as Western gas-capture investment was withdrawn under sanctions and several gas-utilisation projects were paused or cancelled; the 2024 figure is roughly +25% vs the 2020 GGFR baseline despite the country's nominal flare-reduction policy. Hourly shape is flat by construction — flaring is a 24/7 disposal mode tied to crude production, not grid-driven curtailment — so Item 11 in `docs/known-limitations.md` (flare regions modelled as flat 24/7) applies. ±20% envelope reflecting GGFR's documented VIIRS-attribution uncertainty (slightly wider than usual given partial Russian satellite-overpass coverage gaps). Distinct from `russia-mainland` (hydro spill) and `russia-murmansk-wind` (transmission-export-limited wind) which both sit in the renewable-curtailment pillar. See `permian.md` for the canonical flat-shape justification.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_w-siberia_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
