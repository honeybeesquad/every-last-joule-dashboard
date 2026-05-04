# Validation — Italy North (`italy-north-zone`)

Last updated: 2026-05-04 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `italy-north-zone`
- **Country:** ITA
- **Tier:** live-domestic-anchored
- **Kind:** mixed
- **Source:** ENTSO-E Terna (North zone)
- **Source URL:** [https://transparency.entsoe.eu/](https://transparency.entsoe.eu/)
- **Loader:** _(no single-file loader — see multi-region source)_
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** yes (per HB methodology §"Rate application over time")

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2020 | 11,085 | 0.043 | — | — | entsoe |
| 2021 | 11,392 | 0.043 | — | — | entsoe |
| 2022 | 11,848 | 0.047 | — | — | entsoe |
| 2023 | 12,674 | 0.051 | — | — | entsoe |
| 2024 | 13,239 | 0.059 | 0.108 | -45.0% | entsoe |
| 2025 | 13,778 | 0.077 | — | — | entsoe |
| 2026 | 4,013 | 0.020 | — | — | entsoe |

## Published anchors

- **TSO annual curtailment (latest published):** MODELLED: 35% of Terna 2024 national 0.31 TWh RES curtailment anchor = ~0.108 TWh. The 35/45/20 zonal split (north/south/sardinia) is a modelling assumption based on bidding-zone congestion patterns in Terna 2023 RES Integration Report, NOT a directly-published Terna per-zone figure. Used for src/data/entsoe.json.ts rate calibration. Follow-up: hunt Terna Rapporto Adeguatezza Annuale for actual per-zone published figures and replace this modelled split if found.
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** Broader Terna 'zonal overflow redispatch' ~1.1 TWh is a different metric (redispatch, not RES curtailment).

## Discrepancy analysis

The 2024 backfill annual curtailment of 0.059 TWh for Italy North significantly underreports the Terna 2024 North zone anchor of ~0.108 TWh by 45.0%. This material discrepancy is primarily due to rate under-calibration and definitional differences in the available public data.

The ENTSO-E audit found no citable, published bidding-zone curtailment split from Terna for 2024, leading to the use of acknowledged placeholder rates for solar and wind generation. Our current calculation relies on these placeholder rates multiplied by generation, which does not fully capture the TSO's reported curtailment. The TSO anchor itself is derived from a national total (35% of Terna national 0.31 TWh RES curtailment anchor), suggesting a scope mismatch where our zonal generation-times-rate model may not align with the components included in the Terna national figure and its subsequent allocation to zones.

## Known limitations

- The rates applied for solar and wind curtailment in the `italy-north-zone` are acknowledged placeholders, as Terna does not publish a specific bidding-zone curtailment split. These should be considered illustrative floor/ceiling values rather than measured annual calibrations.
- The TSO annual curtailment anchor for 2024 is an allocation (35% of Terna national RES curtailment) rather than a direct zonal publication, contributing to the noted discrepancy and introducing definitional ambiguity.
- The loader relies on editorial national-to-zone allocation notes due to the absence of direct zonal curtailment data from Terna.
- Our generation-times-rate model for this region does not account for the broader Terna 'zonal overflow redispatch' metric (~1.1 TWh), which represents a different but potentially related category of grid management.
- The discrepancy for 2024 (45.0%) exceeds the 25% flagging threshold for backfill annual totals, indicating a significant divergence between our modelled output and the published anchor.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_italy-north-zone_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
