# Validation — Quebec (`quebec`)

Last updated: 2026-11-18 · Sprint: Hydro-Québec open data · Paper section: Technical Validation §4.2

## Source

- **Region id:** `quebec`
- **Country:** CAN
- **Tier:** estimated
- **Kind:** hydro
- **Source:** Hydro-Québec open data, sources of electricity produced in Quebec (production.json, hourly hydraulique MW). Generation measured. Waste unpublished — no spill-energy series; replaces the unsourced ~0.3 TWh/yr modelled surplus anchor. Not T1a.
- **Source URL:** [https://www.hydroquebec.com/documents-donnees/donnees-ouvertes/production-electricite-quebec/](https://www.hydroquebec.com/documents-donnees/donnees-ouvertes/production-electricite-quebec/)
- **Machine-readable endpoint:** `https://www.hydroquebec.com/data/documents-donnees/donnees-ouvertes/json/production.json` (Données Québec dataset [`sources-production-electricite-quebec`](https://www.donneesquebec.ca/recherche/dataset/sources-production-electricite-quebec)). Rolling yesterday-plus-today file, refreshed hourly; hydro and wind published 90 minutes after the hour, timestamps in Quebec local time. Confirmed current on 2026-11-18 (Last-Modified 09:46 UTC, latest hour 02:30 EST).
- **Field used:** `hydraulique` — telemetered output of Hydro-Québec's stations and contracted suppliers' hydro stations, MW.
- **Loader:** [`quebec.json.ts`](../../src/data/quebec.json.ts)
- **Structural gap:** no
- **Waste status:** unpublished. Missing ≠ zero. Live generation does not make waste T1a.

## Calibration

- **Rate source documented in:** none — no curtailment rate is applied. `profile` and `totalTWh` are zero; generation is emitted as `generationProfile` / `generationTotalTWh`.
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill — production.json holds about two days; the annual 2019–2022 CSVs on Données Québec are not wired)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** none published
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_Until 2026-11-18 this region was a typical seasonal hydro shape scaled to a ~0.3 TWh/yr "export-absorbed spring/summer surplus" anchor with no published source (source string "Hydro-Quebec fallback"). That anchor is dropped, so the dataset's Quebec waste total moves from ~0.3 TWh/yr to zero-unpublished. The spill-flow series in Hydro-Québec's hydrometric dataset could support a modelled spill-energy estimate; see the Part B research note. No figure is taken from it yet._

## Known limitations

- Waste is not measured. Hydro-Québec spills water (débits déversés) but publishes flows, not energy.
- `autres` (independent biomass, biogas and small hydro, ~0.3 GW) is not counted as hydro, so small independent hydro is under-counted.
- About two days of data per build, so `generationTotalTWh` is the window's diurnal mean scaled to 30 days, not a 30-day measurement.

## Links

- Loader source: [`quebec.json.ts`](../../src/data/quebec.json.ts)
- Spill-flow research (Part B, no figures changed): [`2026-11-18-hydro-quebec-spill-flows.md`](../research/2026-11-18-hydro-quebec-spill-flows.md)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
