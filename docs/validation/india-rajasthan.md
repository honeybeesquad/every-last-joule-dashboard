# Validation — Rajasthan (`india-rajasthan`)

Last updated: 2026-05-04 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `india-rajasthan`
- **Country:** IND
- **Tier:** static
- **Kind:** solar
- **Source:** RRVPNL SLDC (Rajasthan State Load Despatch Centre) — RE curtailment downloads at sldc.rajasthan.gov.in. Geoblocked from non-Indian IP ranges; loader currently emits T3-modelled typical-shape calibrated to Ember India 2025 (~3.5 TWh/yr solar curtailment). Will be promoted to T1a-live-tso when the India-egress relay activates the live parse.
- **Source URL:** [https://sldc.rajasthan.gov.in/](https://sldc.rajasthan.gov.in/)
- **Loader:** [`india-rajasthan.json.ts`](../../src/data/india-rajasthan.json.ts)
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

The RRVPNL SLDC website (`sldc.rajasthan.gov.in`, `rrvpnl.org`) is unreachable from non-Indian IP ranges (ECONNREFUSED / timeout from the build environment). The live path is therefore inactive until an India-egress relay is established. Current data is a typical solar shape calibrated to the Ember India 2025 Rajasthan anchor (3.5 TWh/yr). The region was renamed from `india-rajasthan` — the previous name implied NRLDC northern-region coverage but the calibration was Rajasthan-specific. Rajasthan holds India's largest solar capacity additions (7.09 GW in 2024) and is the dominant driver of northern-India solar curtailment.

## Links

- Loader source: [`india-rajasthan.json.ts`](../../src/data/india-rajasthan.json.ts)
- Backfill archive: `data/historical/backfill/*_india-rajasthan_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
