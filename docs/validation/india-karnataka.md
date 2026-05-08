# Validation — Karnataka (`india-karnataka`)

Last updated: 2026-05-05 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `india-karnataka`
- **Country:** IND
- **Tier:** static
- **Source provenance:** `official-lead` — KSLDC publishes a live dashboard and curtailment PDFs (and is *not* geoblocked, unlike other Indian SLDCs), but the parser is not yet implemented. The energy-denominator gap on the older instruction PDFs is the load-bearing reason for `official-lead` rather than `verified`: an instruction percentage is not energy without a paired generation total — see bad-conversions checklist item 3. Until the parser ships AND the energy denominator is resolved, the loader emits a typical-shape T3 fallback. (See [tier-classification-guide.md#source-provenance-orthogonal-to-tier](../methodology/tier-classification-guide.md#source-provenance-orthogonal-to-tier).)
- **Kind:** solar
- **Source:** KSLDC (Karnataka State Load Despatch Centre) — real-time dashboard and curtailment PDFs at ksldc.in. Probed successfully in April 2026 coverage audit; parser not yet implemented. Loader currently emits T3-modelled typical-shape calibrated to POSOCO South Region 2024 (~0.5 TWh/yr Karnataka solar curtailment). Will be promoted to T1a-live-tso when the parser ships.
- **Source URL:** [https://ksldc.in/](https://ksldc.in/)
- **Loader:** [`india-karnataka.json.ts`](../../src/data/india-karnataka.json.ts)
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

Karnataka has ~15 GW of renewable capacity (predominantly solar, with significant wind) and is one of South India's largest RE states. The KSLDC publishes curtailment data on its public dashboard, making it the most directly accessible Indian SLDC in the April 2026 probe (all others returned ECONNREFUSED or timeouts). The 0.5 TWh anchor is derived as the South Region residual after allocating 1.0 TWh to Tamil Nadu wind; a direct KSLDC data pull is expected to refine this once the parser is built.

## Known limitations

The KSLDC live parser is not yet implemented (though the site is accessible). The loader currently falls back to a typical-shape solar profile calibrated at 0.5 TWh/yr. Unlike the other Indian state SLDCs, KSLDC does not appear to be geoblocked from non-Indian IPs, so the live path should activate as soon as the parser is built without requiring an India-egress relay.

## Links

- Loader source: [`india-karnataka.json.ts`](../../src/data/india-karnataka.json.ts)
- Backfill archive: `data/historical/backfill/*_india-karnataka_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
