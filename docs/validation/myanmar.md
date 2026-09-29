# Validation — Myanmar (`myanmar`)

Last updated: 2026-09-29 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `myanmar`
- **Country:** MMR
- **Tier:** estimated
- **Kind:** solar
- **Source:** No curtailment series collected; grid present, waste unpublished. Its former 0.2 TWh/yr anchor (IRENA RE Statistics 2024) was 1.7× Myanmar's 2024 solar generation of 0.12 TWh (Our World in Data, from Ember and the Energy Institute), so it was dropped on 2026-09-29.
- **Source URL:** [https://www.irena.org/Data/Energy-Profiles](https://www.irena.org/Data/Energy-Profiles)
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

_Pending: no backfill parquet yet for this region. Once HB.1 / HB.2 land the per-year totals for this region, this section will summarise the Δ vs TSO/Ember/IRENA and flag any year exceeding ±25%._

## Known limitations

No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_myanmar_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
