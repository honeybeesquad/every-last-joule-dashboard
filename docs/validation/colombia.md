# Validation — Colombia (`colombia`)

Last updated: 2026-04-29 · Sprint: S1 + Gemini research wave 1 · Paper section: Technical Validation §4.2

## Source

- **Region id:** `colombia`
- **Country:** COL
- **Tier:** static
- **Kind:** hydro
- **Source:** XM Informe de Operación SIN — vertimientos hidráulicos (hydro spillage when reservoirs exceed storage during bimodal Apr-May / Oct-Nov rainy seasons). 2.0 TWh/yr conservative annualisation pending Colombian-egress verification of the 705.24 GWh-mes figure cited by the Gemini-3.1 research wave 1 (2026-04-29) for Feb-2025.
- **Source URL:** [https://www.xm.com.co/informacion-y-servicios/informes/informes-de-operacion](https://www.xm.com.co/informacion-y-servicios/informes/informes-de-operacion)
- **Loader:** _(no single-file loader — emitted via `STATIC_REGIONS.colombia` in `src/data/statics.json.ts`)_
- **Structural gap:** yes (XM site geoblocked from outside Colombia)

## Calibration

- **Rate source:** n/a — T3 provisional anchor, no calibration rate applied. Annual anchor from XM SIN vertimientos figures, conservatively annualised.
- **Uniform across backfill years:** n/a — no backfill (XM site is unreachable from this build environment)

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill — XM is geoblocked from outside Colombia; figures must be obtained via Colombian-hosted egress)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** XM Informes de Operación SIN — Feb-2025 vertimientos hidráulicos `705.24 GWh-mes` (single month, cited by Gemini-3.1 research wave 1; not externally verified due to geoblocked access)
- **UPME / SER Colombia:** VRE (solar / wind) curtailment <1% of generation — wasted-energy story is dominated by hydro spillage, not VRE curtailment
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** Acolgen industry commentary on hydro spillage during high-inflow seasons

## Discrepancy analysis

_No backfill possible from this environment because XM (`xm.com.co`) is geoblocked outside Colombia — the live curtailment-and-spillage data is reachable only via Colombian-hosted egress. The 2.0 TWh/yr anchor is a conservative annualisation: if Feb-2025 vertimientos really were 705.24 GWh, monthly variation across the bimodal rainy seasons (Apr-May, Oct-Nov) plus dry-season near-zero months produces a defensible annual range of 1.5–8 TWh/yr. The lower end of that range is held as the T3 anchor to avoid over-claiming. Once Colombian egress is established, this region should be re-anchored against the actual XM annual sum and (potentially) promoted to T1a if the monthly Informe de Operación PDF chain becomes parseable._

## Known limitations

The Colombian SIN is hydro-dominant (~60–70% of generation in normal years). Reservoir-overflow spillage (`vertimientos hidráulicos`) is the dominant "wasted potential renewable energy" mechanism and is conceptually identical to the spillage already modelled for Iceland (5.3 TWh/yr) and Sichuan (30 TWh/yr). VRE (solar / wind) curtailment in Colombia is currently negligible (<1%) per UPME / SER Colombia analyses — most "missing" La Guajira renewable generation is structural (transmission projects delayed) rather than operational spillage.

The Gemini-3.1 research wave 1 finding (2026-04-29) cited two URLs for verification:
- `https://www.xm.com.co/informacion-y-servicios/informes/informes-de-operacion` — XM Informes de Operación landing
- `https://www.ser-colombia.org/` — SER Colombia analysis homepage

Both fail external WebFetch with `403` from this environment. The figure and the phenomenon are both real per Gemini's web search, but specific-document verification is blocked until Colombian-hosted egress is set up. Region is included in the dataset on the basis that the phenomenon is real, the modelling approach matches the established Iceland / Sichuan precedent, and the 2.0 TWh/yr anchor is conservative.

T3-modelled, ±40% envelope. Bimodal hydro-seasonal shape (`HYDRO_SEASONAL_SHARES.colombia`) lagging the rainfall peaks by reservoir-fill cycle: peak May-Jun and Nov-Dec, dry windows Jan-Feb and Jul-Aug.

## Links

- Loader: `src/data/statics.json.ts` (`STATIC_REGIONS.colombia`)
- Seasonal shape: `src/lib/typical-profiles.ts` (`HYDRO_SEASONAL_SHARES.colombia`)
- Research wave methodology: `docs/methodology/2026-04-29-gemini-research-wave-1.md`
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
