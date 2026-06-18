# Validation — Bahamas (`bahamas`)

Last updated: 2026-06-18 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `bahamas`
- **Country:** BHS
- **Tier:** estimated
- **Kind:** solar
- **Source:** IRENA RCS 2025 / BPL (~20 MW solar + oil; island grids)
- **Source URL:** [https://www.irena.org/Data/Downloads/IRENASTAT](https://www.irena.org/Data/Downloads/IRENASTAT)
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

T3 static region. Annual anchor from IRENA with typical-day profile. See `docs/known-limitations.md`.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_bahamas_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
