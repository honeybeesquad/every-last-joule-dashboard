# ENTSO-E Curtailment-Rate Audit

Audit date: 2026-04-24. Scope: every ENTSO-E zone and every `psrType` multiplier in `src/data/entsoe.json.ts` on branch `codex/entsoe-rates`.

The loader fetches ENTSO-E actual generation per type (`documentType=A75`, `processType=A16`) and multiplies the observed MWh by a rate. This audit treats a rate as grounded only when a public source gives either an annual curtailed-energy volume or an explicit curtailment percentage for 2023 or 2024. When the source gives a national wind+solar aggregate, the same aggregate rate is used only where no technology split is published. Ember yearly electricity data is used only as a denominator when the curtailment source gives GWh but not a percentage.

ENTSO-E also documents a "Curtailed Renewable Energy" API product (`documentType=A77`, `businessType=A53`). A future loader should test A77 zone by zone and replace these rate proxies wherever A77 returns complete hourly or quarter-hourly curtailed-energy data. This session does not implement that substitution.

## Zone Table

Rates are shown as percentages of observed generation. "Before" is the pre-audit loader value; "cited" is the value supported by the source listed here; "delta" is cited minus before in percentage points.

| Zone | Domain | psrType | Fuel | Before | Cited source | Cited rate | Delta | Status |
| --- | --- | --- | --- | ---: | --- | ---: | ---: | --- |
| germany | `10Y1001A1001A82H` | B18 | wind offshore | n/a | BNetzA curtailment, BNetzA/SMARD generation | 17.8% | n/a | Grounded rate added |
| germany | `10Y1001A1001A82H` | B19 | wind onshore | 8.0% | BNetzA curtailment, BNetzA/SMARD generation | 3.0% | -5.0 | Grounded rate updated |
| germany | `10Y1001A1001A82H` | B16 | solar | 2.3% | BNetzA curtailment, BNetzA/SMARD generation | 2.2% | -0.1 | Cited unchanged |
| iberia | `10YES-REE------0` | B16 | solar | 5.5% | IEA/REE chart only; no extractable 2024 GWh found | n/a | n/a | Acknowledged placeholder |
| iberia | `10YES-REE------0` | B19 | wind | 11.0% | IEA/REE chart only; no extractable 2024 GWh found | n/a | n/a | Acknowledged placeholder |
| portugal | `10YPT-REN------W` | B16 | solar | 10.0% | REN generation published; no curtailment total found | n/a | n/a | Acknowledged placeholder |
| portugal | `10YPT-REN------W` | B19 | wind | 3.0% | REN generation published; no curtailment total found | n/a | n/a | Acknowledged placeholder |
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
| czech-republic | `10YCZ-CEPS-----N` | B16 | solar | 2.0% | ENTSO-E A77 exists in API docs for CZ, but no public annual extracted here | n/a | n/a | Measured-substitution candidate |
| czech-republic | `10YCZ-CEPS-----N` | B19 | wind | 1.0% | ENTSO-E A77 exists in API docs for CZ, but no public annual extracted here | n/a | n/a | Measured-substitution candidate |
| bulgaria | `10YCA-BULGARIA-R` | B16 | solar | 2.0% | No 2023/2024 annual curtailed-energy total found | n/a | n/a | Acknowledged placeholder |
| bulgaria | `10YCA-BULGARIA-R` | B19 | wind | 1.5% | No 2023/2024 annual curtailed-energy total found | n/a | n/a | Acknowledged placeholder |
| baltics | `10YLT-1001A0008Q` | B19 | wind | 2.5% | No Lithuania/Baltic 2023/2024 annual curtailed-energy total found | n/a | n/a | Acknowledged placeholder |

## Material Differences

**Germany.** The pre-audit loader applied an 8.0% rate to onshore wind (`B19`) and did not fetch offshore wind (`B18`). BNetzA-derived 2024 figures split the curtailment very differently: 3,384 GWh onshore wind and 4,562 GWh offshore wind. Against BNetzA/SMARD 2024 generation of 111.9 TWh onshore wind and 25.7 TWh offshore wind, the defensible rates are 3.0% for `B19` and 17.8% for `B18`. The loader now fetches both wind PSR types, so Germany is no longer using onshore generation as a proxy for offshore curtailment.

**Netherlands.** The only public annual 2024 rate found in this audit is an aggregate IEEFA figure: 3.0 TWh of wind+solar curtailment and a 4.9% rate. The previous offshore-wind rate was 9.0%, which materially exceeded that aggregate source. The offshore `B18` rate is therefore reduced to 4.9%; the onshore wind and solar rates remain at 4.5% because their difference from the cited aggregate is within the 1 percentage-point no-churn band.

**Poland.** URE's 2024 redispatch report gives separate PV and wind reductions: 597.26 GWh of PV ordered by PSE plus 24.12 GWh by DSOs, and 125.1 GWh of wind ordered by PSE plus 2.8 GWh by DSOs. Dividing those by Ember 2024 generation gives 3.5% for solar and 0.5% for wind. Both differed by more than one percentage point from the loader constants and were updated.

**Greece.** HAEE's 2025 energy-news summary states that official 2024 green-energy curtailment was 860 GWh, and the Greek Energy Market Report attributes the curtailment series to IPTO. Because no public wind/solar split was found, the rate is applied as a single wind+solar aggregate: 860 GWh divided by Ember's 2024 Greece wind+solar generation of 23.81 TWh, or 3.6%. Both Greek loader rates were updated.

**Spain/Iberia.** IEA's 2025 report includes Spain in its official-data VRE curtailment chart and cites REE I3DIA and e-sios, but the public text does not expose an exact 2024 GWh or percentage value. REE's 2024 system report gives renewable generation and integration context, not a clean annual curtailed-energy series. The current 5.5% solar and 11.0% wind constants therefore remain placeholders pending either an e-sios extraction or ENTSO-E A77 validation.

**Italy.** Terna publishes national renewable generation, and the current loader uses editorial national-to-zone allocation notes. This audit did not find a public Terna or ARERA 2024 curtailed-energy table split by ENTSO-E bidding zone. The Italy north/south/Sardinia rates remain placeholders, with a plausible ordering but no citable zonal denominator.

## Limitations

No citable 2023/2024 curtailed-energy total was found for Portugal, Finland, Romania, the Italy bidding-zone split, Sweden, Hungary, Bulgaria, or Lithuania/Baltics. These rates should be treated as illustrative floor/ceiling values rather than measured annual calibration.

Spain and Czechia are better described as measured-substitution candidates than as permanently ungrounded estimates. The ENTSO-E API guide documents A77 curtailed renewable energy requests, and the Czech sample appears directly in the guide. A follow-up loader should test A77 coverage for every domain in this table, compare annual sums against national operator reports, and replace generation-times-rate modelling where A77 is complete.

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
