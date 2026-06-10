# Validation — Peru Solar (`peru-solar`)

Last updated: 2026-06-10 · Sprint: Peru Solar EDI integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `peru-solar`
- **Country:** PER
- **Tier:** live-domestic-anchored
- **Kind:** solar
- **Source:** COES RER Energía Dejada de Inyectar reports + COES live daily solar generation by company × 2% curtailment calibration
- **Source URL:** [https://www.coes.org.pe/Portal/PostOperacion/Informes/MagEnergiaDejadaInyectar](https://www.coes.org.pe/Portal/PostOperacion/Informes/MagEnergiaDejadaInyectar)
- **Loader:** [`peru.json.ts`](../../src/data/peru.json.ts)
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
- **Other:** COES EDI reports show southern solar EDI rows, including `C.S. REPARTICION` at 71.63 MWh approved in February 2026 and `C.S. MAJES SOLAR` at 3.904 MWh approved in November 2025.

## Discrepancy analysis

_No backfill and no continuous dispatch-down telemetry. Region now uses the official COES EDI reports as the direct curtailment evidence/anchor and the COES generation dashboard only for the live daily solar magnitude._

## Known limitations

The COES EDI source is published as monthly PDFs, so the live loader does not scrape those reports for an hourly series. It uses COES daily solar generation by company and distributes the calibrated curtailed MWh over a daylight-only southern Peru solar profile. `sourceStatus="live"` means the COES generation endpoint was reachable and returned recent daily solar totals; the 2% curtailment multiplier and EDI/report anchor remain the limiting assumptions.

## Links

- Loader source: [`peru.json.ts`](../../src/data/peru.json.ts)
- Backfill archive: `data/historical/backfill/*_peru-solar_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
