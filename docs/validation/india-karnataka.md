# Validation — Karnataka (`india-karnataka`)

Last updated: 2026-10-19 · Sprint: India nationwide CEA residual · Paper section: Technical Validation §4.2

## Source

- **Region id:** `india-karnataka`
- **Country:** IND
- **Tier:** estimated
- **Kind:** solar
- **Source:** CEA gen-re.cea.gov.in daily Excel × Ember India 2024 2% rate (≈0.36 TWh/yr at ~18 TWh/yr solar, trailing 365 days to 2026-10-15). KSLDC (ksldc.in) is login-gated — not the live source. Instruction PDFs still lack an energy denominator (item 3). Hourly shape is synthetic. Not a measured TSO series.
- **Source URL:** [https://gen-re.cea.gov.in/](https://gen-re.cea.gov.in/)
- **Loader:** [`india-karnataka.json.ts`](../../src/data/india-karnataka.json.ts)
- **Structural gap:** no


<!-- BEGIN MANUAL -->
- **Region id:** `india-karnataka`
- **Country:** IND
- **Tier:** estimated
- **Source provenance:** `official-lead` — KSLDC publishes a live dashboard and curtailment PDFs (and is *not* geoblocked, unlike other Indian SLDCs), but the parser is not yet implemented. The energy-denominator gap on the older instruction PDFs is the load-bearing reason for `official-lead` rather than `verified`: an instruction percentage is not energy without a paired generation total — see bad-conversions checklist item 3. Until the parser ships AND the energy denominator is resolved, the loader emits CEA generation × Ember 2%, not a measured TSO series. (See [tier-classification-guide.md#source-provenance-orthogonal-to-tier](../methodology/tier-classification-guide.md#source-provenance-orthogonal-to-tier).)
- **Kind:** solar
- **Source:** CEA gen-re.cea.gov.in daily Excel × Ember India 2024 2% rate. KSLDC (ksldc.in) is login-gated — not the live source. Instruction PDFs still lack an energy denominator (item 3). Will be promoted to T1a-live-tso only when an SLDC energy series exists. The previous 0.5 TWh POSOCO stub is no longer plotted.
- **Source URL:** [https://ksldc.in/](https://ksldc.in/)
- **Loader:** [`india-karnataka.json.ts`](../../src/data/india-karnataka.json.ts)
- **Structural gap:** yes
<!-- END MANUAL -->
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

<!-- BEGIN MANUAL -->
Karnataka has ~15 GW of renewable capacity (predominantly solar, with significant wind) and is one of South India's largest RE states. The plotted series is CEA gen-re daily Excel × Ember India 2024 2% (~0.36 TWh/yr at ~18 TWh/yr solar). The previous 0.5 TWh POSOCO South Region residual stub is no longer plotted. KSLDC instruction PDFs still lack an energy denominator (item 3), so this is not T1a.
<!-- END MANUAL -->
## Known limitations

<!-- BEGIN MANUAL -->
The KSLDC live parser is not yet implemented. The loader uses CEA generation × Ember 2% (~0.36 TWh/yr), not the retired 0.5 TWh POSOCO stub. Instruction PDFs still lack an energy denominator, so Karnataka stays T3 `official-lead` until an SLDC energy series exists.
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
- Research (May 2026, not production): the official `RE Curtailment Details` PDFs at `kptclsldc.in/recurtail.aspx` (still public 2026-09-10; six one-page instruction PDFs, 2019–2024) — probe [`karnataka-curtailment-postback-probe.mjs`](../../scripts/research/karnataka-curtailment-postback-probe.mjs); instruction inventory [`2026-05-07-karnataka-curtailment-instruction-inventory.md`](../research/2026-05-07-karnataka-curtailment-instruction-inventory.md); denominator search [`2026-05-07-karnataka-denominator-search.md`](../research/2026-05-07-karnataka-denominator-search.md). Confirms item 3 below: percentages and windows, no interval generation denominator.
<!-- END MANUAL -->
<!-- BEGIN MANUAL -->
See [`docs/methodology/tier-classification-guide.md#bad-conversions-you-must-reject`](../methodology/tier-classification-guide.md#bad-conversions-you-must-reject) for the full checklist. **Karnataka is the load-bearing positive example for item 3 — it is the working negative control showing the checklist correctly blocking a promotion.**

| # | Item | Verdict | Reason |
|---|------|---------|--------|
| 1 | DSM / deviation values used as curtailment | no | The KSLDC source publishes plant-level dispatch instructions and curtailment PDFs, not deviation tables. The plotted series is CEA generation × Ember 2% (~0.36 TWh/yr). The retired 0.5 TWh POSOCO South Region residual is no longer used. |
| 2 | Capacity-at-risk MW used as curtailed energy MWh | no | CEA MU (GWh) is energy, not a `capacity × CF × rate` back-calculation. Ember supplies only the rate. |
| 3 | **Instruction percentage without a generation denominator** | **YES** | This is **why the region stays `official-lead` and is not promoted to T1a-live-tso.** KSLDC's older instruction PDFs report the dispatch-down as a percentage of plant nameplate or schedule, with no paired generation total in the same publication. A percentage is dimensionless and cannot be converted to MWh without the matching generation MWh from the same operator covering the same window. Until either (a) the parser ships AND ingests the missing generation denominator, or (b) the operator starts publishing absolute MWh curtailed alongside the instruction percentage, Karnataka cannot be promoted. The bad-conversions checklist is doing exactly what it is meant to do — blocking a promotion that the data does not support. |
| 4 | Blank or dash treated as zero | no | Loader uses `withFallback` for missing data, not zero-coercion. |
| 5 | Modelled fallback labelled as verified measurement | no | Tier is T3-modelled with `sourceProvenance: "official-lead"`; the validation doc states explicitly that the hourly shape is synthetic. The (T1a, official-lead) red flag does not apply because the tier has not been over-claimed. |

This row is the canonical demonstration that a "yes" on the checklist correctly blocks a promotion. If a future contributor argues for promoting Karnataka without resolving item 3 first, this section is the source-of-truth rebuttal.
<!-- END MANUAL -->
