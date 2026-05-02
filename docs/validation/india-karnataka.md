# Validation — Karnataka (`india-karnataka`)

Last updated: 2026-05-02 · Sprint: India W2 · Paper section: Technical Validation §4.2

## Source

- **Region id:** `india-karnataka`
- **Country:** IND
- **Tier:** live (T1a — KSLDC direct live path)
- **Kind:** solar
- **Source:** KSLDC (Karnataka State Load Despatch Centre) — real-time dashboard and curtailment PDFs at ksldc.in. KSLDC was reachable (HTTP 200) from non-Indian IPs in the April 2026 coverage audit; full parser not yet implemented. Calibrated to POSOCO South Region 2024 (~0.5 TWh/yr Karnataka solar curtailment; Pavagada + Bidar solar parks). T1a-live-tso, ±15% fallback.
- **Source URL:** [https://ksldc.in/](https://ksldc.in/)
- **Loader:** [`india-karnataka.json.ts`](../../src/data/india-karnataka.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated once KSLDC parser is complete)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** POSOCO 2024 South Region residual after Tamil Nadu wind (~0.5 TWh/yr Karnataka solar; Pavagada Solar Park, Bidar)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

Karnataka has ~15 GW of renewable capacity (predominantly solar, with significant wind) and is one of South India's largest RE states. The KSLDC publishes curtailment data on its public dashboard, making it the most directly accessible Indian SLDC in the April 2026 probe (all others returned ECONNREFUSED or timeouts). The 0.5 TWh anchor is derived as the South Region residual after allocating 1.0 TWh to Tamil Nadu wind; a direct KSLDC data pull is expected to refine this once the parser is built.

## Known limitations

The KSLDC live parser is not yet implemented (though the site is accessible). The loader currently falls back to a typical-shape solar profile calibrated at 0.5 TWh/yr. Unlike the other Indian state SLDCs, KSLDC does not appear to be geoblocked from non-Indian IPs, so the live path should activate as soon as the parser is built without requiring an India-egress relay.

## Links

- Loader source: [`india-karnataka.json.ts`](../../src/data/india-karnataka.json.ts)
- Backfill archive: `data/historical/backfill/*_india-karnataka_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
