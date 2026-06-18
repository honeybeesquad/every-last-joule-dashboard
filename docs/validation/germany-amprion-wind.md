# Validation — Amprion Wind (`germany-amprion-wind`)

Last updated: 2026-06-18 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `germany-amprion-wind`
- **Country:** DEU
- **Tier:** live-domestic-anchored
- **Kind:** wind
- **Source:** ENTSO-E Amprion CTA wind (BNetzA/SMARD rate)
- **Source URL:** [https://transparency.entsoe.eu/](https://transparency.entsoe.eu/)
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

_New region: the Germany DE-LU bidding zone (one ENTSO-E domain) split into its 4 TSO control areas (granularity survey 2026-06-10). ENTSO-E A75 live-probed per CTA-EIC on 2026-06-17 — B16/B19 present for all 4; B18 offshore only for the coastal CAs (50Hertz, TenneT). Replaces the former germany-wind/germany-solar aggregate. ±50% T1b envelope pending per-TSO BNetzA confirmation._

## Known limitations

- The curtailment rate is the BNetzA national rate split to control areas, not a BNetzA per-TSO published figure — hence T1b, not T1a. Offshore (B18) is applied only to the two coastal CAs (50Hertz, TenneT); the inland CAs (Amprion, TransnetBW) carry onshore wind only, matching the live A75 feed.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_germany-amprion-wind_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
