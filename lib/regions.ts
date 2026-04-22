import type { Region } from "./types";

export const REGIONS: Region[] = [
  // Tier 1 - live sub-hourly (9 regions)
  { id: "caiso",     name: "California",      country: "USA",    lat:  36.5, lon: -119.5, tier: "live",  kind: "solar", source: "CAISO OASIS", sourceUrl: "http://oasis.caiso.com/oasisapi" },
  { id: "ercot",     name: "Texas",           country: "USA",    lat:  31.8, lon:  -99.9, tier: "live",  kind: "mixed", source: "ERCOT",       sourceUrl: "https://www.ercot.com/mp/data-products/data-product-details" },
  { id: "aemo",      name: "South Australia", country: "AUS",    lat: -34.9, lon:  138.6, tier: "live",  kind: "solar", source: "AEMO NEMWeb", sourceUrl: "https://aemo.com.au/energy-systems/electricity/national-electricity-market-nem/data-nem" },
  { id: "iberia",    name: "Iberia",          country: "ESP",    lat:  39.5, lon:   -3.5, tier: "live",  kind: "solar", source: "ENTSO-E",     sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "germany",   name: "Germany",         country: "DEU",    lat:  52.5, lon:   10.5, tier: "live",  kind: "wind",  source: "ENTSO-E",     sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "finland",   name: "Finland",         country: "FIN",    lat:  62.0, lon:   25.0, tier: "live",  kind: "wind",  source: "ENTSO-E",     sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "north-sea", name: "North Sea",       country: "GBR",    lat:  56.5, lon:   -2.0, tier: "live",  kind: "wind",  source: "NG ESO",      sourceUrl: "https://www.elexon.co.uk/data/" },
  { id: "atacama",   name: "Atacama",         country: "CHL",    lat: -24.5, lon:  -69.2, tier: "live",  kind: "solar", source: "CEN Chile",   sourceUrl: "https://www.coordinador.cl/" },
  { id: "brazil-ne", name: "Brazil NE",       country: "BRA",    lat:  -9.0, lon:  -37.0, tier: "live",  kind: "wind",  source: "ONS",         sourceUrl: "https://www.ons.org.br/" },
  // Tier 2 - static (4 regions)
  { id: "sichuan",   name: "Sichuan",         country: "CHN",    lat:  30.6, lon:  102.8, tier: "static", kind: "hydro", source: "Ember China", sourceUrl: "https://ember-energy.org/" },
  { id: "xinjiang",  name: "Xinjiang",        country: "CHN",    lat:  41.5, lon:   85.0, tier: "static", kind: "solar", source: "Ember China", sourceUrl: "https://ember-energy.org/" },
  { id: "iceland",   name: "Iceland",         country: "ISL",    lat:  64.9, lon:  -19.0, tier: "static", kind: "hydro", source: "Published",   sourceUrl: "https://orkustofnun.is/" },
  { id: "n-norway",  name: "N. Norway",       country: "NOR",    lat:  68.5, lon:   17.5, tier: "static", kind: "hydro", source: "Nord Pool",   sourceUrl: "https://www.nordpoolgroup.com/" },
  // Tier 3 - flare (4 regions)
  { id: "permian",   name: "Permian Basin",   country: "USA",    lat:  31.9, lon: -102.5, tier: "flare",  kind: "flare", source: "VIIRS + GGFR", sourceUrl: "https://www.worldbank.org/en/programs/gasflaringreduction" },
  { id: "w-siberia", name: "W. Siberia",      country: "RUS",    lat:  61.0, lon:   73.0, tier: "flare",  kind: "flare", source: "VIIRS + GGFR", sourceUrl: "https://www.worldbank.org/en/programs/gasflaringreduction" },
  { id: "s-iraq",    name: "S. Iraq",         country: "IRQ",    lat:  30.5, lon:   47.5, tier: "flare",  kind: "flare", source: "VIIRS + GGFR", sourceUrl: "https://www.worldbank.org/en/programs/gasflaringreduction" },
  { id: "e-saudi",   name: "E. Saudi Arabia", country: "SAU",    lat:  26.5, lon:   49.5, tier: "flare",  kind: "flare", source: "VIIRS + GGFR", sourceUrl: "https://www.worldbank.org/en/programs/gasflaringreduction" }
];
