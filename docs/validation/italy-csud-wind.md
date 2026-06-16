# Validation — Italy Centre-South Wind (`italy-csud-wind`)

Last updated: 2026-06-17 · ENTSO-E Italian bidding zone · Granularity survey 2026-06-10

## Source

- **Region id:** `italy-csud-wind`
- **Country:** ITA
- **Tier:** live-domestic-anchored
- **Kind:** wind
- **Source:** ENTSO-E Transparency A75 generation-per-type for Italian bidding zone **CSUD** (EIC `10Y1001A1001A71M`), psrType `B19`. Live hourly generation × the Terna national curtailment rate apportioned to this zone. National anchor on a sub-national feed → **T1b (live-domestic-anchored)**, ±50% envelope.
- **Source URL:** [https://transparency.entsoe.eu/](https://transparency.entsoe.eu/)
- **Structural gap:** no

## Calibration

- **Rate:** 0.6% of ENTSO-E A75 wind generation for zone CSUD.
- **Anchor basis:** Terna 2024 national curtailment, split by zone share. A Terna download-center per-zone XLSX would upgrade this to measured per-zone curtailment (future T1a).

## Published anchors

- **Terna per-zone annual:** — (pending Terna XLSX)
- **ENTSO-E annual:** —

## Discrepancy analysis

_New zone (granularity survey 2026-06-10). Completes Italy's 7-zone partition (was 3 of 7 modelled). ENTSO-E A75 live-probed 2026-06-17 (both B16/B19 non-empty). ±50% T1b envelope pending Terna per-zone confirmation._

## Known limitations

- The calibration rate is a zone-share of the Terna national anchor, not a Terna per-zone published figure — hence T1b, not T1a. Terna's download center would upgrade this.

## Links

- Loader: ENTSO-E zone config in [`entsoe.json.ts`](../../src/data/entsoe.json.ts)
- Methodology — live-data paths & tier rule: [`docs/methodology/live-data-paths.md`](../methodology/live-data-paths.md)
