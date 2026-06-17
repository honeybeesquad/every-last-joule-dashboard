# Validation — Mexico Solar (`mexico-solar`)

Last updated: 2026-06-17 · Mexico per-fuel split · T3 modelled

## Source

- **Region id:** `mexico-solar`
- **Country:** MEX
- **Tier:** estimated
- **Kind:** solar
- **Source:** Modelled T3 (±40%). ~0.8 TWh/yr solar share of Mexico's ~1.2 TWh national VRE-curtailment anchor (Sonora/Chihuahua/Coahuila northern-grid), from SENER PRODESEN 2024-2038 + CRE confiabilidad reports. **CENACE publishes no measured curtailment series**, so this is a typical-shape profile scaled to the cited anchor — **no fabricated hourly data**. NREL Clean Energy Report notes Mexican VRE curtailment is "low in all scenarios". Hydro vertimientos excluded.
- **Source URL:** [https://www.gob.mx/sener/documentos/programa-de-desarrollo-del-sistema-electrico-nacional-2024-2038](https://www.gob.mx/sener/documentos/programa-de-desarrollo-del-sistema-electrico-nacional-2024-2038)
- **Structural gap:** no

## Calibration

- **Anchor basis:** ~1.2 TWh national total (midpoint of PRODESEN-2022 ~1.0 TWh and CRE-2023 ~3 TWh), apportioned ~0.8 solar / ~0.4 wind. T3 ±40% envelope.
- A measured CENACE curtailment series (if one is ever published) would upgrade this to T2.

## Published anchors

- **CENACE measured curtailment:** — (none published)
- **PRODESEN / CRE / NREL:** ~1.2 TWh national VRE curtailment (modelled)

## Discrepancy analysis

_Per-fuel split of the former single `mexico` region (2026-06-17). The ~1.2 TWh anchor covered both northern-grid solar and Oaxaca wind, but was emitted as one "solar" region — splitting corrects the fuel attribution. Modelled T3; promote if CENACE ever exposes a measured feed._

## Known limitations

- Magnitude is a modelled estimate (typical solar shape × an annual anchor), not a measured series. ±40% T3 envelope. Mexican curtailment is real (transmission-constrained Sonora/Chihuahua/Coahuila northern-grid) but low and unquantified at the hourly level.

## Links

- Loader: [`mexico.json.ts`](../../src/data/mexico.json.ts)
- Methodology — tiers & live-data paths: [`docs/methodology/live-data-paths.md`](../methodology/live-data-paths.md)
