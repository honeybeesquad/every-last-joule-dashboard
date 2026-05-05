# Validation — Pakistan Solar (`pakistan-solar`)

Last updated: 2026-05-05 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `pakistan-solar`
- **Country:** PAK
- **Tier:** static
- **Kind:** solar
- **Source:** NEPRA State of Industry Report 2024: solar curtailment not separately quantified, held conservatively at ~10% of total. Gemini-3.1 research wave 2 (2026-04-30).
- **Source URL:** [https://nepra.org.pk/publications/State%20of%20Industry%20Reports/State%20of%20Industry%20Report%202024.pdf](https://nepra.org.pk/publications/State%20of%20Industry%20Reports/State%20of%20Industry%20Report%202024.pdf)
- **Loader:** [`pakistan.json.ts`](../../src/data/pakistan.json.ts)
- **Structural gap:** yes

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

Region is a **structural gap**: no public hourly archive available, so backfill is not possible. Current live snapshot is populated from an annual anchor (Ember / IRENA / GGFR) and scaled by a typical-day profile where applicable. See `docs/known-limitations.md` for the full structural-gap list.

## Links

- Loader source: [`pakistan.json.ts`](../../src/data/pakistan.json.ts)
- Backfill archive: `data/historical/backfill/*_pakistan-solar_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
