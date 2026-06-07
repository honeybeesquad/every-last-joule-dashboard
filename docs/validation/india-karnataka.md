# Validation — Karnataka (`india-karnataka`)

Last updated: 2026-06-07 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `india-karnataka`
- **Country:** IND
- **Tier:** estimated
- **Kind:** solar
- **Source:** KSLDC (Karnataka State Load Despatch Centre) — probed 2026-05-09 from Indian-IP Bangalore DO droplet: ksldc.in returns HTTP 200 but is a login-gated dashboard (username/password form). No public data paths — all sub-paths return 404. T1 blocked: authenticated portal only. Loader emits T3-modelled typical-shape calibrated to POSOCO South Region 2024 (~0.5 TWh/yr Karnataka solar curtailment).
- **Source URL:** [https://ksldc.in/](https://ksldc.in/)
- **Loader:** [`india-karnataka.json.ts`](../../src/data/india-karnataka.json.ts)
- **Structural gap:** no


<!-- BEGIN MANUAL -->
- **Region id:** `india-karnataka`
- **Country:** IND
- **Tier:** estimated
- **Source provenance:** `official-lead` — KSLDC publishes a live dashboard and curtailment PDFs (and is *not* geoblocked, unlike other Indian SLDCs), but the parser is not yet implemented. The energy-denominator gap on the older instruction PDFs is the load-bearing reason for `official-lead` rather than `verified`: an instruction percentage is not energy without a paired generation total — see bad-conversions checklist item 3. Until the parser ships AND the energy denominator is resolved, the loader emits a typical-shape T3 fallback. (See [tier-classification-guide.md#source-provenance-orthogonal-to-tier](../methodology/tier-classification-guide.md#source-provenance-orthogonal-to-tier).)
- **Kind:** solar
- **Source:** KSLDC (Karnataka State Load Despatch Centre) — real-time dashboard and curtailment PDFs at ksldc.in. Probed successfully in April 2026 coverage audit; parser not yet implemented. Loader currently emits T3-modelled typical-shape calibrated to POSOCO South Region 2024 (~0.5 TWh/yr Karnataka solar curtailment). Will be promoted to T1a-live-tso when the parser ships.
- **Source URL:** [https://ksldc.in/](https://ksldc.in/)
- **Loader:** [`india-karnataka.json.ts`](../../src/data/india-karnataka.json.ts)
- **Structural gap:** yes
<!-- END MANUAL -->
## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill


<!-- BEGIN MANUAL -->
- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill
<!-- END MANUAL -->
## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |


<!-- BEGIN MANUAL -->
| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |
<!-- END MANUAL -->
## Published anchors

- **TSO annual curtailment (latest published):** —
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —


<!-- BEGIN MANUAL -->
- **TSO annual curtailment (latest published):** —
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —
<!-- END MANUAL -->
## Discrepancy analysis

<!-- BEGIN MANUAL -->
Karnataka has ~15 GW of renewable capacity (predominantly solar, with significant wind) and is one of South India's largest RE states. The KSLDC publishes curtailment data on its public dashboard, making it the most directly accessible Indian SLDC in the April 2026 probe (all others returned ECONNREFUSED or timeouts). The 0.5 TWh anchor is derived as the South Region residual after allocating 1.0 TWh to Tamil Nadu wind; a direct KSLDC data pull is expected to refine this once the parser is built.
<!-- END MANUAL -->


<!-- BEGIN MANUAL -->
Karnataka has ~15 GW of renewable capacity (predominantly solar, with significant wind) and is one of South India's largest RE states. The KSLDC publishes curtailment data on its public dashboard, making it the most directly accessible Indian SLDC in the April 2026 probe (all others returned ECONNREFUSED or timeouts). The 0.5 TWh anchor is derived as the South Region residual after allocating 1.0 TWh to Tamil Nadu wind; a direct KSLDC data pull is expected to refine this once the parser is built.
<!-- END MANUAL -->


<!-- BEGIN MANUAL -->
Karnataka has ~15 GW of renewable capacity (predominantly solar, with significant wind) and is one of South India's largest RE states. The KSLDC publishes curtailment data on its public dashboard, making it the most directly accessible Indian SLDC in the April 2026 probe (all others returned ECONNREFUSED or timeouts). The 0.5 TWh anchor is derived as the South Region residual after allocating 1.0 TWh to Tamil Nadu wind; a direct KSLDC data pull is expected to refine this once the parser is built.
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
Karnataka has ~15 GW of renewable capacity (predominantly solar, with significant wind) and is one of South India's largest RE states. The KSLDC publishes curtailment data on its public dashboard, making it the most directly accessible Indian SLDC in the April 2026 probe (all others returned ECONNREFUSED or timeouts). The 0.5 TWh anchor is derived as the South Region residual after allocating 1.0 TWh to Tamil Nadu wind; a direct KSLDC data pull is expected to refine this once the parser is built.
<!-- END MANUAL -->
## Known limitations

<!-- BEGIN MANUAL -->
The KSLDC live parser is not yet implemented (though the site is accessible). The loader currently falls back to a typical-shape solar profile calibrated at 0.5 TWh/yr. Unlike the other Indian state SLDCs, KSLDC does not appear to be geoblocked from non-Indian IPs, so the live path should activate as soon as the parser is built without requiring an India-egress relay.
<!-- END MANUAL -->


<!-- BEGIN MANUAL -->
The KSLDC live parser is not yet implemented (though the site is accessible). The loader currently falls back to a typical-shape solar profile calibrated at 0.5 TWh/yr. Unlike the other Indian state SLDCs, KSLDC does not appear to be geoblocked from non-Indian IPs, so the live path should activate as soon as the parser is built without requiring an India-egress relay.
<!-- END MANUAL -->


<!-- BEGIN MANUAL -->
The KSLDC live parser is not yet implemented (though the site is accessible). The loader currently falls back to a typical-shape solar profile calibrated at 0.5 TWh/yr. Unlike the other Indian state SLDCs, KSLDC does not appear to be geoblocked from non-Indian IPs, so the live path should activate as soon as the parser is built without requiring an India-egress relay.
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
The KSLDC live parser is not yet implemented (though the site is accessible). The loader currently falls back to a typical-shape solar profile calibrated at 0.5 TWh/yr. Unlike the other Indian state SLDCs, KSLDC does not appear to be geoblocked from non-Indian IPs, so the live path should activate as soon as the parser is built without requiring an India-egress relay.
<!-- END MANUAL -->
## Links

- Loader source: [`india-karnataka.json.ts`](../../src/data/india-karnataka.json.ts)
- Backfill archive: `data/historical/backfill/*_india-karnataka_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)

<!-- BEGIN MANUAL -->
- Loader source: [`india-karnataka.json.ts`](../../src/data/india-karnataka.json.ts)
- Backfill archive: `data/historical/backfill/*_india-karnataka_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
See [`docs/methodology/tier-classification-guide.md#bad-conversions-you-must-reject`](../methodology/tier-classification-guide.md#bad-conversions-you-must-reject) for the full checklist. **Karnataka is the load-bearing positive example for item 3 — it is the working negative control showing the checklist correctly blocking a promotion.**

| # | Item | Verdict | Reason |
|---|------|---------|--------|
| 1 | DSM / deviation values used as curtailment | no | The KSLDC source publishes plant-level dispatch instructions and curtailment PDFs, not deviation tables. The current 0.5 TWh fallback anchor is calibrated to POSOCO South Region 2024, an explicit curtailment figure. |
| 2 | Capacity-at-risk MW used as curtailed energy MWh | no | The 0.5 TWh anchor is the South Region residual after allocating Tamil Nadu wind, both measured-energy figures. Not a `capacity × CF × rate` back-calculation. |
| 3 | **Instruction percentage without a generation denominator** | **YES** | This is **why the region stays `official-lead` and is not promoted to T1a-live-tso.** KSLDC's older instruction PDFs report the dispatch-down as a percentage of plant nameplate or schedule, with no paired generation total in the same publication. A percentage is dimensionless and cannot be converted to MWh without the matching generation MWh from the same operator covering the same window. Until either (a) the parser ships AND ingests the missing generation denominator, or (b) the operator starts publishing absolute MWh curtailed alongside the instruction percentage, Karnataka cannot be promoted. The bad-conversions checklist is doing exactly what it is meant to do — blocking a promotion that the data does not support. |
| 4 | Blank or dash treated as zero | no | Loader uses `withFallback` for missing data, not zero-coercion. |
| 5 | Modelled fallback labelled as verified measurement | no | Tier is T3-modelled with `sourceProvenance: "official-lead"`; the validation doc states explicitly that the hourly shape is synthetic. The (T1a, official-lead) red flag does not apply because the tier has not been over-claimed. |

This row is the canonical demonstration that a "yes" on the checklist correctly blocks a promotion. If a future contributor argues for promoting Karnataka without resolving item 3 first, this section is the source-of-truth rebuttal.
<!-- END MANUAL -->
