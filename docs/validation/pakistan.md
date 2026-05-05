# Validation — Pakistan (`pakistan`)

Last updated: 2026-05-05 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `pakistan`
- **Country:** PAK
- **Tier:** static
- **Kind:** mixed
- **Source:** NEPRA State of Industry Report 2024: Non-Project Missed Volume (NPMV) for wind power = 1,337 GWh FY2023-24 = PKR 39.5 billion in transmission-constrained dispatch-down compensation (Jhimpir/Gharo/Thatta wind corridor, Sindh). Solar curtailment exists but not separately quantified. Gemini-3.1 research wave 2 (2026-04-30).
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

- **TSO annual curtailment (latest published):** NTDC 2024 wind curtailment ~0.3 TWh (Jhimpir cluster)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

Region is a **structural gap**: no public hourly archive available, so backfill is not possible. Current live snapshot is populated from an annual anchor (Ember / IRENA / GGFR) and scaled by a typical-day profile where applicable. See `docs/known-limitations.md` for the full structural-gap list.

## Links

- Loader source: [`pakistan.json.ts`](../../src/data/pakistan.json.ts)
- Backfill archive: `data/historical/backfill/*_pakistan_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
