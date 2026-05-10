# Validation — E. Saudi Arabia (`e-saudi`)

Last updated: 2026-05-10 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `e-saudi`
- **Country:** SAU
- **Tier:** anchored
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

- **TSO annual curtailment (latest published):** GGFR 2024 East Saudi flaring ~5 Bcm ≈ 15 TWh equivalent
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

Base-load associated-gas flare region covering Ghawar and the broader Eastern Province oil corridor. GGFR 2024 anchor ~5 Bcm (≈15 TWh equivalent), the smallest of the four tracked flare basins; Saudi Aramco's Master Gas System has progressively absorbed associated gas into the domestic pipeline grid since 2014, which is why the e-saudi anchor is markedly below s-iraq and w-siberia despite Saudi's larger total oil output. Hourly shape is flat by construction — flaring is a 24/7 disposal mode tied to oilfield production, not a dispatchable response to grid signals — so Item 11 in `docs/known-limitations.md` (flare regions modelled as flat 24/7) applies. ±20% envelope reflecting GGFR's documented VIIRS-attribution uncertainty rather than the wider ±40% used for non-flare T3 regions. See `permian.md` for the canonical flat-shape justification.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_e-saudi_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
