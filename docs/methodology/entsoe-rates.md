# ENTSO-E Curtailment-Rate Audit

Audit date: 2026-04-24. Scope: every ENTSO-E zone and every `psrType` multiplier in `src/data/entsoe.json.ts` on branch `codex/entsoe-rates`.

The loader fetches ENTSO-E actual generation per type (`documentType=A75`, `processType=A16`) and multiplies the observed MWh by a rate. This audit treats a rate as grounded only when a public source gives either an annual curtailed-energy volume or an explicit curtailment percentage for 2023 or 2024. When the source gives a national wind+solar aggregate, the same aggregate rate is used only where no technology split is published. Ember yearly electricity data is used only as a denominator when the curtailment source gives GWh but not a percentage.

**Correction (2026-06-24): there is no ENTSO-E curtailed-renewable-energy product.** A prior note here claimed `documentType=A77, businessType=A53` was a "Curtailed Renewable Energy" product and the preferred upgrade path. That is **wrong** — verified by probing the whole Transparency-Platform taxonomy: `A77` is `UNAVAILABILITY_OF_PRODUCTION_AND_GENERATION_UNITS` (plant outage/maintenance notices), `A69` is the VRE *generation forecast* (≈ A75 actuals), and `A63` is *thermal* redispatch (no VRE psrType). None is curtailed-renewable energy, and the ENTSO-E Transparency Platform REST API publishes no such time series for any zone. Measured European curtailment therefore lives only in **national TSO feeds** (e.g. Germany's netztransparenz Web-API / BNetzA SMARD; Spain's REE/OMIE), most of which are registration-gated or only quarterly/annual — so the `generation × rate` proxies below are the defensible state of the art, not a shortcut. Do not re-chase A77.

## Zone Table

Rates are shown as percentages of observed generation. "Before" is the pre-audit loader value; "cited" is the value supported by the source listed here; "delta" is cited minus before in percentage points.

| Zone | Domain | psrType | Fuel | Before | Cited source | Cited rate | Delta | Status |
| --- | --- | --- | --- | ---: | --- | ---: | ---: | --- |
| germany | `10Y1001A1001A82H` | B18 | wind offshore | n/a | BNetzA curtailment, BNetzA/SMARD generation | 17.8% | n/a | Grounded rate added |
| germany | `10Y1001A1001A82H` | B19 | wind onshore | 8.0% | BNetzA curtailment, BNetzA/SMARD generation | 3.0% | -5.0 | Grounded rate updated |
| germany | `10Y1001A1001A82H` | B16 | solar | 2.3% | BNetzA curtailment, BNetzA/SMARD generation | 2.2% | -0.1 | Cited unchanged |
| iberia | `10YES-REE------0` | B16 | solar | 3.9% | OMIE market data; Danthine "Five Years of Spanish Curtailment" 2025 (per-tech 2024) | 5.5% (old) | -1.6 | Corrected down to per-tech market figure |
| iberia | `10YES-REE------0` | B19 | wind | 6.7% | OMIE market data; Danthine "Five Years of Spanish Curtailment" 2025 (per-tech 2024); cf. REE Informe 2024 narrow-technical 288 GWh (1.6%, all-tech) | 11.0% (old) | -4.3 | Corrected down; old "6.8 TWh" note unverifiable vs REE |
| portugal | `10YPT-REN------W` | B16 | solar | 0.5% | REN "Dados Técnicos 2024" reports no curtailment; combined wind+solar ~0.4% / 213 GWh in 2023 (Synertics/REN) | 10.0% (old) | -9.5 | Corrected (~25× too high); near-zero per REN |
| portugal | `10YPT-REN------W` | B19 | wind | 0.5% | REN "Dados Técnicos 2024" reports no curtailment; combined wind+solar ~0.4% / 213 GWh in 2023 (Synertics/REN) | 3.0% (old) | -2.5 | Corrected; near-zero per REN |
| finland | `10YFI-1--------U` | B19 | wind | 5.0% | Fingrid reports grid/generation context; no national curtailed-energy total found | n/a | n/a | Acknowledged placeholder |
| netherlands | `10YNL----------L` | B18 | wind offshore | 9.0% | IEEFA summary of Dutch 2024 wind+solar curtailment | 4.9% | -4.1 | Grounded aggregate rate updated |
| netherlands | `10YNL----------L` | B19 | wind onshore | 4.5% | IEEFA summary of Dutch 2024 wind+solar curtailment | 4.9% | +0.4 | Cited unchanged |
| netherlands | `10YNL----------L` | B16 | solar | 4.5% | IEEFA summary of Dutch 2024 wind+solar curtailment | 4.9% | +0.4 | Cited unchanged |
| poland | `10YPL-AREA-----S` | B19 | wind | 2.0% | URE 2024 redispatch report + Ember wind generation | 0.5% | -1.5 | Grounded rate updated |
| poland | `10YPL-AREA-----S` | B16 | solar | 1.5% | URE 2024 redispatch report + Ember solar generation | 3.5% | +2.0 | Grounded rate updated |
| greece | `10YGR-HTSO-----Y` | B16 | solar | 2.5% | HAEE/IPTO official 2024 RES curtailment + Ember wind+solar generation | 3.6% | +1.1 | Grounded aggregate rate updated |
| greece | `10YGR-HTSO-----Y` | B19 | wind | 1.5% | HAEE/IPTO official 2024 RES curtailment + Ember wind+solar generation | 3.6% | +2.1 | Grounded aggregate rate updated |
| romania | `10YRO-TEL------P` | B16 | solar | 4.0% | Transelectrica/ANRE public material found, but no 2024 curtailed-energy total | n/a | n/a | Acknowledged placeholder |
| romania | `10YRO-TEL------P` | B19 | wind | 2.5% | Transelectrica/ANRE public material found, but no 2024 curtailed-energy total | n/a | n/a | Acknowledged placeholder |
| italy-north-zone | `10Y1001A1001A73I` | B16 | solar | 0.6% | Terna generation public; no published bidding-zone curtailment split found | n/a | n/a | Acknowledged placeholder |
| italy-north-zone | `10Y1001A1001A73I` | B19 | wind | 0.3% | Terna generation public; no published bidding-zone curtailment split found | n/a | n/a | Acknowledged placeholder |
| italy-south | `10Y1001A1001A86H` | B16 | solar | 1.9% | Terna generation public; no published bidding-zone curtailment split found | n/a | n/a | Acknowledged placeholder |
| italy-south | `10Y1001A1001A86H` | B19 | wind | 1.0% | Terna generation public; no published bidding-zone curtailment split found | n/a | n/a | Acknowledged placeholder |
| italy-sardinia | `10Y1001A1001A74G` | B16 | solar | 4.7% | Terna generation public; no published bidding-zone curtailment split found | n/a | n/a | Acknowledged placeholder |
| italy-sardinia | `10Y1001A1001A74G` | B19 | wind | 2.0% | Terna generation public; no published bidding-zone curtailment split found | n/a | n/a | Acknowledged placeholder |
| sweden-north | `10Y1001A1001A46L` | B19 | wind | 1.0% | No 2023/2024 annual curtailed-energy total found | n/a | n/a | Acknowledged placeholder |
| sweden-south | `10Y1001A1001A47J` | B16 | solar | 7.0% | No 2023/2024 annual curtailed-energy total found | n/a | n/a | Acknowledged placeholder |
| sweden-south | `10Y1001A1001A47J` | B19 | wind | 2.0% | No 2023/2024 annual curtailed-energy total found | n/a | n/a | Acknowledged placeholder |
| hungary | `10YHU-MAVIR----U` | B16 | solar | 3.0% | No 2023/2024 annual curtailed-energy total found | n/a | n/a | Acknowledged placeholder |
| hungary | `10YHU-MAVIR----U` | B19 | wind | 1.0% | No 2023/2024 annual curtailed-energy total found | n/a | n/a | Acknowledged placeholder |
| czech-republic | `10YCZ-CEPS-----N` | B16 | solar | 2.0% | ENTSO-E has no curtailment-energy product (A77=plant outages, verified 2026-06-24); no public hourly source | n/a | n/a | Acknowledged placeholder |
| czech-republic | `10YCZ-CEPS-----N` | B19 | wind | 1.0% | ENTSO-E has no curtailment-energy product (A77=plant outages, verified 2026-06-24); no public hourly source | n/a | n/a | Acknowledged placeholder |
| bulgaria | `10YCA-BULGARIA-R` | B16 | solar | 2.0% | No 2023/2024 annual curtailed-energy total found | n/a | n/a | Acknowledged placeholder |
| bulgaria | `10YCA-BULGARIA-R` | B19 | wind | 1.5% | No 2023/2024 annual curtailed-energy total found | n/a | n/a | Acknowledged placeholder |
| baltics | `10YLT-1001A0008Q` | B19 | wind | 2.5% | No Lithuania/Baltic 2023/2024 annual curtailed-energy total found | n/a | n/a | Acknowledged placeholder |

## Material Differences

**Germany.** The pre-audit loader applied an 8.0% rate to onshore wind (`B19`) and did not fetch offshore wind (`B18`). BNetzA-derived 2024 figures split the curtailment very differently: 3,384 GWh onshore wind and 4,562 GWh offshore wind. Against BNetzA/SMARD 2024 generation of 111.9 TWh onshore wind and 25.7 TWh offshore wind, the defensible rates are 3.0% for `B19` and 17.8% for `B18`. The loader now fetches both wind PSR types, so Germany is no longer using onshore generation as a proxy for offshore curtailment.

**Netherlands.** The only public annual 2024 rate found in this audit is an aggregate IEEFA figure: 3.0 TWh of wind+solar curtailment and a 4.9% rate. The previous offshore-wind rate was 9.0%, which materially exceeded that aggregate source. The offshore `B18` rate is therefore reduced to 4.9%; the onshore wind and solar rates remain at 4.5% because their difference from the cited aggregate is within the 1 percentage-point no-churn band.

**Poland.** URE's 2024 redispatch report gives separate PV and wind reductions: 597.26 GWh of PV ordered by PSE plus 24.12 GWh by DSOs, and 125.1 GWh of wind ordered by PSE plus 2.8 GWh by DSOs. Dividing those by Ember 2024 generation gives 3.5% for solar and 0.5% for wind. Both differed by more than one percentage point from the loader constants and were updated.

**Greece.** HAEE's 2025 energy-news summary states that official 2024 green-energy curtailment was 860 GWh, and the Greek Energy Market Report attributes the curtailment series to IPTO. Because no public wind/solar split was found, the rate is applied as a single wind+solar aggregate: 860 GWh divided by Ember's 2024 Greece wind+solar generation of 23.81 TWh, or 3.6%. Both Greek loader rates were updated.

**Spain/Iberia.** Corrected 2026-06-23. The prior 11.0% wind / 5.5% solar constants (with a "~6.8 TWh/yr REE" note that could not be verified against REE's own report) were too high. Two definitions exist: REE's narrow grid-technical aggregate (288 GWh ≈ 1.6%, all-tech, REE *Informe del Sistema Eléctrico 2024*) and the market-economic per-technology figure (wind 6.7%, PV 3.9%, 2024, from OMIE market data via Danthine, *Five Years of Spanish Curtailment*, 2025). The loader uses the per-technology market figures (6.7% / 3.9%) because they match its rate×generation-by-fuel model and are the most directly applicable; the definition is stated in the `source:` note. A measured upgrade would require a national REE/OMIE feed — ENTSO-E has no curtailment-energy product (A77 = plant outages, verified 2026-06-24).

**Portugal.** Corrected 2026-06-23. The prior 10.0% solar / 3.0% wind constants were a large overstatement: REN's *Dados Técnicos 2024* reports no curtailment, and the only quantified figure is a combined wind+solar ~0.4% (213 GWh) for 2023 (Synertics, REN-derived). Both rates set to a conservative 0.5% per-technology placeholder reflecting near-zero Portuguese curtailment.

**Italy.** Terna publishes national renewable generation, and the current loader uses editorial national-to-zone allocation notes. This audit did not find a public Terna or ARERA 2024 curtailed-energy table split by ENTSO-E bidding zone. The Italy north/south/Sardinia rates remain placeholders, with a plausible ordering but no citable zonal denominator.

## Limitations

No citable 2023/2024 curtailed-energy total was found for Finland, Romania, the Italy bidding-zone split, Sweden, Hungary, Bulgaria, or Lithuania/Baltics. These rates should be treated as illustrative floor/ceiling values rather than measured annual calibration. (Portugal and Spain were re-grounded 2026-06-23 — see notes above. A 2026-06-23 sweep also confirmed several of these absences are structural: Finland/Sweden publish countertrade/redispatch in EUR rather than constrained-off VRE volume; ENTSO-E's Winter Outlook states Romanian wind was not curtailed.)

These remain `generation × rate` proxy estimates. **NOTE (2026-06-24):** the previously-suggested ENTSO-E **A77 substitution is not possible** — A77 is plant-unavailability data, not curtailed renewable energy, and the ENTSO-E Transparency Platform publishes no curtailment-energy product (verified by probing the full A77/A69/A63 taxonomy across all zones). A measured upgrade requires **national TSO feeds** (e.g. Germany's netztransparenz Web-API / BNetzA SMARD, Spain's REE/OMIE), most of which are registration-gated or published only at quarterly/annual resolution. Until such a feed is wired per country, these rate proxies are the defensible state of the art.

The audit did not use paywalled analytics, login-only dashboards, or reverse-engineered endpoints. Secondary trade-press summaries were used only where they quote or summarise official operator/regulator data and no operator page exposed the exact table in crawlable form.

## References

- Bundesnetzagentur. "Bundesnetzagentur publishes 2024 electricity market data." 2025-01-03. https://www.bundesnetzagentur.de/1043444. Retrieved 2026-04-24.
- pv magazine International. "PV curtailment jumps 97% in Germany in 2024." 2025-04-03, reporting Bundesnetzagentur 2024 grid-congestion figures. https://www.pv-magazine.com/2025/04/03/pv-curtailment-jumps-97-in-germany-in-2024/. Retrieved 2026-04-24.
- IEA. "Renewables 2025: Analysis and forecasts to 2030." 2025. https://www.iea.org/reports/renewables-2025/executive-summary. Retrieved 2026-04-24.
- ENTSO-E Transparency Platform. "Web API Guide, production backup, 06-11-2024." https://transparency.entsoe.eu/content/static_content/Static%20content/web%20api/Guide_prod_backup_06_11_2024.html. Retrieved 2026-04-24.
- Red Electrica. "Generacion renovable de energia electrica 2024." https://www.sistemaelectrico-ree.es/es/2024/informe-del-sistema-electrico/generacion/generacion-de-energia-electrica/generacion-renovable-de-energia-electrica. Retrieved 2026-04-24.
- REN. "Grid-connected solar power doubled in 2024." https://www.ren.pt/en-gb/media/news/grid-connected-solar-power-doubled-in-2024. Retrieved 2026-04-24.
- Fingrid. "Annual Review 2024." https://www.fingrid.fi/globalassets/dokumentit/en/annual-report/2024/fingrid_oyj_annual_report_2024.pdf. Retrieved 2026-04-24.
- IEEFA. "How Europe's grid operators are preparing for the energy transition." May 2025. https://ieefa.org/sites/default/files/2025-09/How%20Europe%E2%80%99s%20grid%20operators%20are%20preparing%20for%20the%20energy%20transition_May%202025_0.pdf. Retrieved 2026-04-24.
- Energy Regulatory Office of Poland (URE). "Electricity market: The 2024 Report on Redispatching Mechanisms from the President of URE." 2025-11-17. https://www.ure.gov.pl/en/communication/news/477%2CElectricity-market-The-2024-Report-on-Redispatching-Mechanisms-from-the-Presiden.html. Retrieved 2026-04-24.
- Ember. "Yearly Electricity Data." https://ember-energy.org/data/yearly-electricity-data/. Retrieved 2026-04-24.
- Hellenic Association for Energy Economics. "Energy News, Jan-Mar 2025." https://www.haee.gr/media/6216/energy-news-jan-mar-2025.pdf. Retrieved 2026-04-24.
- HAEE. "Greek Energy Market Report 2025." https://energymarketreport.energytransition.gr/media/w3kbs214/greek-energy-market-report-2025_final.pdf. Retrieved 2026-04-24.
- Transelectrica. "Annual Report 2024." https://www.transelectrica.ro/documents/10179/18624119/09_Annual%2BReport_2024_Transelectrica_EN.pdf/5c59b37a-36e0-470b-8ede-5c617cb07a90?version=1.0. Retrieved 2026-04-24.
- Terna. "2024 Annual Report." https://download.terna.it/terna/Terna_2024_Annual_Report_8dd871205a435e0.pdf. Retrieved 2026-04-24.
