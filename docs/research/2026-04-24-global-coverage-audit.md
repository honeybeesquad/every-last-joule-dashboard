# Global coverage audit — 2026-04-24

## Summary
- 4 new regions recommended with real public operator/regulator evidence: `hawaii-oahu`, `hawaii-maui`, `hawaii-island`, `austria`
- 6 sub-zone splits recommended: Ireland into ROI/NI, ISO-NE into Maine+Vermont vs rest, NYISO into Zones D+E vs rest, Great Britain into Scotland vs England+Wales, Denmark into DK1/DK2, optionally UK NI separated from GB
- 9 data-source upgrades recommended for existing regions
- Rough priority ranking:
  1. Hawaii island systems
  2. Ireland split (`ireland` -> ROI + NI)
  3. Austria
  4. ISO-NE Maine/Vermont split
  5. NYISO Zones D/E split
  6. Great Britain Scotland split
  7. Russia source upgrade via SO UPS DPM VIE monthly reports

## Recommendations

### Tier 1 — immediately actionable (open, accessible, quantifiable)

#### `hawaii-oahu`
- Country / grid operator: United States / Hawaiian Electric
- Data source URL:
  - https://www.hawaiianelectric.com/about-us/performance-scorecards-and-metrics/renewable-energy
  - https://www.hawaiianelectric.com/about-us/performance-scorecards-and-metrics/renewable-energy/rswg-monthly-reports
- Reachable without CF/geo-block from CI? yes
- 2024 annual curtailment TWh: no annual Oahu GWh total extracted during this audit without downloading Hawaiian Electric’s historical workbook; operator does publish monthly curtailment reports and historical data by island, so this is a data-extraction problem, not a data-availability problem
- Suggested lat/lon: `21.46, -158.00`
- Suggested fuel kind: `solar`
- Tier: `live`
- Confidence: `HIGH`
- Technical notes on integration:
  - Hawaiian Electric publishes a formal renewable curtailment metric by island system, explicitly defined as estimated energy that could not be accepted onto the grid.
  - Oahu is already separately reported in the operator metric stack, so this should not be modeled as a single Hawaii-wide series.
  - The cleanest path is to ingest the historical workbook plus the monthly RSWG/CER reports rather than scrape image charts.

#### `hawaii-maui`
- Country / grid operator: United States / Hawaiian Electric
- Data source URL:
  - https://www.hawaiianelectric.com/about-us/performance-scorecards-and-metrics/renewable-energy
  - https://www.hawaiianelectric.com/about-us/performance-scorecards-and-metrics/renewable-energy/rswg-monthly-reports
- Reachable without CF/geo-block from CI? yes
- 2024 annual curtailment TWh: not extracted in this audit; same caveat as Oahu, but available from operator historical data workflow
- Suggested lat/lon: `20.80, -156.33`
- Suggested fuel kind: `solar`
- Tier: `live`
- Confidence: `HIGH`
- Technical notes on integration:
  - Maui is already separated from Oahu and Hawaii Island in Hawaiian Electric’s curtailment metric.
  - New 2024 solar-plus-storage additions on Maui make it a useful calibration region even before a fully automated loader exists.

#### `hawaii-island`
- Country / grid operator: United States / Hawaiian Electric
- Data source URL:
  - https://www.hawaiianelectric.com/about-us/performance-scorecards-and-metrics/renewable-energy
  - https://www.hawaiianelectric.com/clean-energy-hawaii/our-clean-energy-portfolio
- Reachable without CF/geo-block from CI? yes
- 2024 annual curtailment TWh: not extracted in this audit; operator historical data exists by island
- Suggested lat/lon: `19.60, -155.50`
- Suggested fuel kind: `mixed`
- Tier: `live`
- Confidence: `HIGH`
- Technical notes on integration:
  - Hawaii Island had `58.7%` renewable generation share in 2024, far above Oahu and Maui, so aggregation would hide materially different curtailment behavior.
  - This is the strongest Pacific-island-system candidate found.

#### `austria`
- Country / grid operator: Austria / APG
- Data source URL:
  - https://www.apg.at/en/news-press/apg-strombilanz-2024-oesterreich-erstmals-wieder-exportland/
  - https://transparency.entsoe.eu/congestion-management/r2/redispatching-internal/show
  - https://transparencyplatform.zendesk.com/hc/en-us/articles/16676134651796-Redispatching-13-1-A
- Reachable without CF/geo-block from CI? yes, though ENTSO-E export ergonomics are still clumsy
- 2024 annual curtailment TWh: no public annual TWh anchor found in this audit; APG publicly states renewables had to be curtailed on numerous days in 2024, but the annual energy total was not found in an open APG summary page
- Suggested lat/lon: `47.60, 14.30`
- Suggested fuel kind: `mixed`
- Tier: `live`
- Confidence: `MEDIUM`
- Technical notes on integration:
  - Austria is missing from current coverage despite APG explicitly acknowledging renewable curtailment in 2024.
  - ENTSO-E redispatching dataset includes Austria as a control area.
  - This looks implementable, but calibration still needs either direct APG annual redispatch/curtailment energy or an ENTSO-E extraction pass.

### Tier 2 — plausible but harder (needs negotiation, auth, or heavier extraction)

#### `northern-ireland`
- Country / grid operator: United Kingdom / SONI
- Data source URL:
  - https://cms.soni.ltd.uk/sites/default/files/publications/Annual%20Renewable%20Constraint%20and%20Curtailment%20Report%202024%20V1.0.pdf
  - https://www.eirgrid.ie/how-the-grid-works/renewables/
- Reachable without CF/geo-block from CI? yes
- 2024 annual curtailment TWh: wind dispatch-down `0.915 TWh`; solar dispatch-down `0.022 TWh`; renewables dispatch-down share `25.5%` for all renewables, `29.6%` for wind
- Suggested lat/lon: `54.65, -6.65`
- Suggested fuel kind: `wind`
- Tier: `live`
- Confidence: `HIGH`
- Technical notes on integration:
  - This is technically a split of an existing tracked region, but the divergence is so large that it deserves listing here too.
  - SONI/EirGrid already publish half-hourly dispatch-down datasets and annual reports.

#### `ireland-republic`
- Country / grid operator: Ireland / EirGrid
- Data source URL:
  - https://cms.soni.ltd.uk/sites/default/files/publications/Annual%20Renewable%20Constraint%20and%20Curtailment%20Report%202024%20V1.0.pdf
  - https://www.eirgrid.ie/how-the-grid-works/renewables/
- Reachable without CF/geo-block from CI? yes
- 2024 annual curtailment TWh: wind dispatch-down `1.266 TWh`; solar dispatch-down `0.039 TWh`; renewables dispatch-down share `8.8%`
- Suggested lat/lon: `53.30, -7.80`
- Suggested fuel kind: `wind`
- Tier: `live`
- Confidence: `HIGH`
- Technical notes on integration:
  - Same dataset family as Northern Ireland.
  - Current single `ireland` region understates NI severity and overstates ROI severity.

#### `iso-ne-maine-vermont`
- Country / grid operator: United States / ISO New England
- Data source URL:
  - https://www.iso-ne.com/static-assets/documents/100023/2024-annual-markets-report.pdf
- Reachable without CF/geo-block from CI? yes
- 2024 annual curtailment TWh: ISO-NE region total `0.034 TWh`; ISO-NE says `93%` of curtailed renewable capacity in New England during `2020-2024` was in Maine and Vermont, but the report does not provide a clean 2024 Maine/Vermont-only GWh total
- Suggested lat/lon: `44.70, -70.60`
- Suggested fuel kind: `wind`
- Tier: `live`
- Confidence: `MEDIUM`
- Technical notes on integration:
  - Strong evidence that a New England aggregate masks a persistent northern congestion pocket.
  - The missing piece is a directly published state/pocket time series. Good candidate if ISO-NE or IMM tables can be unpacked further.

#### `nyiso-zones-d-e`
- Country / grid operator: United States / NYISO
- Data source URL:
  - https://www.nyiso.com/documents/20142/2223020/2024-Power-Trends.pdf
  - https://www.nyiso.com/-/unbottling-wind-how-we-can-expand-clean-energy
- Reachable without CF/geo-block from CI? yes
- 2023 annual curtailment TWh: `0.162 TWh` wind curtailment statewide in 2023; NYISO says much of it was concentrated in Zones `D` and `E`
- Suggested lat/lon: `43.70, -75.30`
- Suggested fuel kind: `wind`
- Tier: `live`
- Confidence: `MEDIUM`
- Technical notes on integration:
  - The statewide series is available, but a zone-level curtailment extractor is not obvious from public UI alone.
  - Still a strong split candidate because NYISO itself attributes much of 2023 curtailment to Zones D and E and to specific transmission upgrade work.

#### `gb-scotland`
- Country / grid operator: Great Britain / NESO
- Data source URL:
  - https://www.neso.energy/data-portal/monthly-operational-metered-wind-output
  - https://www.neso.energy/data-portal/wind-bmu-boa-volumes/wind_boa_volumes_202425
  - https://www.neso.energy/document/358131/download
- Reachable without CF/geo-block from CI? yes
- 2024 annual curtailment TWh: no clean Scotland-only annual curtailed-energy series confirmed in this audit; NESO’s 2024 Markets Roadmap reports total thermal/export constraint volumes of `11 TWh` in 2024, dominated by Scottish export constraints, but notes these are not solely curtailment actions
- Suggested lat/lon: `56.80, -4.20`
- Suggested fuel kind: `wind`
- Tier: `live`
- Confidence: `MEDIUM`
- Technical notes on integration:
  - Scotland vs England+Wales is clearly the right structural split if you want GB to reflect where curtailment actually happens.
  - The available NESO APIs look rich enough to build a proxy or direct series, but the accounting needs careful definition to separate true supply-side wind curtailment from broader redispatch volumes.

#### `russia-murmansk-wind`
- Country / grid operator: Russia / SO UPS
- Data source URL:
  - https://www.so-ups.ru/functioning/markets/surveys/renewable/2024/
  - https://www.so-ups.ru/news/newonsite-view/news/26170/
  - https://www.so-ups.ru/news/newonsite-view/news/26169/
- Reachable without CF/geo-block from CI? yes at audit time
- 2024 annual curtailment TWh: no annual MWh total found in open summaries, but monthly SO UPS reports give explicit dispatch curtailment commands; examples include maximum wind output limits of `84 MW` in Murmansk in September 2024 and `77 MW` in November 2024
- Suggested lat/lon: `68.90, 33.10`
- Suggested fuel kind: `wind`
- Tier: `live`
- Confidence: `MEDIUM`
- Technical notes on integration:
  - This is the best Russian sub-region with explicit public dispatch-limitation reporting found in the survey.
  - It does not answer the user’s Siberia/Far East question positively; it is a Northwest source upgrade candidate instead.

#### `puerto-rico`
- Country / grid operator: Puerto Rico / LUMA
- Data source URL:
  - https://energia.pr.gov/wp-content/uploads/sites/7/2024/01/20240122-MI20230001-Final-Resolution-and-Order.pdf
  - https://energia.pr.gov/wp-content/uploads/sites/7/2023/12/20231220-AP20230004-Motion-Submitting-Final-Version-of-Resource-Adequacy-Analysis-Report.pdf
- Reachable without CF/geo-block from CI? yes
- 2024 annual curtailment TWh: none found; public documents discuss curtailment protocol and forecasted curtailment risk, not realized annual dispatch-down energy
- Suggested lat/lon: `18.22, -66.40`
- Suggested fuel kind: `solar`
- Tier: `static`
- Confidence: `LOW`
- Technical notes on integration:
  - Real grid risk is evident, but public reporting still looks planning-oriented.
  - Keep on watchlist rather than add now.

### Tier 3 — known non-starters (documented for completeness)

#### EU bidding zones not currently tracked
- Slovakia: ENTSO-E redispatch area exists, but I did not find quantified public renewable curtailment evidence or a clean annual anchor. Do not add yet.
- Slovenia: same issue; market/balancing material is public, but not a clear renewables dispatch-down series.
- Croatia: HOPS publishes excellent wind production reports and annual generation tables, but I did not find operator-published annual wind/solar curtailment energy.
- Serbia, Bosnia and Herzegovina, Montenegro, Albania, North Macedonia: ENTSO-E/control-area presence is not enough; I did not find quantified public VRE curtailment reporting worth adding.
- Malta and Luxembourg: very small systems/zones with no convincing public renewable-curtailment energy series found.

#### China provincial expansion beyond current coverage
- Guangdong, Zhejiang, Jiangsu, Hebei, Liaoning:
  - I did not find accessible public hourly curtailment time series equivalent to the provincial NEA annual/summary reporting used elsewhere.
  - Public reporting remains mostly utilization-rate and annual aggregate framing.
  - Bloomberg reported in July 2024 that China had stopped publishing some monthly power data that highlighted solar constraints, which is directionally consistent with the lack of accessible granular curtailment data found in this audit.

#### Russia outside `russia-mainland` and `w-siberia`
- Siberia / Far East: no live public renewable-curtailment series found.
- SO UPS public monthly RES reports are useful, but the curtailment examples I found were in Murmansk and the south, not in Siberia or the Far East.

#### Africa beyond current tracked set
- Tanzania, Nigeria, Ghana, Senegal:
  - I found planning, reliability, dispatch-rate, and load-shedding material.
  - I did not find convincing public supply-side renewable curtailment or hydro-spillage reporting suitable for ELJ calibration.
  - Nigeria’s NERC quarterly report notes under-dispatch versus available plant energy, but that is not clean renewable curtailment reporting.

#### Gulf / MENA non-flare expansion
- Qatar, Kuwait, Bahrain:
  - I found renewable rollout and net-metering material.
  - I did not find public hourly or annual renewable dispatch-down/curtailment reporting.
  - These remain too opaque for inclusion today.

#### Central Asia / Caucasus
- Uzbekistan, Turkmenistan, Azerbaijan, Georgia, Armenia:
  - No clean public live curtailment reporting found.
  - Hydro-heavy systems may spill water, but I did not find operator-grade public spillage datasets suitable for the dashboard.

#### Canada outside current tracked provinces
- Newfoundland and Labrador, New Brunswick, Nova Scotia, PEI, Yukon, NWT, Nunavut:
  - I did not find public quantified renewable curtailment series.
  - Newfoundland/Labrador public material is mainly resource adequacy and hydro system planning, not curtailment accounting.

#### Pacific islands beyond Hawaii
- Cook Islands, Fiji, French Polynesia, New Caledonia: no quantified public curtailment datasets found.
- Puerto Rico: see Tier 2 watchlist, not ready.

#### South America gaps
- Ecuador, Bolivia, Venezuela, Suriname, Guyana:
  - I did not find operator-grade public curtailment/spillage series that cleanly separate supply-side curtailment from system shortages or general hydro operations.

#### Central America / Caribbean emerging solar markets
- Dominican Republic: policy response is real; the 1 October 2024 CNE resolution requiring storage for variable renewables strongly suggests curtailment/integration pressure, but I did not find realized annual curtailment GWh.
- Panama: public system data are rich, but what surfaced cleanly was dispatch/market-operation material rather than renewable curtailment energy.
- Costa Rica, Guatemala, El Salvador, Nicaragua: nothing operator-grade and quantified surfaced in this audit.

## Sub-zone splits

### `ireland` -> `ireland-republic` + `northern-ireland`
- Why the split matters:
  - The current all-island treatment masks a very large divergence.
  - SONI/EirGrid’s 2024 annual report says all-renewables dispatch-down was `8.8%` in Ireland and `25.5%` in Northern Ireland.
  - For wind specifically, 2024 dispatch-down was `1,266 GWh` in Ireland and `915 GWh` in Northern Ireland, even though NI is the smaller system.
- Source:
  - https://cms.soni.ltd.uk/sites/default/files/publications/Annual%20Renewable%20Constraint%20and%20Curtailment%20Report%202024%20V1.0.pdf
  - https://www.eirgrid.ie/how-the-grid-works/renewables/
- Reachable without CF/geo-block from CI? yes
- Suggested lat/lon:
  - ROI: `53.30, -7.80`
  - NI: `54.65, -6.65`
- Suggested fuel kind: `wind`
- Tier: `live`
- Confidence: `HIGH`
- Technical notes on integration:
  - Best sub-zone split found in the entire audit.
  - Data exists at annual, monthly and half-hourly levels.

### `iso-ne` -> `iso-ne-maine-vermont` + `iso-ne-rest`
- Why the split matters:
  - ISO-NE’s IMM says `93%` of curtailed renewable capacity in New England during `2020-2024` was in Maine and Vermont.
  - Regional 2024 curtailed renewables were only `34 GWh`, but even that low total is geographically concentrated.
- Source:
  - https://www.iso-ne.com/static-assets/documents/100023/2024-annual-markets-report.pdf
- Reachable without CF/geo-block from CI? yes
- 2024 annual curtailment TWh:
  - `iso-ne`: `0.034 TWh`
  - sub-zone: not directly published in the same report
- Suggested lat/lon:
  - Maine/Vermont: `44.70, -70.60`
  - Rest: `42.20, -71.80`
- Suggested fuel kind: `wind`
- Tier: `live`
- Confidence: `MEDIUM`
- Technical notes on integration:
  - Strong analytical case; weaker direct extractability than Ireland.

### `nyiso` -> `nyiso-zones-d-e` + `nyiso-rest`
- Why the split matters:
  - NYISO Power Trends 2024 reports `162 GWh` of statewide wind curtailment in 2023.
  - NYISO explicitly says much of this was concentrated in Zones D and E and linked to Smart Path Connect and Mohawk-to-Hudson transmission work.
- Source:
  - https://www.nyiso.com/documents/20142/2223020/2024-Power-Trends.pdf
- Reachable without CF/geo-block from CI? yes
- 2023 annual curtailment TWh: `0.162 TWh` statewide; zone-only figure not found
- Suggested lat/lon:
  - Zones D/E pocket: `43.70, -75.30`
  - Rest: `42.80, -74.80`
- Suggested fuel kind: `wind`
- Tier: `live`
- Confidence: `MEDIUM`
- Technical notes on integration:
  - Worth splitting only if you are willing to use NYISO planning/policy documents plus monthly ops material as the first calibration layer.

### Great Britain -> `gb-scotland` + `gb-england-wales`
- Why the split matters:
  - NESO’s own explanation is that export constraints are mainly caused by high wind generation being in Scotland while most demand is in England.
  - Scotland-specific wind output and wind BOA data are public.
- Source:
  - https://www.neso.energy/data-portal/monthly-operational-metered-wind-output
  - https://www.neso.energy/data-portal/wind-bmu-boa-volumes/wind_boa_volumes_202425
  - https://www.neso.energy/document/358131/download
- Reachable without CF/geo-block from CI? yes
- 2024 annual curtailment TWh: not cleanly isolated in an operator annual Scotland-only curtailment series during this audit
- Suggested lat/lon:
  - Scotland: `56.80, -4.20`
  - England+Wales: `52.90, -1.80`
- Suggested fuel kind: `wind`
- Tier: `live`
- Confidence: `MEDIUM`
- Technical notes on integration:
  - Strong structural case, but needs definition discipline because GB balancing/constraint volumes can overcount relative to true curtailed renewable energy.

### `denmark` -> `denmark-dk1` + `denmark-dk2`
- Why the split matters:
  - Energi Data Service is already natively zonal by `PriceArea`, so the data source itself argues for splitting.
  - West Denmark and East Denmark are distinct bidding zones with different interconnection structures.
- Source:
  - https://www.energidataservice.dk/guides/api-guides
  - https://www.energidataservice.dk/datasets/realtime-electricity-market
- Reachable without CF/geo-block from CI? yes
- 2024 annual curtailment TWh: no clean public annual curtailment anchor found in this audit
- Suggested lat/lon:
  - DK1: `56.20, 9.10`
  - DK2: `55.40, 12.30`
- Suggested fuel kind: `mixed`
- Tier: `live`
- Confidence: `LOW`
- Technical notes on integration:
  - Better seen as a data-source upgrade first, then a split if ELJ wants more European zonal granularity.

### `north-sea` / GB representation -> add `northern-ireland` separately
- Why the split matters:
  - Northern Ireland’s dispatch-down is materially worse than ROI and conceptually belongs with the SEM rather than GB balancing data.
- Source:
  - SONI/EirGrid annual dispatch-down report
- Reachable without CF/geo-block from CI? yes
- Suggested lat/lon: `54.65, -6.65`
- Suggested fuel kind: `wind`
- Tier: `live`
- Confidence: `HIGH`
- Technical notes on integration:
  - This is less a “UK split” and more a correction to treat SEM geography correctly.

## New data sources for existing regions

### Existing `ireland`
- Upgrade:
  - Replace or complement any all-island aggregate with EirGrid/SONI half-hourly dispatch-down files.
- Source:
  - https://www.eirgrid.ie/how-the-grid-works/renewables/
- Why it matters:
  - Best openly published dispatch-down dataset found in the audit.

### Existing `iso-ne`
- Upgrade:
  - Use ISO-NE IMM annual markets report and, if needed later, nodal/constraint data to isolate Maine/Vermont congestion effects.
- Source:
  - https://www.iso-ne.com/static-assets/documents/100023/2024-annual-markets-report.pdf

### Existing `nyiso`
- Upgrade:
  - Use Power Trends plus monthly operations reporting for wind curtailment and zones D/E concentration.
- Source:
  - https://www.nyiso.com/power-trends

### Existing Great Britain / `north-sea`
- Upgrade:
  - NESO CKAN APIs expose Scotland vs England/Wales wind output and wind BOA volumes directly.
- Source:
  - https://www.neso.energy/data-portal/monthly-operational-metered-wind-output
  - https://www.neso.energy/data-portal/wind-bmu-boa-volumes/wind_boa_volumes_202425

### Existing `denmark`
- Upgrade:
  - Split or at least validate against DK1/DK2-level Energinet data rather than one combined Danish shape.
- Source:
  - https://www.energidataservice.dk/guides/api-guides

### Existing `sweden-north` / `sweden-south`
- Upgrade:
  - Svenska kraftnät operational procurement and balancing publications are explicitly zonal across `SE1-SE4`.
- Source:
  - https://www.svk.se/press-och-nyheter/nyheter/balansansvar/2024/okad-upphandling-av-mfrr-kapacitet-for-nedreglering/
  - https://mimer.svk.se/
- Why it matters:
  - If ELJ later wants finer Nordic zoning, Sweden is operationally ready before the curtailment-accounting layer is.

### Existing `finland`
- Upgrade:
  - Fingrid offshore wind connection studies suggest future west-coast concentration; good for future split logic, not yet a curtailment dataset.
- Source:
  - https://www.fingrid.fi/en/news/news/2024/fingrids-final-report-refines-the-preliminary-connection-possibilities-for-offshore-wind-power/

### Existing `russia-mainland`
- Upgrade:
  - SO UPS monthly DPM VIE reports provide public evidence of actual dispatch limits on individual wind/solar fleets.
- Source:
  - https://www.so-ups.ru/functioning/markets/surveys/renewable/2024/
- Why it matters:
  - Better than a generic static “Russia mainland” fallback, though still geographically incomplete.

### Existing static global calibrations
- Upgrade:
  - IEA Renewables 2025 now includes a comparative chart on annual VRE shares and technical curtailment for selected countries/regions, with explicit source list.
- Source:
  - https://www.iea.org/reports/renewables-2025/renewable-electricity
- Why it matters:
  - Useful secondary cross-check for Germany, Ireland, Spain, UK, Japan, Chile, Australia and China.

## Answers to the specific questions

### 1. Any EU bidding zones missed?
- Austria: yes, worth adding.
- Slovakia, Slovenia, Croatia: technically visible in ENTSO-E redispatch/control-area infrastructure, but I did not verify public quantified renewable curtailment strong enough to add now.
- Serbia, Bosnia, Montenegro, Albania, North Macedonia, Malta, Luxembourg: no convincing public VRE dispatch-down evidence found.

### 2. China provincial splits beyond what we have
- I did not find accessible public hourly curtailment data for Guangdong, Zhejiang, Jiangsu, Hebei or Liaoning.
- What does exist publicly is still mostly annual or utilization-rate reporting.
- Bottom line: no clearly actionable provincial hourly source surfaced in this audit.

### 3. Russia outside mainland + W. Siberia flare
- For Siberia or the Far East specifically: no.
- For Russia more broadly: yes, SO UPS publishes monthly DPM VIE operating reports with explicit wind/solar output limitation events, but the examples found were Murmansk and southern regions.

### 4. Africa beyond Kenya/SA/Morocco/Egypt/Namibia/Ethiopia
- Tanzania, Nigeria, Senegal, Ghana: I found planning/reliability/load-shedding style information, not clean renewable curtailment reporting.
- Conclusion: mostly out for now.

### 5. Gulf / MENA non-flare expansion
- Qatar, Kuwait, Bahrain: no convincing hourly or annual public renewable-curtailment reporting found.

### 6. Central Asia / Caucasus
- Uzbekistan, Turkmenistan, Azerbaijan, Georgia, Armenia: no live public curtailment data found; no good public hydro-spill series found either.

### 7. US ISO sub-zone splits
- ISO-NE: yes, Maine/Vermont is the best-supported split.
- NYISO: yes, Zones D/E are the best-supported split.
- PJM and MISO: congestion is clearly real, but I did not find a clean public zonal renewable-curtailment energy series good enough to recommend immediate splitting.

### 8. Canada beyond 6 provinces
- No convincing public quantified renewable-curtailment datasets found for the Atlantic provinces or northern territories.

### 9. Pacific islands
- Hawaii: yes, strongest island-system add found.
- Puerto Rico: watchlist only.
- Cook Islands, Fiji, French Polynesia, New Caledonia: no quantified operator-grade curtailment found.

### 10. South America
- Ecuador, Bolivia, Venezuela, Suriname, Guyana: no convincing public spilled-hydro or renewable dispatch-down series found in this audit.

### 11. Emerging large solar/wind markets in Central America / Caribbean
- Dominican Republic and Panama are the only plausible watchlist candidates I found.
- Neither had public realized annual curtailment energy strong enough for inclusion today.

### 12. Missing bidding-zone splits within countries we already track
- India: you currently have `north/south/east/west`; the fifth operating region is the North Eastern Region, but I did not find a convincing curtailment dataset strong enough to recommend adding `india-northeast` now.
- Iberia: do not urgently split Spain and Portugal for curtailment purposes if Portugal is already separate and Iberia is retained for the broader Spanish system. The bigger need is clearer Spain treatment, not Iberia fragmentation.
- Nordic:
  - Denmark DK1/DK2 is the most practical future split because the source data is already zonal.
  - Sweden SE1-4 is possible later, but the evidence gathered here supports source upgrade before dashboard split.
  - Norway NO1-5: I did not gather enough curtailment evidence to justify immediate splitting.
- Finland: no split justified from this audit.
- UK: Scotland vs England+Wales is justified structurally; Northern Ireland should be separated via SONI/EirGrid rather than treated as part of GB.

### 13. Any new Ember / IEA 2024 curtailment publications published Jan 2025 or later?
- IEA: yes. `Renewables 2025` contains a comparative chart on annual VRE shares in generation and technical curtailment for selected countries and regions, with a useful primary-source bibliography.
- Ember: I did not find a new dedicated 2025 Ember curtailment publication that materially expands country coverage beyond what you likely already use.

## References

All links accessed `2026-04-24`.

- Current dashboard coverage file: `src/lib/regions.ts` in repo.
- ENTSO-E Transparency Platform, redispatching help article: https://transparencyplatform.zendesk.com/hc/en-us/articles/16676134651796-Redispatching-13-1-A
- ENTSO-E legacy redispatching data view showing covered control areas: https://transparency.entsoe.eu/congestion-management/r2/redispatching-internal/show
- APG Electricity Balance 2024: Austria is an Export Country again: https://www.apg.at/en/news-press/apg-strombilanz-2024-oesterreich-erstmals-wieder-exportland/
- APG Historical Electricity Export Figures in the First Quarter of 2024: https://www.apg.at/en/news-press/historical-electricity-export-figures-in-the-first-quarter-of-2024/
- HOPS annual wind generation report index: https://www.hops.hr/en/reports-wpp
- HOPS annual wind report 2024 PDF: https://www.hops.hr/page-file/Olog1BGCkaE8tBBg0BxsA2/reports-wpp/HOPS%20-%20Godi%C5%A1nji%20izvje%C5%A1taj%20o%20proizvodnji%20VE%20u%20HR%20za%202024.pdf
- HOPS electricity data page: https://www.hops.hr/elektroenergetski-podaci
- Hawaiian Electric renewable energy metrics page: https://www.hawaiianelectric.com/about-us/performance-scorecards-and-metrics/renewable-energy
- Hawaiian Electric RSWG monthly reports page: https://www.hawaiianelectric.com/about-us/performance-scorecards-and-metrics/renewable-energy/rswg-monthly-reports
- Hawaiian Electric clean energy portfolio 2024 generation mix: https://www.hawaiianelectric.com/clean-energy-hawaii/our-clean-energy-portfolio
- Puerto Rico Energy Bureau wheeling order discussing curtailment protocol: https://energia.pr.gov/wp-content/uploads/sites/7/2024/01/20240122-MI20230001-Final-Resolution-and-Order.pdf
- Puerto Rico resource adequacy filing discussing forecasted curtailment: https://energia.pr.gov/wp-content/uploads/sites/7/2023/12/20231220-AP20230004-Motion-Submitting-Final-Version-of-Resource-Adequacy-Analysis-Report.pdf
- Dominican Republic CNE storage-related resolution news: https://cne.gob.do/noticia/cne-modifica-resolucion-para-impulsar-proyectos-de-energia-renovable-con-almacenamiento/
- Panama CND public portal: https://www.cnd.com.pa/
- Panama CND real-time generation portal: https://sitr.cnd.com.pa/m/pub/gen.html
- ISO-NE 2024 Annual Markets Report: https://www.iso-ne.com/static-assets/documents/100023/2024-annual-markets-report.pdf
- NYISO Power Trends 2024: https://www.nyiso.com/documents/20142/2223020/2024-Power-Trends.pdf
- NYISO Power Trends 2025: https://www.nyiso.com/documents/20142/2223020/2025-Power-Trends.pdf
- NYISO Unbottling Wind article: https://www.nyiso.com/-/unbottling-wind-how-we-can-expand-clean-energy
- NYISO policymakers page on curtailment and transmission limits: https://www.nyiso.com/policymakers
- EirGrid renewable data and dispatch-down portal: https://www.eirgrid.ie/how-the-grid-works/renewables/
- SONI/EirGrid Annual Renewable Constraint and Curtailment Report 2024: https://cms.soni.ltd.uk/sites/default/files/publications/Annual%20Renewable%20Constraint%20and%20Curtailment%20Report%202024%20V1.0.pdf
- EirGrid/Sem historical wind dispatch-down percentages: https://cms.eirgrid.ie/sites/default/files/2024-09/Wind_DD_Historical.pdf
- NESO Monthly Operational Metered Wind Output portal: https://www.neso.energy/data-portal/monthly-operational-metered-wind-output
- NESO Monthly Operational Metered Wind Output 2024-2025 dataset page: https://www.neso.energy/data-portal/monthly-operational-metered-wind-output/monthly_operational_metered_wind_output_2024-2025
- NESO Wind BOA Volumes dataset page: https://www.neso.energy/data-portal/wind-bmu-boa-volumes/wind_boa_volumes_202425
- NESO Markets Roadmap excerpt on 2024 constraint volumes: https://www.neso.energy/document/358131/download
- NESO winter balancing cost report excerpt on 2024/25 wind curtailment: https://www.neso.energy/document/366796/download
- Energi Data Service API guide: https://www.energidataservice.dk/guides/api-guides
- Energi Data Service build-report guide: https://energidataservice.dk/Build_Report_Guide.pdf
- Svenska kraftnät zonal mFRR procurement note: https://www.svk.se/press-och-nyheter/nyheter/balansansvar/2024/okad-upphandling-av-mfrr-kapacitet-for-nedreglering/
- Svenska kraftnät Mimer portal: https://mimer.svk.se/
- Fingrid offshore wind connection study: https://www.fingrid.fi/en/news/news/2024/fingrids-final-report-refines-the-preliminary-connection-possibilities-for-offshore-wind-power/
- SO UPS 2024 monthly DPM RES reports index: https://www.so-ups.ru/functioning/markets/surveys/renewable/2024/
- SO UPS September 2024 DPM RES summary: https://www.so-ups.ru/news/newonsite-view/news/26170/
- SO UPS October 2024 DPM RES summary: https://www.so-ups.ru/news/newonsite-view/news/26169/
- SO UPS November 2024 DPM RES summary: https://www.so-ups.ru/news/newonsite-view/news/26440/
- SO UPS December 2024 DPM RES summary: https://www.so-ups.ru/news/newonsite-view/news/26783/
- SO UPS January 2024 DPM RES summary: https://www.so-ups.ru/news/newonsite-view/news/24144/
- SO UPS February 2024 DPM RES summary: https://www.so-ups.ru/news/newonsite-view/news/24327/
- Bahrain EWA distributed renewable solar page: https://www.ewa.bh/en/distributed-renewable-solar-energy
- Nigeria NERC Q2 2024 report snippet showing under-dispatch, not curtailment: https://nerc.gov.ng/wp-content/uploads/2024/10/NERC_2024_Q2_Report.pdf
- IEA Renewables 2025 renewable electricity chapter: https://www.iea.org/reports/renewables-2025/renewable-electricity
- IEA Renewables 2025 executive summary: https://www.iea.org/reports/renewables-2025/executive-summary
- Bloomberg coverage of China stopping publication of some solar-constraint-relevant data: https://www.bloomberg.com/news/articles/2024-07-01/china-stops-publishing-power-data-highlighting-solar-constraints
