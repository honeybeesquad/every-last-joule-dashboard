# Validation — New Zealand Hydro (new-zealand-hydro)

Last updated: 2026-05-24 · Sprint: v1.4.0 NZ nodal-price migration · Paper section: Technical Validation §4.2

## Source

- **Loader:** `src/data/new-zealand.json.ts`
- **Source:** NZ Electricity Authority EMI — DispatchNodalPricesAndVolumes daily CSVs
- **Source URL:** `https://emidatasets.blob.core.windows.net/publicdata/Datasets/Wholesale/DispatchAndPricing/NodalPricesAndVolumes/{year}/{YYYYMMDD}_DispatchNodalPricesAndVolumes.csv`
- **Kind:** hydro
- **Tier:** live
- **Source provenance:** verified (published by the Electricity Authority, a statutory regulator)
- **Fuel focus:** Hydro — Waitaki corridor (Benmore, Aviemore, Ohau A/B/C, Tekapo A/B, Twizel), Manapouri (Southland), Whakamaru and Aratiatia (Waikato river)

## Calibration

- **Rate applied:** None. The ≤$0/MWh nodal price is used directly as the constraint indicator.
- **Rate provenance:** N/A — this is a direct market signal, not a generation × rate proxy.
- **Applies uniformly across backfill years:** N/A

### Methodology note

When a node clears at or below $0/MWh in the NZ real-time dispatch market, the generation at that node is constrained — the grid cannot absorb it at positive value. This is structurally identical to AEMO's SEMIDISPATCHCAP binary flag: both express the same condition (generation forced to be capped by network or demand constraints) via the market's own clearing mechanism. No scaling or calibration rate is needed.

Curtailment MW at each qualifying (price ≤ $0, node in fuel map) trading period is taken as the `GenerationMegawatts` field directly. Multiple POC nodes within the same fuel type and trading period are summed.

## Cross-check against external anchors

### Live-feed 30-day snapshot (latest snapshot)

| Metric | Value | Provenance |
|---|---|---|
| 30-day total TWh | to be populated after first live run | Live loader, first snapshot post-v1.4.0 |
| Peak hourly GW | to be populated after first live run | Live loader, first snapshot post-v1.4.0 |

### Published anchors

- **MBIE "Energy in New Zealand" electricity chapter:** Hydro spill and wasted generation not published as a reconciled annual total; the MBIE bulletin reports generation by fuel but not curtailment/spill explicitly.
- **Transpower System Operator (SO) reports:** The SO annual "Generation Adequacy" and "Electricity Demand and Generation Scenarios" documents do not publish a single curtailment TWh figure. Hydro storage and inflow data are published separately.
- **Conceptual sanity check:** NZ hydro capacity is ~5.5 GW. Curtailment occurs during high-inflow / low-demand periods (typically South Island winter, spring snowmelt). Expected magnitude is low-frequency, multi-GW events rather than constant baseline. A 30-day total in the range of 0.05–0.5 TWh during normal months, and potentially 0.5–2 TWh during high-inflow months, is plausible. Near-zero totals in dry periods are also expected.

## Discrepancy analysis

The ≤$0 threshold is conservative: it will miss curtailment that clears at small positive prices due to bilateral contracts or inter-island constraints not reflected in the spot price. This is the same conservatism that the AEMO loader exhibits for soft-SEMIDISPATCHCAP cases. The dataset documents this as a lower bound on actual curtailment.

Only nodes in the static POC fuel map contribute. Well-known but less common hydro nodes (e.g., Clyde CLY2201, Roxburgh ROX0111, Livingstone LIV0332) are not included in v1.4.0 to preserve correctness. Their contribution would increase the hydro total if added.

## Known limitations

1. **Static POC map is conservative.** Only 13 hydro POC codes are mapped. Nodes outside the map are silently skipped. This means the dataset captures the Waitaki corridor and Manapouri reliably but may miss smaller South Island or North Island hydro nodes.
2. **UTC+12 constant.** NZ transitions between NZST (UTC+12) and NZDT (UTC+13). The loader uses UTC+12 constantly, consistent with the existing NZ codebase. This introduces a 1-hour timestamp shift for ~6 months per year. Curtailment totals are unaffected; the time-of-day profile is slightly misaligned during DST.
3. **Recent days unpublished.** EMI typically publishes DispatchNodalPricesAndVolumes files 1–2 days after the trading day. The loader fetches 35 days back, stopping when 30 loaded days are accumulated. The data window is therefore usually 2–32 days ago, not 0–30.
4. **Solar coverage is minimal.** NZ has few grid-scale solar POCs with known codes; `new-zealand-solar` will typically show near-zero curtailment from this loader. This is expected and correct — NZ's solar market is small and embedded generation (rooftop) does not appear in dispatch data.

## Links

- Loader: [`src/data/new-zealand.json.ts`](../../src/data/new-zealand.json.ts)
- Methodology: [`docs/methodology/tier-classification-guide.md`](../methodology/tier-classification-guide.md)
- EMI forum on new Azure Blob access: `https://forum.emi.ea.govt.nz/thread/new-access-arrangements-to-emi-datasets-retirement-of-anonymous-ftp/`
