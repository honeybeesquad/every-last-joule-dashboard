# Validation — Norway NO3 (Trondheim) (`norway-no3`)

Last updated: 2026-04-30 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `norway-no3`
- **Country:** NOR
- **Tier:** live
- **Kind:** mixed
- **Source:** ENTSO-E NO3 hydro+onshore wind
- **Source URL:** [https://transparency.entsoe.eu/](https://transparency.entsoe.eu/)
- **Loader:** [`norway.json.ts`](../../src/data/norway.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** yes (per HB methodology §"Rate application over time")

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| 2020 | 17,559 | 0.880 | — | — | entsoe |
| 2021 | 17,519 | 0.844 | — | — | entsoe |
| 2022 | 17,518 | 0.922 | — | — | entsoe |
| 2023 | 17,520 | 0.752 | — | — | entsoe |
| 2024 | 17,566 | 0.722 | — | — | entsoe |
| 2025 | 17,520 | 0.877 | — | — | entsoe |
| 2026 | 5,448 | 0.297 | — | — | entsoe |

## Published anchors

- **TSO annual curtailment (latest published):** No directly-comparable broad-scope anchor available. Statnett, NVE, RME, and SSB do NOT publish per-price-area all-fuel curtailment in TWh. The narrow Statnett wind-only figure (~0.1 TWh 2024) excludes hydro spill, which dominates curtailment in this export-constrained zone (high reservoir levels at historic maximum throughout 2024 per SSB; NO3+NO4 hydro production rose 8.5→11.4 TWh year-over-year). Loader src/data/norway.json.ts uses ENTSO-E A75 B12 hydro + B19 wind × 4% rate, matching the methodology §2 broad-curtailment framing. Treat loader output as the best-available public estimate; this zone is excluded from |Δ%| calibration corpus pending publication of broad-scope anchor.
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** Narrow scope: Statnett NO3 ~0.1 TWh wind-only curtailment 2024 — NOT a valid comparator for the broad-scope hydro+wind loader. National context: Norway 2024 surplus 18 TWh (record); national hydro spillage estimated 8-10 TWh in normal precipitation years (energifaktanorge.no), likely higher in 2024 given extreme weather and full reservoirs.

## Discrepancy analysis

The 2024 backfill annual total of 0.722 TWh for `norway-no3` substantially overreports against the Statnett NO3 published anchor of ~0.1 TWh wind curtailment, showing a +622.3% delta. This significant discrepancy is definitional: the `norway.json.ts` loader aggregates curtailment from both hydro and onshore wind, whereas the cited Statnett anchor specifically refers to wind curtailment only. Given the substantial contribution of hydro generation in Norway, a direct comparison of the aggregated backfill total against a wind-only TSO anchor is not appropriate, and the reported delta does not reflect an error in the backfill methodology or rate application.

## Known limitations

*   The curtailment rate applied for `norway-no3` is an illustrative value, as no citable 2023/2024 annual curtailed-energy total for this region was found during the ENTSO-E rate audit.
*   Like other ENTSO-E zones, `norway-no3` may experience reporting-latency holes during upstream data outages, typically lasting 1–3 months. The backfill tolerates gaps up to 10% per year.
*   See `docs/methodology/historical-backfill.md` §"Known limitations" for additional cross-cutting notes applicable to all backfilled regions.

## Links

- Loader source: [`norway.json.ts`](../../src/data/norway.json.ts)
- Backfill archive: `data/historical/backfill/*_norway-no3_*.parquet` (7 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
