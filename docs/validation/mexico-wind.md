# Validation — Mexico Wind (`mexico-wind`)

Last updated: 2026-06-17 · Paper section: Technical Validation §4.2

## Source

- **Region id:** `mexico-wind`
- **Country:** MEX
- **Tier:** estimated (T3)
- **Kind:** wind
- **Source:** CENACE Energía Generada Tipo Técnico CSV relay × 5% modelled curtailment rate
- **Source URL:** [https://www.cenace.gob.mx/Paginas/SIM/Reportes/EnergiaGeneradaTipoTec.aspx](https://www.cenace.gob.mx/Paginas/SIM/Reportes/EnergiaGeneradaTipoTec.aspx)
- **Loader:** [`mexico.json.ts`](../../src/data/mexico.json.ts)
- **Source provenance:** modelled-fallback

## Calibration

- **Rate applied:** 5% (wind)
- **Rate provenance:** SENER PRODESEN 2024–2038 planning document + CRE confiabilidad reports. No measured Mexican curtailment numerator exists — PRODESEN is a capacity planning doc, not a measurement of actual curtailment.
- **Applies uniformly across backfill years:** yes

## Cross-check against external anchors

### Published anchors

- **TSO annual curtailment (latest):** none published by CENACE
- **Ember annual curtailment:** not tracked for Mexico wind specifically
- **IRENA annual curtailment:** not published
- **Other:** ~1.2 TWh/yr total VRE curtailment estimated from SENER PRODESEN; wind share ~0.4 TWh/yr

## Known limitations

- No measured curtailment anchor exists for Mexico. The 5% rate is derived from planning documents, not actual dispatch data.
- CENACE publishes generation-by-technology but not curtailment volumes.
- T3 estimated ±40% envelope applies.
- The CENACE CSV relay provides real generation data, but curtailment must be inferred via the modelled rate.

## Links

- Loader: [`src/data/mexico.json.ts`](../../src/data/mexico.json.ts)
- Methodology: [`docs/methodology/`](../methodology/)
