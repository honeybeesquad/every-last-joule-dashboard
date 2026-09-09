# Validation — Karnataka (`india-karnataka`)

Last updated: 2026-05-07 · Sprint: India source-lock triage · Paper section: Technical Validation §4.2

## Source

- **Region id:** `india-karnataka`
- **Country:** IND
- **Tier:** static
- **Kind:** solar
- **Source:** KPTCL/KSLDC (Karnataka State Load Despatch Centre) — public dashboard and official `RE Curtailment Details` PDFs at `kptclsldc.in`. A research probe now source-locks six one-page curtailment-instruction PDFs, but they provide instruction percentages/windows rather than source-verified MWh. Loader currently emits T3-modelled typical-shape calibrated to POSOCO South Region 2024 (~0.5 TWh/yr Karnataka solar curtailment).
- **Source URL:** [https://kptclsldc.in/recurtail.aspx](https://kptclsldc.in/recurtail.aspx)
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

Karnataka has ~15 GW of renewable capacity (predominantly solar, with significant wind) and is one of South India's largest RE states. The KPTCL/KSLDC public page exposes an official `RE Curtailment Details` tree with six PDFs. The research probe resolves ASP.NET TreeView postbacks to direct encoded URLs and extracts seven instruction rows from six one-page PDFs. These rows are not energy observations: they are percentage curtailment instructions such as 10%, 20-30%, 30%, and split 15%/25% intervals. A denominator search found the official `loadwindhis.aspx` historical LoadWindSolar page, but the visible archive is 2026-era and does not cover the 2019/2021/2024 instruction dates. The 0.5 TWh anchor remains a T3 fallback until instruction windows can be paired with contemporaneous RE generation/availability data.

## Known limitations

The KSLDC live parser is not yet implemented (though the source PDFs are accessible). The loader currently falls back to a typical-shape solar profile calibrated at 0.5 TWh/yr. The official PDFs support an instruction-event layer, not a curtailed-energy layer. Do not convert instruction percentages to MWh without a matching generation/availability denominator for the same interval.

## Links

- Loader source: [`india-karnataka.json.ts`](../../src/data/india-karnataka.json.ts)
- Research probe: [`karnataka-curtailment-postback-probe.mjs`](../../scripts/research/karnataka-curtailment-postback-probe.mjs)
- Instruction inventory: [`2026-05-07-karnataka-curtailment-instruction-inventory.md`](../research/2026-05-07-karnataka-curtailment-instruction-inventory.md)
- Denominator search: [`2026-05-07-karnataka-denominator-search.md`](../research/2026-05-07-karnataka-denominator-search.md)
- Backfill archive: `data/historical/backfill/*_india-karnataka_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
