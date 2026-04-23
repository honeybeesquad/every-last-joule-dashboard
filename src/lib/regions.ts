import type { Region } from "./types";

export const REGIONS: Region[] = [
  // Tier 1 - live sub-hourly
  { id: "caiso",            name: "California",      country: "USA", lat: 36.5, lon: -119.5, tier: "live", kind: "mixed", source: "CAISO OASIS / EIA (solar+wind)", sourceUrl: "https://oasis.caiso.com/oasisapi" },
  { id: "ercot-west",       name: "ERCOT West",      country: "USA", lat: 33.5, lon: -102.0, tier: "live", kind: "mixed", source: "EIA / ERCOT (wind+solar)", sourceUrl: "https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data" },
  { id: "ercot-east",       name: "ERCOT East",      country: "USA", lat: 31.8, lon:  -99.9, tier: "live", kind: "mixed", source: "EIA / ERCOT (wind+solar)", sourceUrl: "https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data" },
  { id: "miso",             name: "MISO (Midwest)",  country: "USA", lat: 41.5, lon:  -93.0, tier: "live", kind: "mixed", source: "EIA MISO wind+solar", sourceUrl: "https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data" },
  { id: "pjm",              name: "PJM",             country: "USA", lat: 40.0, lon:  -77.0, tier: "live", kind: "mixed", source: "EIA PJM wind+solar", sourceUrl: "https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data" },
  { id: "spp",              name: "SPP",             country: "USA", lat: 38.0, lon:  -98.0, tier: "live", kind: "mixed", source: "EIA SPP wind+solar", sourceUrl: "https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data" },
  // NYISO split into zones D+E (North Country / Mohawk Valley — bulk of wind
  // curtailment per NYISO Power Trends 2024 / Unbottling Wind) vs the rest.
  // 2023 statewide wind curtailment was 0.162 TWh, concentrated in D/E.
  { id: "nyiso-zones-d-e",  name: "NYISO Zones D+E", country: "USA", lat: 43.7, lon:  -75.3, tier: "live", kind: "wind",  source: "EIA NYISO wind (Zones D+E share, ~75% of statewide curtailment)", sourceUrl: "https://www.nyiso.com/documents/20142/2223020/2024-Power-Trends.pdf" },
  { id: "nyiso-rest",       name: "NYISO (rest)",    country: "USA", lat: 42.8, lon:  -74.8, tier: "live", kind: "mixed", source: "EIA NYISO wind+solar (ex-Zones D/E)", sourceUrl: "https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data" },
  // ISO-NE split — ISO-NE IMM's 2024 annual markets report says 93% of
  // 2020-2024 curtailed renewable capacity in New England was in Maine and
  // Vermont (northern congestion pocket). 2024 ISO-NE renewable curtailment
  // total = 0.034 TWh, split 93/7.
  { id: "iso-ne-maine-vermont", name: "ISO-NE Maine/Vermont", country: "USA", lat: 44.7, lon: -70.6, tier: "live", kind: "wind",  source: "EIA ISO-NE wind (ME+VT share, 93% of NE curtailment per IMM)", sourceUrl: "https://www.iso-ne.com/static-assets/documents/100023/2024-annual-markets-report.pdf" },
  { id: "iso-ne-rest",          name: "ISO-NE (rest)",        country: "USA", lat: 42.2, lon: -71.8, tier: "live", kind: "mixed", source: "EIA ISO-NE wind+solar (ex-ME/VT)", sourceUrl: "https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data" },
  { id: "bpa",              name: "BPA",             country: "USA", lat: 45.7, lon: -121.5, tier: "live", kind: "mixed", source: "EIA BPA wind+solar", sourceUrl: "https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data" },
  { id: "aemo-nsw",         name: "New South Wales", country: "AUS", lat: -32.5, lon: 146.5, tier: "live", kind: "mixed", source: "AEMO NEMWeb wind+solar", sourceUrl: "https://nemweb.com.au/Reports/Current/Next_Day_Dispatch/" },
  { id: "aemo-vic",         name: "Victoria",        country: "AUS", lat: -37.0, lon: 144.8, tier: "live", kind: "mixed", source: "AEMO NEMWeb wind+solar", sourceUrl: "https://nemweb.com.au/Reports/Current/Next_Day_Dispatch/" },
  { id: "aemo-qld",         name: "Queensland",      country: "AUS", lat: -22.0, lon: 145.0, tier: "live", kind: "mixed", source: "AEMO NEMWeb wind+solar", sourceUrl: "https://nemweb.com.au/Reports/Current/Next_Day_Dispatch/" },
  { id: "aemo-sa",          name: "South Australia", country: "AUS", lat: -33.0, lon: 138.0, tier: "live", kind: "mixed", source: "AEMO NEMWeb wind+solar", sourceUrl: "https://nemweb.com.au/Reports/Current/Next_Day_Dispatch/" },
  { id: "aemo-tas",         name: "Tasmania",        country: "AUS", lat: -42.0, lon: 146.8, tier: "live", kind: "mixed", source: "AEMO NEMWeb wind+solar", sourceUrl: "https://nemweb.com.au/Reports/Current/Next_Day_Dispatch/" },
  { id: "belgium",          name: "Belgium",         country: "BEL", lat: 50.5, lon:    4.5, tier: "live", kind: "mixed", source: "Elia Open Data (wind+solar)", sourceUrl: "https://opendata.elia.be/" },
  { id: "iberia",           name: "Iberia",          country: "ESP", lat: 39.5, lon:   -3.5, tier: "live", kind: "mixed", source: "ENTSO-E", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "portugal",         name: "Portugal",        country: "PRT", lat: 39.5, lon:   -8.0, tier: "live", kind: "mixed", source: "ENTSO-E", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "germany",          name: "Germany",         country: "DEU", lat: 52.5, lon:   10.5, tier: "live", kind: "mixed", source: "ENTSO-E", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "finland",          name: "Finland",         country: "FIN", lat: 62.0, lon:   25.0, tier: "live", kind: "wind",  source: "ENTSO-E", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "france",           name: "France",          country: "FRA", lat: 46.5, lon:    2.5, tier: "live", kind: "mixed", source: "RTE eco2mix wind+solar", sourceUrl: "https://odre.opendatasoft.com/" },
  { id: "netherlands",      name: "Netherlands",     country: "NLD", lat: 52.2, lon:    5.3, tier: "live", kind: "mixed", source: "ENTSO-E", sourceUrl: "https://transparency.entsoe.eu/" },
  // Denmark split by Energinet PriceArea. DK1 (Jutland/Fyn) hosts most
  // onshore wind and is interconnected to Germany; DK2 (Zealand) sits
  // across the Øresund from Sweden. Energi Data Service is natively zonal;
  // split 75/25 reflects DK1's share of combined wind+solar generation.
  { id: "denmark-west",      name: "Denmark DK1",     country: "DNK", lat: 56.2, lon:    9.1, tier: "live", kind: "mixed", source: "Energinet wind+solar (DK1)", sourceUrl: "https://api.energidataservice.dk/" },
  { id: "denmark-east",      name: "Denmark DK2",     country: "DNK", lat: 55.4, lon:   12.3, tier: "live", kind: "mixed", source: "Energinet wind+solar (DK2)", sourceUrl: "https://api.energidataservice.dk/" },
  { id: "poland",           name: "Poland",          country: "POL", lat: 52.0, lon:   19.0, tier: "live", kind: "mixed", source: "ENTSO-E", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "greece",           name: "Greece",          country: "GRC", lat: 39.0, lon:   22.0, tier: "live", kind: "mixed", source: "ENTSO-E", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "romania",          name: "Romania",         country: "ROU", lat: 45.9, lon:   25.0, tier: "live", kind: "mixed", source: "ENTSO-E", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "italy-north-zone", name: "Italy North",     country: "ITA", lat: 45.0, lon:   10.0, tier: "live", kind: "mixed", source: "ENTSO-E Terna (North zone)", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "italy-south",     name: "Italy South",     country: "ITA", lat: 40.5, lon:   16.0, tier: "live", kind: "mixed", source: "ENTSO-E Terna (South zone)", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "italy-sardinia",  name: "Sardinia",        country: "ITA", lat: 40.1, lon:    9.1, tier: "live", kind: "mixed", source: "ENTSO-E Terna (Sardinia)", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "sweden-north",     name: "Sweden North",    country: "SWE", lat: 63.5, lon:   18.5, tier: "live", kind: "wind",  source: "ENTSO-E", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "sweden-south",     name: "Sweden South",    country: "SWE", lat: 56.0, lon:   14.0, tier: "live", kind: "mixed", source: "ENTSO-E", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "ukraine",          name: "Ukraine",         country: "UKR", lat: 48.38, lon: 31.17, tier: "static", kind: "solar", source: "Ember Ukraine 2024 (ENTSO-E absent post-war)", sourceUrl: "https://ember-energy.org/global-insights/ukraine-electricity-tracker/" },
  { id: "hungary",          name: "Hungary",         country: "HUN", lat: 47.16, lon: 19.50, tier: "live", kind: "mixed", source: "ENTSO-E MAVIR", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "czech-republic",   name: "Czech Republic",  country: "CZE", lat: 49.82, lon: 15.47, tier: "live", kind: "mixed", source: "ENTSO-E CEPS", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "bulgaria",         name: "Bulgaria",        country: "BGR", lat: 42.73, lon: 25.49, tier: "live", kind: "mixed", source: "ENTSO-E ESO", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "baltics",          name: "Baltic states",   country: "EST", lat: 57.0,  lon: 24.0,  tier: "live", kind: "wind",  source: "ENTSO-E Litgrid", sourceUrl: "https://transparency.entsoe.eu/" },
  // GB split — NESO Markets Roadmap 2024 reports ~11 TWh/yr of constraint
  // actions, dominated by the Scotland-to-England export boundary. Split
  // 70/30 at consumption: Scotland carries the bulk of curtailed wind.
  { id: "gb-scotland",      name: "GB Scotland",     country: "GBR", lat: 56.8, lon:   -4.2, tier: "live", kind: "wind",  source: "Elexon BMRS wind+solar (Scotland share, ~70% via NESO constraint boundary)", sourceUrl: "https://www.neso.energy/data-portal/monthly-operational-metered-wind-output" },
  { id: "gb-england-wales", name: "GB England+Wales", country: "GBR", lat: 52.9, lon:  -1.8, tier: "live", kind: "mixed", source: "Elexon BMRS wind+solar (England+Wales share)", sourceUrl: "https://www.elexon.co.uk/data/" },
  // Brazil NE: each state runs both wind and solar constrained-off via ONS;
  // kind="mixed" because the loader emits a data-driven wind/solar split.
  { id: "brazil-rn",        name: "Rio Grande do Norte", country: "BRA", lat: -5.8, lon: -36.3, tier: "live", kind: "mixed", source: "ONS wind+solar", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-ce",        name: "Ceara",           country: "BRA", lat: -5.0, lon: -39.0, tier: "live", kind: "mixed", source: "ONS wind+solar", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-bahia",     name: "Bahia",           country: "BRA", lat: -11.0, lon: -41.0, tier: "live", kind: "mixed", source: "ONS wind+solar", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-piaui",     name: "Piaui",           country: "BRA", lat: -8.0, lon: -43.0, tier: "live", kind: "mixed", source: "ONS wind+solar", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-pernambuco", name: "Pernambuco",     country: "BRA", lat: -8.0, lon: -37.5, tier: "live", kind: "mixed", source: "ONS wind+solar", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-other",     name: "Brazil NE Other", country: "BRA", lat: -8.0, lon: -38.0, tier: "live", kind: "mixed", source: "ONS wind+solar", sourceUrl: "https://www.ons.org.br/" },
  { id: "n-norway",         name: "N. Norway",       country: "NOR", lat: 68.5, lon:   17.5, tier: "live", kind: "mixed", source: "ENTSO-E hydro+wind", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "ontario",          name: "Ontario",         country: "CAN", lat: 44.0, lon:  -81.0, tier: "live", kind: "mixed", source: "IESO wind+solar", sourceUrl: "https://reports-public.ieso.ca/public/GenOutputCapability/" },
  { id: "alberta",          name: "Alberta",         country: "CAN", lat: 51.5, lon: -114.0, tier: "live", kind: "mixed", source: "AESO wind+solar", sourceUrl: "http://ets.aeso.ca/ets_web/ip/Market/Reports/CSDReportServlet" },
  // Ireland split by SONI/EirGrid's 2024 Annual Renewable Constraint and
  // Curtailment Report: ROI wind DD = 1.266 TWh (8.8% of RES), NI wind DD
  // = 0.915 TWh (29.6% of wind, 25.5% of RES). NI is a much smaller grid
  // but has dramatically higher dispatch-down intensity.
  { id: "ireland-republic", name: "Ireland (Republic)",  country: "IRL", lat: 53.3, lon:   -7.8, tier: "live", kind: "wind",  source: "SONI/EirGrid 2024 dispatch-down (ROI: 1.266 TWh)", sourceUrl: "https://cms.soni.ltd.uk/sites/default/files/publications/Annual%20Renewable%20Constraint%20and%20Curtailment%20Report%202024%20V1.0.pdf" },
  { id: "northern-ireland", name: "Northern Ireland",    country: "GBR", lat: 54.65, lon:  -6.65, tier: "live", kind: "wind",  source: "SONI/EirGrid 2024 dispatch-down (NI: 0.915 TWh, 29.6% of wind)", sourceUrl: "https://cms.soni.ltd.uk/sites/default/files/publications/Annual%20Renewable%20Constraint%20and%20Curtailment%20Report%202024%20V1.0.pdf" },
  { id: "peru",             name: "Peru",            country: "PER", lat: -14.0, lon: -74.0, tier: "live", kind: "mixed", source: "COES-SINAC", sourceUrl: "https://www.coes.org.pe/Portal/portalinformacion/generacion" },
  { id: "south-africa",     name: "South Africa",    country: "ZAF", lat: -32.0, lon:  26.0, tier: "live", kind: "mixed", source: "Eskom Data Portal", sourceUrl: "https://www.eskom.co.za/dataportal/" },
  { id: "new-zealand",      name: "New Zealand",     country: "NZL", lat: -40.9, lon: 172.0, tier: "live", kind: "mixed", source: "EMI wind+solar+geo", sourceUrl: "https://www.emi.ea.govt.nz/Wholesale/Datasets/Generation/Generation_MD" },
  { id: "atacama",          name: "Atacama",         country: "CHL", lat: -24.5, lon: -69.2, tier: "live",   kind: "solar", source: "CEN Chile XLSX", sourceUrl: "https://www.coordinador.cl/operacion/documentos/reducciones-de-generacion-renovable/" },
  { id: "chile-wind",       name: "Chile Wind",      country: "CHL", lat: -38.5, lon: -72.5, tier: "static", kind: "wind",  source: "CEN Chile 2024 ERV wind estimate", sourceUrl: "https://www.coordinador.cl/operacion/documentos/reducciones-de-generacion-renovable/" },
  // Tier 2 - static fallback regions
  { id: "sichuan",          name: "Sichuan",         country: "CHN", lat: 30.6, lon:  102.8, tier: "static", kind: "hydro", source: "Ember China", sourceUrl: "https://ember-energy.org/" },
  { id: "xinjiang",         name: "Xinjiang",        country: "CHN", lat: 41.5, lon:   85.0, tier: "static", kind: "solar", source: "Ember China", sourceUrl: "https://ember-energy.org/" },
  { id: "inner-mongolia",   name: "Inner Mongolia",  country: "CHN", lat: 43.0, lon:  112.0, tier: "static", kind: "wind",  source: "Ember / NEA fallback", sourceUrl: "https://ember-energy.org/" },
  { id: "gansu",            name: "Gansu",           country: "CHN", lat: 39.0, lon:   97.0, tier: "static", kind: "mixed", source: "Ember / NEA fallback", sourceUrl: "https://ember-energy.org/" },
  { id: "qinghai",          name: "Qinghai",         country: "CHN", lat: 36.0, lon:   98.0, tier: "static", kind: "solar", source: "Ember / NEA fallback", sourceUrl: "https://ember-energy.org/" },
  { id: "ningxia",          name: "Ningxia",         country: "CHN", lat: 37.5, lon:  106.0, tier: "static", kind: "mixed", source: "Ember / NEA fallback", sourceUrl: "https://ember-energy.org/" },
  { id: "yunnan",           name: "Yunnan",          country: "CHN", lat: 25.0, lon:  101.5, tier: "static", kind: "hydro", source: "IEA / NEA fallback", sourceUrl: "https://www.iea.org/" },
  { id: "tibet",            name: "Tibet (Xizang)",  country: "CHN", lat: 30.0, lon:   90.0, tier: "static", kind: "hydro", source: "IEA / NEA fallback", sourceUrl: "https://www.iea.org/" },
  { id: "iceland",          name: "Iceland",         country: "ISL", lat: 64.9, lon:  -19.0, tier: "static", kind: "hydro", source: "Published", sourceUrl: "https://orkustofnun.is/" },
  { id: "argentina",        name: "Argentina",       country: "ARG", lat: -43.0, lon: -65.0, tier: "static", kind: "wind",  source: "CAMMESA / IRENA fallback", sourceUrl: "https://cammesaweb.cammesa.com/" },
  { id: "uruguay",          name: "Uruguay",         country: "URY", lat: -33.5, lon: -56.0, tier: "static", kind: "wind",  source: "ADME fallback", sourceUrl: "https://adme.com.uy/" },
  { id: "paraguay",         name: "Paraguay",        country: "PRY", lat: -25.4, lon: -54.6, tier: "static", kind: "hydro", source: "Itaipu fallback", sourceUrl: "https://www.itaipu.gov.py/" },
  { id: "colombia",         name: "Colombia",        country: "COL", lat:   4.5, lon: -74.0, tier: "static", kind: "hydro", source: "XM / UPME fallback", sourceUrl: "https://www.xm.com.co/" },
  { id: "mexico",           name: "Mexico",          country: "MEX", lat: 25.0, lon: -103.0, tier: "static", kind: "solar", source: "CENACE fallback", sourceUrl: "https://www.cenace.gob.mx/SIM/Reportes/" },
  { id: "japan",            name: "Japan",           country: "JPN", lat: 33.0, lon:  131.0, tier: "static", kind: "solar", source: "OCCTO/JEPX fallback", sourceUrl: "https://www.occto.or.jp/" },
  { id: "vietnam",          name: "Vietnam",         country: "VNM", lat: 11.5, lon:  108.8, tier: "static", kind: "solar", source: "EVN fallback", sourceUrl: "https://www.evn.com.vn/" },
  { id: "thailand",         name: "Thailand",        country: "THA", lat: 14.5, lon:  101.0, tier: "static", kind: "solar", source: "EGAT fallback", sourceUrl: "https://www.egat.co.th/en/" },
  { id: "india-north",      name: "North India",     country: "IND", lat: 26.5, lon:   73.0, tier: "static", kind: "solar", source: "NRLDC fallback", sourceUrl: "https://www.nrldc.in/" },
  { id: "india-south",      name: "India South",     country: "IND", lat: 13.0, lon:   78.0, tier: "static", kind: "mixed", source: "SRLDC fallback", sourceUrl: "https://srldc.in/" },
  { id: "india-west",       name: "India West",      country: "IND", lat: 22.5, lon:   71.0, tier: "static", kind: "mixed", source: "WRLDC fallback", sourceUrl: "https://wrldc.in/" },
  { id: "india-east",       name: "India East",      country: "IND", lat: 22.0, lon:   87.0, tier: "static", kind: "solar", source: "ERLDC fallback", sourceUrl: "https://erldc.in/" },
  { id: "cyprus",           name: "Cyprus",          country: "CYP", lat: 35.0, lon:   33.0, tier: "static", kind: "solar", source: "TSOC fallback", sourceUrl: "https://tsoc.org.cy/" },
  { id: "ethiopia",         name: "Ethiopia",        country: "ETH", lat: 10.5, lon:   37.0, tier: "static", kind: "hydro", source: "EEP fallback", sourceUrl: "https://www.eep.com.et/" },
  { id: "kenya",            name: "Kenya",           country: "KEN", lat: -0.9, lon:   36.3, tier: "static", kind: "hydro", source: "EPRA 2025 (geothermal overnight venting)", sourceUrl: "https://www.epra.go.ke/publications/" },
  { id: "egypt",            name: "Egypt",           country: "EGY", lat: 24.5, lon:   32.7, tier: "static", kind: "solar", source: "NREA / Benban frequency disconnections", sourceUrl: "https://nrea.gov.eg/" },
  { id: "morocco",          name: "Morocco",         country: "MAR", lat: 31.5, lon:   -6.0, tier: "static", kind: "mixed", source: "ANRE 2024 (south-north transmission)", sourceUrl: "http://www.anre.ma/" },
  { id: "namibia",          name: "Namibia",         country: "NAM", lat: -22.0, lon:  17.0, tier: "static", kind: "solar", source: "NamPower ISB 2025", sourceUrl: "https://www.nampower.com.na/" },
  { id: "kazakhstan",       name: "Kazakhstan",      country: "KAZ", lat: 48.0, lon:   66.9, tier: "static", kind: "wind",  source: "KEGOC fallback", sourceUrl: "https://www.kegoc.kz/" },
  { id: "mongolia",         name: "Mongolia",        country: "MNG", lat: 47.0, lon:  105.0, tier: "static", kind: "wind",  source: "NPTG fallback", sourceUrl: "https://nptg.mn/" },
  { id: "honduras",         name: "Honduras",        country: "HND", lat: 15.2, lon:  -86.2, tier: "static", kind: "solar", source: "ODS Honduras fallback", sourceUrl: "https://ods.org.hn/" },
  { id: "jeju",             name: "Jeju (S. Korea)", country: "KOR", lat: 33.49, lon: 126.50, tier: "static", kind: "wind",  source: "KPX Jeju fallback", sourceUrl: "https://www.kpx.or.kr/" },
  { id: "wa-swis",          name: "Western Australia (SWIS)", country: "AUS", lat: -32.0, lon: 116.0, tier: "static", kind: "mixed", source: "AEMO WEM fallback", sourceUrl: "https://data.wa.aemo.com.au/" },
  { id: "nt-pilbara",       name: "NT & Pilbara",    country: "AUS", lat: -22.0, lon: 118.0, tier: "static", kind: "solar", source: "Horizon/Pilbara fallback", sourceUrl: "https://www.horizonpower.com.au/" },
  { id: "indonesia",        name: "Indonesia",       country: "IDN", lat:  -7.0, lon: 110.0, tier: "static", kind: "solar", source: "PLN fallback", sourceUrl: "https://web.pln.co.id/" },
  { id: "malaysia",         name: "Malaysia",        country: "MYS", lat:   3.5, lon: 102.0, tier: "static", kind: "solar", source: "TNB/SEDA fallback", sourceUrl: "https://www.tnb.com.my/" },
  { id: "south-korea",      name: "South Korea (mainland)", country: "KOR", lat: 35.5, lon: 127.0, tier: "static", kind: "solar", source: "KPX fallback", sourceUrl: "https://www.kpx.or.kr/eng/" },
  { id: "russia-mainland",  name: "Russia (European grid)", country: "RUS", lat: 55.8, lon:  38.0, tier: "static", kind: "hydro", source: "SO UES fallback", sourceUrl: "https://www.so-ups.ru/" },
  { id: "taiwan",           name: "Taiwan",          country: "TWN", lat:  23.9, lon: 120.4, tier: "static", kind: "mixed", source: "Taipower fallback", sourceUrl: "https://www.taipower.com.tw/" },
  { id: "jordan",           name: "Jordan",          country: "JOR", lat:  30.8, lon:  35.8, tier: "static", kind: "mixed", source: "NEPCO fallback", sourceUrl: "https://www.nepco.com.jo/" },
  { id: "saudi-solar",      name: "Saudi Arabia (solar)", country: "SAU", lat: 25.5, lon: 46.5, tier: "static", kind: "solar", source: "SEC/ECRA fallback", sourceUrl: "https://www.se.com.sa/" },
  { id: "uae",              name: "UAE",             country: "ARE", lat:  24.5, lon:  54.4, tier: "static", kind: "solar", source: "DEWA/EWEC fallback", sourceUrl: "https://www.dewa.gov.ae/" },
  { id: "oman",             name: "Oman",            country: "OMN", lat:  23.5, lon:  57.5, tier: "static", kind: "solar", source: "OPWP fallback", sourceUrl: "https://www.omanpwp.om/" },
  { id: "israel",           name: "Israel",          country: "ISR", lat:  30.8, lon:  34.8, tier: "static", kind: "solar", source: "Noga fallback", sourceUrl: "https://www.noga-iso.co.il/" },
  { id: "pakistan",         name: "Pakistan",        country: "PAK", lat:  28.0, lon:  67.5, tier: "static", kind: "mixed", source: "NEPRA fallback", sourceUrl: "https://nepra.org.pk/" },
  { id: "iran",             name: "Iran",            country: "IRN", lat:  33.0, lon:  52.0, tier: "static", kind: "solar", source: "TAVANIR fallback", sourceUrl: "https://www.tavanir.org.ir/" },
  { id: "iraq-mainland",    name: "Iraq (non-flare)", country: "IRQ", lat: 34.0, lon: 43.5, tier: "static", kind: "solar", source: "Ministry of Electricity fallback", sourceUrl: "https://moelc.gov.iq/" },
  { id: "kurdistan",        name: "Kurdistan (KRG)", country: "IRQ", lat:  36.5, lon:  44.0, tier: "static", kind: "solar", source: "KRG Ministry fallback", sourceUrl: "https://gov.krd/moel-en/" },
  { id: "bangladesh",       name: "Bangladesh",      country: "BGD", lat:  24.0, lon:  90.0, tier: "static", kind: "solar", source: "BPDB fallback", sourceUrl: "https://bpdb.gov.bd/" },
  { id: "brazil-mg",        name: "Minas Gerais",    country: "BRA", lat: -18.0, lon: -44.0, tier: "static", kind: "mixed", source: "ONS wind+solar", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-sp",        name: "Sao Paulo",       country: "BRA", lat: -22.5, lon: -48.0, tier: "static", kind: "mixed", source: "ONS wind+solar", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-mt",        name: "Mato Grosso",     country: "BRA", lat: -13.0, lon: -56.0, tier: "static", kind: "mixed", source: "ONS wind+solar", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-go",        name: "Goias",           country: "BRA", lat: -16.0, lon: -49.5, tier: "static", kind: "mixed", source: "ONS wind+solar", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-pr",        name: "Parana",          country: "BRA", lat: -25.0, lon: -52.0, tier: "static", kind: "mixed", source: "ONS wind+solar", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-rs",        name: "Rio Grande do Sul", country: "BRA", lat: -30.0, lon: -53.0, tier: "static", kind: "mixed", source: "ONS wind+solar", sourceUrl: "https://www.ons.org.br/" },
  { id: "british-columbia", name: "British Columbia", country: "CAN", lat: 54.0, lon: -124.0, tier: "static", kind: "hydro", source: "BC Hydro fallback", sourceUrl: "https://www.bchydro.com/" },
  { id: "quebec",           name: "Quebec",          country: "CAN", lat:  52.0, lon: -72.0, tier: "static", kind: "hydro", source: "Hydro-Quebec fallback", sourceUrl: "https://www.hydroquebec.com/" },
  { id: "manitoba",         name: "Manitoba",        country: "CAN", lat:  54.0, lon: -98.0, tier: "static", kind: "mixed", source: "Manitoba Hydro fallback", sourceUrl: "https://www.hydro.mb.ca/" },
  { id: "saskatchewan",     name: "Saskatchewan",    country: "CAN", lat:  52.0, lon: -106.0, tier: "static", kind: "wind",  source: "SaskPower fallback", sourceUrl: "https://www.saskpower.com/" },
  // v0.6 — Codex global-coverage-audit 2026-04-24 additions.
  // Hawaiian Electric publishes a per-island curtailment metric (RSWG
  // monthly + annual historical workbook). TWh anchors are provisional
  // pending workbook extraction; see docs/research/2026-04-24-global-coverage-audit.md.
  { id: "hawaii-oahu",      name: "Hawaii (Oahu)",       country: "USA", lat:  21.46, lon: -158.00, tier: "static", kind: "solar", source: "Hawaiian Electric RSWG monthly reports (Oahu: ~30% renewable share 2024, provisional)", sourceUrl: "https://www.hawaiianelectric.com/about-us/performance-scorecards-and-metrics/renewable-energy" },
  { id: "hawaii-maui",      name: "Hawaii (Maui)",       country: "USA", lat:  20.80, lon: -156.33, tier: "static", kind: "solar", source: "Hawaiian Electric RSWG monthly reports (Maui island system)", sourceUrl: "https://www.hawaiianelectric.com/about-us/performance-scorecards-and-metrics/renewable-energy" },
  { id: "hawaii-island",    name: "Hawaii (Big Island)", country: "USA", lat:  19.60, lon: -155.50, tier: "static", kind: "mixed", source: "Hawaiian Electric RSWG (Hawaii Island: 58.7% renewable share 2024)", sourceUrl: "https://www.hawaiianelectric.com/about-us/performance-scorecards-and-metrics/renewable-energy" },
  // Austria — APG confirms 2024 redispatch events involving renewable
  // curtailment; no public annual TWh anchor. Held as a provisional
  // static until an ENTSO-E A75 extraction pass is wired.
  { id: "austria",          name: "Austria",             country: "AUT", lat:  47.60, lon:   14.30, tier: "static", kind: "mixed", source: "APG Strombilanz 2024 + ENTSO-E redispatch A75 (provisional anchor)", sourceUrl: "https://www.apg.at/en/news-press/apg-strombilanz-2024-oesterreich-erstmals-wieder-exportland/" },
  // Russia / Kola Peninsula — SO UPS 2024 monthly DPM VIE reports cite
  // explicit wind output limits (84 MW Sep 2024, 77 MW Nov 2024). Treated
  // as a narrow source upgrade to russia-mainland for the one Russian
  // sub-region with public dispatch-curtailment evidence.
  { id: "russia-murmansk-wind", name: "Russia (Murmansk)", country: "RUS", lat: 68.90, lon:  33.10, tier: "static", kind: "wind",  source: "SO UPS 2024 monthly DPM VIE reports (Kola Peninsula wind dispatch limits)", sourceUrl: "https://www.so-ups.ru/functioning/markets/surveys/renewable/2024/" },
  // Tier 3 - flare (4 regions)
  { id: "permian",   name: "Permian Basin",   country: "USA",    lat:  31.9, lon: -102.5, tier: "flare",  kind: "flare", source: "VIIRS + GGFR", sourceUrl: "https://www.worldbank.org/en/programs/gasflaringreduction" },
  { id: "w-siberia", name: "W. Siberia",      country: "RUS",    lat:  61.0, lon:   73.0, tier: "flare",  kind: "flare", source: "VIIRS + GGFR", sourceUrl: "https://www.worldbank.org/en/programs/gasflaringreduction" },
  { id: "s-iraq",    name: "S. Iraq",         country: "IRQ",    lat:  30.5, lon:   47.5, tier: "flare",  kind: "flare", source: "VIIRS + GGFR", sourceUrl: "https://www.worldbank.org/en/programs/gasflaringreduction" },
  { id: "e-saudi",   name: "E. Saudi Arabia", country: "SAU",    lat:  26.5, lon:   49.5, tier: "flare",  kind: "flare", source: "VIIRS + GGFR", sourceUrl: "https://www.worldbank.org/en/programs/gasflaringreduction" }
];
