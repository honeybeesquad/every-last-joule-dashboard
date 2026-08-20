# Validation — Mexico Wind (`mexico-wind`)

Last updated: 2026-08-20 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `mexico-wind`
- **Country:** MEX
- **Tier:** estimated
- **Kind:** wind
- **Source:** SENER PRODESEN 2024-2038 + CRE + NREL — modelled T3 ~0.4 TWh/yr wind share of the ~1.2 TWh national VRE-curtailment anchor (Oaxaca/Tehuantepec transmission constraints). No measured CENACE feed; no fabricated hourly data.
- **Source URL:** [https://www.gob.mx/sener/documentos/programa-de-desarrollo-del-sistema-electrico-nacional-2024-2038](https://www.gob.mx/sener/documentos/programa-de-desarrollo-del-sistema-electrico-nacional-2024-2038)
- **Loader:** [`mexico.json.ts`](../../src/data/mexico.json.ts)
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

_Per-fuel split of the former single `mexico` region (2026-06-17). The ~1.2 TWh anchor covered both northern-grid solar and Oaxaca wind, but was emitted as one "solar" region — splitting corrects the fuel attribution. Modelled T3; promote if CENACE ever exposes a measured feed._

## Known limitations

- Magnitude is a modelled estimate (typical wind shape × an annual anchor), not a measured series. ±40% T3 envelope. Mexican curtailment is real (transmission-constrained Oaxaca/Tehuantepec) but low and unquantified at the hourly level.

## Links

- Loader source: [`mexico.json.ts`](../../src/data/mexico.json.ts)
- Backfill archive: `data/historical/backfill/*_mexico-wind_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
