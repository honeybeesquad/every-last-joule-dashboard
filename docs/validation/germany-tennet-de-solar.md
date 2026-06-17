# Validation — TenneT DE Solar (`germany-tennet-de-solar`)

Last updated: 2026-06-17 · Germany DE-LU → TSO control-area split · Granularity survey 2026-06-10

## Source

- **Region id:** `germany-tennet-de-solar`
- **Country:** DEU
- **Tier:** live-domestic-anchored
- **Kind:** solar
- **Source:** ENTSO-E Transparency A75 generation-per-type for the **TenneT DE** control area (EIC `10YDE-EON------1`): solar (B16 ×2.3%). Live ENTSO-E generation × the national BNetzA/SMARD curtailment rate apportioned by control area. National anchor on a sub-national (CTA) feed → **T1b (live-domestic-anchored)**, ±50% envelope.
- **Source URL:** [https://transparency.entsoe.eu/](https://transparency.entsoe.eu/)
- **Structural gap:** no

## Calibration

- **Rate:** solar (B16 ×2.3%), from the former germany-aggregate BNetzA/SMARD 2024 rates, applied to this CTA's own A75 generation.
- **Anchor basis:** BNetzA/SMARD 2024 national curtailment (4.56 TWh offshore + 3.38 TWh onshore wind; 1.39 TWh solar), apportioned to control areas. A BNetzA per-TSO Redispatch breakdown would upgrade this to measured per-CA curtailment.

## Published anchors

- **BNetzA per-TSO annual:** — (pending per-CA Redispatch figures)
- **ENTSO-E annual:** —

## Discrepancy analysis

_New region: the Germany DE-LU bidding zone (one ENTSO-E domain) split into its 4 TSO control areas (granularity survey 2026-06-10). ENTSO-E A75 live-probed per CTA-EIC on 2026-06-17 — B16/B19 present for all 4; B18 offshore only for the coastal CAs (50Hertz, TenneT). Replaces the former germany-wind/germany-solar aggregate. ±50% T1b envelope pending per-TSO BNetzA confirmation._

## Known limitations

- The curtailment rate is the BNetzA national rate split to control areas, not a BNetzA per-TSO published figure — hence T1b, not T1a. Offshore (B18) is applied only to the two coastal CAs (50Hertz, TenneT); the inland CAs (Amprion, TransnetBW) carry onshore wind only, matching the live A75 feed.

## Links

- Loader: ENTSO-E CTA zone config in [`entsoe.json.ts`](../../src/data/entsoe.json.ts)
- Methodology — tiers & live-data paths: [`docs/methodology/live-data-paths.md`](../methodology/live-data-paths.md)
