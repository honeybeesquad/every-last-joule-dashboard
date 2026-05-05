# Validation — UAE (`uae`)

Last updated: 2026-05-05 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `uae`
- **Country:** ARE
- **Tier:** static
- **Kind:** solar
- **Source:** DEWA/EWEC fallback
- **Source URL:** [https://www.dewa.gov.ae/](https://www.dewa.gov.ae/)
- **Loader:** [`uae.json.ts`](../../src/data/uae.json.ts)
- **Structural gap:** yes

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** DEWA/EWEC 2024 PV curtailment low
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No public hourly archive. DEWA (`dewa.gov.ae`) and EWEC (Emirates Water and Electricity Company) publish annual capacity and generation figures but no hourly PV curtailment — UAE's vertically integrated single-buyer model does not produce a public dispatch-down series comparable to ENTSO-E or AEMO. The loader emits a typical solar shape (peak UTC 8, reflecting the late-morning Gulf Standard Time peak) scaled to a 0.2 TWh/yr anchor reflecting Mohammed bin Rashid Solar Park and Al Dhafra clipping during midday over-supply windows. T3-modelled, ±40% envelope; cross-listed in `docs/known-limitations.md` Item 14 as part of the Middle-East coverage-first fallback group (Jordan, Saudi solar, UAE, Oman, Israel) where private-grid data restrictions preclude live integration. Anchor revision welcome if EWEC publishes 2025 PV dispatch series.

## Links

- Loader source: [`uae.json.ts`](../../src/data/uae.json.ts)
- Backfill archive: `data/historical/backfill/*_uae_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
