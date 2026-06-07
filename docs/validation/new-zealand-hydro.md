# Validation — New Zealand Hydro (`new-zealand-hydro`)

Last updated: 2026-06-07 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `new-zealand-hydro`
- **Country:** NZL
- **Tier:** live
- **Kind:** hydro
- **Source:** EMI DispatchNodalPricesAndVolumes ≤$0/MWh nodal price signal (Waitaki corridor, Manapouri, Waikato)
- **Source URL:** [https://emidatasets.blob.core.windows.net/publicdata/Datasets/Wholesale/DispatchAndPricing/NodalPricesAndVolumes](https://emidatasets.blob.core.windows.net/publicdata/Datasets/Wholesale/DispatchAndPricing/NodalPricesAndVolumes)
- **Loader:** _(no single-file loader — see multi-region source)_
- **Structural gap:** no

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

The ≤$0 threshold is conservative: it will miss curtailment that clears at small positive prices due to bilateral contracts or inter-island constraints not reflected in the spot price. This is the same conservatism that the AEMO loader exhibits for soft-SEMIDISPATCHCAP cases. The dataset documents this as a lower bound on actual curtailment.

Only nodes in the static POC fuel map contribute. Well-known but less common hydro nodes (e.g., Clyde CLY2201, Roxburgh ROX0111, Livingstone LIV0332) are not included in v1.4.0 to preserve correctness. Their contribution would increase the hydro total if added.

## Known limitations

1. **Static POC map is conservative.** Only 13 hydro POC codes are mapped. Nodes outside the map are silently skipped. This means the dataset captures the Waitaki corridor and Manapouri reliably but may miss smaller South Island or North Island hydro nodes.
2. **UTC+12 constant.** NZ transitions between NZST (UTC+12) and NZDT (UTC+13). The loader uses UTC+12 constantly, consistent with the existing NZ codebase. This introduces a 1-hour timestamp shift for ~6 months per year. Curtailment totals are unaffected; the time-of-day profile is slightly misaligned during DST.
3. **Recent days unpublished.** EMI typically publishes DispatchNodalPricesAndVolumes files 1–2 days after the trading day. The loader fetches 35 days back, stopping when 30 loaded days are accumulated. The data window is therefore usually 2–32 days ago, not 0–30.
4. **Solar coverage is minimal.** NZ has few grid-scale solar POCs with known codes; `new-zealand-solar` will typically show near-zero curtailment from this loader. This is expected and correct — NZ's solar market is small and embedded generation (rooftop) does not appear in dispatch data.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_new-zealand-hydro_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
