# Validation — Saudi Arabia (solar) (`saudi-solar`)

Last updated: 2026-05-04 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `saudi-solar`
- **Country:** SAU
- **Tier:** static
- **Kind:** solar
- **Source:** GASTAT 2024 (5.2% curtailment ~0.8 TWh; grid constraints vs Sudair/Sakaka/NEOM scale-up). Gemini-3.1 research wave 4 (2026-04-30).
- **Source URL:** [https://www.stats.gov.sa/](https://www.stats.gov.sa/)
- **Loader:** [`saudi-solar.json.ts`](../../src/data/saudi-solar.json.ts)
- **Structural gap:** yes

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** SEC 2024 PV curtailment ~0.1 TWh (early-stage)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No public hourly archive. The Saudi Electricity Company (`se.com.sa`) and ECRA publish annual capacity additions and aggregate generation but no hourly PV curtailment series — the National Grid SA TSO operates a vertically integrated single-buyer model that does not surface dispatch-down data publicly, mirroring the UAE pattern. The loader emits a typical solar shape (peak UTC 10, reflecting Arabia Standard Time midday) scaled to a ~0.1 TWh/yr anchor for early-stage clipping at Sakaka, Sudair, and Al Shuaibah utility-scale PV plants — small compared to Saudi's nameplate but real, given thermal-baseload-dominated dispatch and limited grid storage. T3-modelled, ±40% envelope; cross-listed in `docs/known-limitations.md` Item 14 alongside Jordan, UAE, Oman, and Israel as part of the Middle-East coverage-first fallback group. Anchor revision welcome if SEC publishes 2025 PV dispatch data — Saudi's 2030 130 GW solar target makes this region likely to grow into the dataset's Tier 2 anchors over the medium term. Methodologically distinct from `e-saudi` (associated-gas flare, kept separate per the flare-vs-renewable taxonomy in §4.2 of the paper).

## Links

- Loader source: [`saudi-solar.json.ts`](../../src/data/saudi-solar.json.ts)
- Backfill archive: `data/historical/backfill/*_saudi-solar_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
