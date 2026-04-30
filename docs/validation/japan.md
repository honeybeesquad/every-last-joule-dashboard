# Validation — Japan (`japan`)

Last updated: 2026-04-27 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `japan`
- **Country:** JPN
- **Tier:** live
- **Kind:** solar
- **Source:** Kyushu Electric area-demand CSV (5-min solar) × 10% calibrated curtailment (Kyushu 2024 anchor: ~1.7 TWh/yr)
- **Source URL:** [https://www.kyuden.co.jp/td_power_usages/pc.html](https://www.kyuden.co.jp/td_power_usages/pc.html)
- **Loader:** [`japan.json.ts`](../../src/data/japan.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** METI/OCCTO 2024 wind+solar curtailment ~2.5 TWh (Kyushu dominant)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_30-day live total should land near 1.7 × (30/365) ≈ 0.14 TWh per the Phase-2.6 calibration sanity-check. If a future expansion adds Tohoku/Chubu/TEPCO area CSVs the anchor rises to ~2.0 TWh/yr; until then this loader treats Kyushu as the Japan signal._

## Known limitations

**Promoted to `T1a-live-tso` (2026-04-26)** via the Kyushu Electric area-demand CSV. The loader fetches `https://www.kyuden.co.jp/td_power_usages/csv/juyo-hourly-YYYYMMDD.csv` daily for the trailing 30 days, decodes the upstream's Shift-JIS bytes via Node 20's built-in `TextDecoder('shift-jis')` (no `iconv-lite` dependency), locates the 5-minute solar section by its 4-column `DATE,TIME,...,...` header (column-count signature avoids any reliance on Japanese header text), converts JST timestamps to UTC, and applies a 10% calibration rate to the 万kW solar generation column — calibrated against the 2024 Kyushu solar curtailment ~1.7 TWh / ~16 TWh solar generation ratio. Kyushu is not the whole of Japan, but it carries the bulk of OCCTO-reported nationwide solar curtailment since 2018; per-area expansion (TEPCO/Tohoku/Chubu) is a follow-up brief. JEPX historical CSV remains an alternative reference.

See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`japan.json.ts`](../../src/data/japan.json.ts)
- Backfill archive: `data/historical/backfill/*_japan_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
