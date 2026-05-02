# Validation — Rajasthan (`india-rajasthan`)

Last updated: 2026-05-02 · Sprint: India W1 · Paper section: Technical Validation §4.2

## Source

- **Region id:** `india-rajasthan`
- **Country:** IND
- **Tier:** live (T1a — RRVPNL SLDC; live path activates when India-egress relay is available)
- **Kind:** solar
- **Source:** RRVPNL SLDC (Rajasthan State Load Despatch Centre) RE curtailment downloads. Geoblocked from non-Indian IP ranges; current build uses typical-shape fallback at Ember 2025 anchor.
- **Source URL:** [https://sldc.rajasthan.gov.in/](https://sldc.rajasthan.gov.in/)
- **Loader:** [`india-rajasthan.json.ts`](../../src/data/india-rajasthan.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** Rajasthan FY24-25 RE generation 57.35 BU (43.86% of 130.77 BU); solar curtailment per Ember India 2025 ~3.5 TWh/yr (transmission bottlenecks)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

The RRVPNL SLDC website (`sldc.rajasthan.gov.in`, `rrvpnl.org`) is unreachable from non-Indian IP ranges (ECONNREFUSED / timeout from the build environment). The live path is therefore inactive until an India-egress relay is established. Current data is a typical solar shape calibrated to the Ember India 2025 Rajasthan anchor (3.5 TWh/yr). The region was renamed from `india-rajasthan` — the previous name implied NRLDC northern-region coverage but the calibration was Rajasthan-specific. Rajasthan holds India's largest solar capacity additions (7.09 GW in 2024) and is the dominant driver of northern-India solar curtailment.

## Links

- Loader source: [`india-rajasthan.json.ts`](../../src/data/india-rajasthan.json.ts)
- Backfill archive: `data/historical/backfill/*_india-rajasthan_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
