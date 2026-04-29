# Validation - Philippines (`philippines`)

Last updated: 2026-04-29 · Sprint: data-quality coverage · Paper section: Technical Validation §4.2

## Source

- **Region id:** `philippines`
- **Country:** PHL
- **Tier:** static
- **Kind:** solar
- **Source:** IEMOP/NGCP/PEMC fallback
- **Source URL:** [https://www.iemop.ph/the-market/market-data/](https://www.iemop.ph/the-market/market-data/)
- **Loader:** [`statics.json.ts`](../../src/data/statics.json.ts)
- **Structural gap:** yes

## Calibration

- **Rate source documented in:** `data/coverage-audit/2026-04-26-asia-southeast.csv` and `data/coverage-audit/master/global-audit-2026-04-28.csv`
- **Uniform across backfill years:** n/a - no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Delta % | Source |
|---|---:|---:|---:|---:|---|
| _(no backfill or TSO anchors yet)_ | | | | | |

## Published Anchors

- **TSO annual curtailment (latest published):** not published as a machine-readable annual curtailment total
- **Ember annual:** -
- **IRENA annual:** Philippines VRE / island-grid stress used as broad context only
- **Other:** IEMOP public market-data pages expose WESM downloadable CSV categories, including registered generation capacity and SO dispatch-instruction / MOT redispatch reports.

## Discrepancy Analysis

The dashboard now includes one national Philippines T3 row rather than three duplicated NGCP/IEMOP/PEMC rows. IEMOP is the operational WESM data source; NGCP is the system operator; PEMC is the market-governance body. The current model uses a conservative 0.5 TWh/yr solar-shaped fallback centered on Philippine local noon (UTC 04:00).

IEMOP's public `Registered Capacity - Generation` CSV confirms renewable resource identifiers such as `SOL` and `WIND`, which is useful for a future unit/fuel join. The sampled latest `List of MOT-Raise Re-Dispatch based on SO Dispatch Instruction Report` CSV was structurally available but empty for the latest week, so it is not yet a defensible measured curtailment series.

## Known Limitations

This is deliberately T3-modelled. It should not be promoted to T2/T1 until we can either obtain a published annual curtailed-energy anchor or parse non-empty, repeatable IEMOP dispatch-down / redispatch files and join them to resource fuel types without hand classification.

## Links

- IEMOP Market Data: [https://www.iemop.ph/the-market/market-data/](https://www.iemop.ph/the-market/market-data/)
- IEMOP Registered Capacity - Generation: [https://www.iemop.ph/market-data/registered-capacity-generation/](https://www.iemop.ph/market-data/registered-capacity-generation/)
- IEMOP MOT redispatch report list: [https://www.iemop.ph/market-data/list-of-mot-raise-re-dispatch-based-on-so-dispatch-instruction-report/](https://www.iemop.ph/market-data/list-of-mot-raise-re-dispatch-based-on-so-dispatch-instruction-report/)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
