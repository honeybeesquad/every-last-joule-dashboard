# Validation — Mexico Solar (`mexico-solar`)

Last updated: 2026-06-17 · Paper section: Technical Validation §4.2

## Source

- **Region id:** `mexico-solar`
- **Country:** MEX
- **Tier:** estimated (T3)
- **Kind:** solar
- **Source:** CENACE Energía Generada Tipo Técnico CSV relay × 7% modelled curtailment rate
- **Source URL:** [https://www.cenace.gob.mx/Paginas/SIM/Reportes/EnergiaGeneradaTipoTec.aspx](https://www.cenace.gob.mx/Paginas/SIM/Reportes/EnergiaGeneradaTipoTec.aspx)
- **Loader:** [`mexico.json.ts`](../../src/data/mexico.json.ts)
- **Source provenance:** modelled-fallback

## Calibration

- **Rate applied:** 7% (solar)
- **Rate provenance:** SENER PRODESEN 2024–2038 planning document + CRE confiabilidad reports. No measured Mexican curtailment numerator exists — PRODESEN is a capacity planning doc, not a measurement of actual curtailment.
- **Applies uniformly across backfill years:** yes

## Cross-check against external anchors

### Published anchors

- **TSO annual curtailment (latest):** none published by CENACE
- **Ember annual curtailment:** not tracked for Mexico solar specifically
- **IRENA annual curtailment:** not published
- **Other:** ~1.2 TWh/yr total VRE curtailment estimated from SENER PRODESEN; solar share ~0.8 TWh/yr from northern-grid saturation (Sonora/Chihuahua/Coahuila)

## Known limitations

- No measured curtailment anchor exists for Mexico. The 7% rate is derived from planning documents, not actual dispatch data.
- CENACE publishes generation-by-technology but not curtailment volumes.
- T3 estimated ±40% envelope applies.
- The CENACE CSV relay provides real generation data, but curtailment must be inferred via the modelled rate.

## Links

- Loader: [`src/data/mexico.json.ts`](../../src/data/mexico.json.ts)
- Methodology: [`docs/methodology/`](../methodology/)
