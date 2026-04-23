import type { Region } from "./types";

export const REGIONS: Region[] = [
  // Tier 1 - live sub-hourly
  { id: "caiso",            name: "California",      country: "USA", lat: 36.5, lon: -119.5, tier: "live", kind: "solar", source: "CAISO OASIS", sourceUrl: "http://oasis.caiso.com/oasisapi" },
  { id: "ercot-west",       name: "ERCOT West",      country: "USA", lat: 33.5, lon: -102.0, tier: "live", kind: "wind",  source: "EIA / ERCOT", sourceUrl: "https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data" },
  { id: "ercot-east",       name: "ERCOT East",      country: "USA", lat: 31.8, lon:  -99.9, tier: "live", kind: "wind",  source: "EIA / ERCOT", sourceUrl: "https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data" },
  { id: "aemo-nsw",         name: "New South Wales", country: "AUS", lat: -32.5, lon: 146.5, tier: "live", kind: "solar", source: "AEMO NEMWeb", sourceUrl: "https://nemweb.com.au/Reports/Current/Next_Day_Intermittent_Gen_Scada/" },
  { id: "aemo-vic",         name: "Victoria",        country: "AUS", lat: -37.0, lon: 144.8, tier: "live", kind: "solar", source: "AEMO NEMWeb", sourceUrl: "https://nemweb.com.au/Reports/Current/Next_Day_Intermittent_Gen_Scada/" },
  { id: "aemo-qld",         name: "Queensland",      country: "AUS", lat: -22.0, lon: 145.0, tier: "live", kind: "solar", source: "AEMO NEMWeb", sourceUrl: "https://nemweb.com.au/Reports/Current/Next_Day_Intermittent_Gen_Scada/" },
  { id: "aemo-sa",          name: "South Australia", country: "AUS", lat: -33.0, lon: 138.0, tier: "live", kind: "wind",  source: "AEMO NEMWeb", sourceUrl: "https://nemweb.com.au/Reports/Current/Next_Day_Intermittent_Gen_Scada/" },
  { id: "aemo-tas",         name: "Tasmania",        country: "AUS", lat: -42.0, lon: 146.8, tier: "live", kind: "wind",  source: "AEMO NEMWeb", sourceUrl: "https://nemweb.com.au/Reports/Current/Next_Day_Intermittent_Gen_Scada/" },
  { id: "iberia",           name: "Iberia",          country: "ESP", lat: 39.5, lon:   -3.5, tier: "live", kind: "solar", source: "ENTSO-E", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "germany",          name: "Germany",         country: "DEU", lat: 52.5, lon:   10.5, tier: "live", kind: "wind",  source: "ENTSO-E", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "finland",          name: "Finland",         country: "FIN", lat: 62.0, lon:   25.0, tier: "live", kind: "wind",  source: "ENTSO-E", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "france",           name: "France",          country: "FRA", lat: 46.5, lon:    2.5, tier: "live", kind: "wind",  source: "ENTSO-E", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "netherlands",      name: "Netherlands",     country: "NLD", lat: 52.2, lon:    5.3, tier: "live", kind: "solar", source: "ENTSO-E", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "denmark-west",     name: "Denmark West",    country: "DNK", lat: 56.0, lon:    9.0, tier: "live", kind: "wind",  source: "ENTSO-E", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "north-sea",        name: "North Sea",       country: "GBR", lat: 56.5, lon:   -2.0, tier: "live", kind: "wind",  source: "NG ESO", sourceUrl: "https://www.elexon.co.uk/data/" },
  { id: "atacama",          name: "Atacama",         country: "CHL", lat: -24.5, lon: -69.2, tier: "live", kind: "solar", source: "CEN Chile", sourceUrl: "https://www.coordinador.cl/" },
  { id: "brazil-rn",        name: "Rio Grande do Norte", country: "BRA", lat: -5.8, lon: -36.3, tier: "live", kind: "wind", source: "ONS", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-ce",        name: "Ceara",           country: "BRA", lat: -5.0, lon: -39.0, tier: "live", kind: "wind", source: "ONS", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-bahia",     name: "Bahia",           country: "BRA", lat: -11.0, lon: -41.0, tier: "live", kind: "wind", source: "ONS", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-piaui",     name: "Piaui",           country: "BRA", lat: -8.0, lon: -43.0, tier: "live", kind: "wind", source: "ONS", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-pernambuco", name: "Pernambuco",     country: "BRA", lat: -8.0, lon: -37.5, tier: "live", kind: "wind", source: "ONS", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-other",     name: "Brazil NE Other", country: "BRA", lat: -8.0, lon: -38.0, tier: "live", kind: "wind", source: "ONS", sourceUrl: "https://www.ons.org.br/" },
  { id: "n-norway",         name: "N. Norway",       country: "NOR", lat: 68.5, lon:   17.5, tier: "live", kind: "hydro", source: "ENTSO-E", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "ontario",          name: "Ontario",         country: "CAN", lat: 44.0, lon:  -81.0, tier: "live", kind: "wind",  source: "IESO", sourceUrl: "https://reports-public.ieso.ca/public/GenOutputCapability/" },
  { id: "alberta",          name: "Alberta",         country: "CAN", lat: 51.5, lon: -114.0, tier: "live", kind: "wind",  source: "AESO", sourceUrl: "http://ets.aeso.ca/ets_web/ip/Market/Reports/CSDReportServlet" },
  { id: "ireland",          name: "Ireland",         country: "IRL", lat: 53.5, lon:   -7.5, tier: "live", kind: "wind",  source: "EirGrid", sourceUrl: "https://www.eirgridgroup.com/how-the-grid-works/renewables/" },
  { id: "peru",             name: "Peru",            country: "PER", lat: -14.0, lon: -74.0, tier: "live", kind: "mixed", source: "COES-SINAC", sourceUrl: "https://www.coes.org.pe/Portal/portalinformacion/generacion" },
  { id: "south-africa",     name: "South Africa",    country: "ZAF", lat: -32.0, lon:  26.0, tier: "live", kind: "mixed", source: "Eskom Data Portal", sourceUrl: "https://www.eskom.co.za/dataportal/" },
  // Tier 2 - static (3 regions)
  { id: "sichuan",          name: "Sichuan",         country: "CHN", lat: 30.6, lon:  102.8, tier: "static", kind: "hydro", source: "Ember China", sourceUrl: "https://ember-energy.org/" },
  { id: "xinjiang",         name: "Xinjiang",        country: "CHN", lat: 41.5, lon:   85.0, tier: "static", kind: "solar", source: "Ember China", sourceUrl: "https://ember-energy.org/" },
  { id: "iceland",          name: "Iceland",         country: "ISL", lat: 64.9, lon:  -19.0, tier: "static", kind: "hydro", source: "Published", sourceUrl: "https://orkustofnun.is/" },
  // Tier 3 - flare (4 regions)
  { id: "permian",   name: "Permian Basin",   country: "USA",    lat:  31.9, lon: -102.5, tier: "flare",  kind: "flare", source: "VIIRS + GGFR", sourceUrl: "https://www.worldbank.org/en/programs/gasflaringreduction" },
  { id: "w-siberia", name: "W. Siberia",      country: "RUS",    lat:  61.0, lon:   73.0, tier: "flare",  kind: "flare", source: "VIIRS + GGFR", sourceUrl: "https://www.worldbank.org/en/programs/gasflaringreduction" },
  { id: "s-iraq",    name: "S. Iraq",         country: "IRQ",    lat:  30.5, lon:   47.5, tier: "flare",  kind: "flare", source: "VIIRS + GGFR", sourceUrl: "https://www.worldbank.org/en/programs/gasflaringreduction" },
  { id: "e-saudi",   name: "E. Saudi Arabia", country: "SAU",    lat:  26.5, lon:   49.5, tier: "flare",  kind: "flare", source: "VIIRS + GGFR", sourceUrl: "https://www.worldbank.org/en/programs/gasflaringreduction" }
];
