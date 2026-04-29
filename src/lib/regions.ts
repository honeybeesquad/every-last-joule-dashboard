import type { Region } from "./types";

export const REGIONS: Region[] = [
  // Tier 1 - live sub-hourly
  { id: "caiso",            name: "California",      country: "USA", lat: 36.5, lon: -119.5, tier: "live", kind: "mixed", source: "CAISO OASIS / EIA (solar+wind)", sourceUrl: "https://oasis.caiso.com/oasisapi" },
  { id: "ercot-west",       name: "ERCOT West",      country: "USA", lat: 33.5, lon: -102.0, tier: "live", kind: "mixed", source: "EIA / ERCOT (wind+solar)", sourceUrl: "https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data" },
  { id: "ercot-east",       name: "ERCOT East",      country: "USA", lat: 31.8, lon:  -99.9, tier: "live", kind: "mixed", source: "EIA / ERCOT (wind+solar)", sourceUrl: "https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data" },
  { id: "florida",          name: "Florida",        country: "USA", lat: 27.6, lon:  -81.2, tier: "static", kind: "solar", source: "EIA FLA solar generation exists, but no published curtailment rate from FRCC/FPL. 0.5% assumed rate is a placeholder — requires FRCC market monitor or FPL IRP 2024 published curtailment figure to move to T1.", sourceUrl: "https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data" },
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
  { id: "aemo-nsw-wind",    name: "New South Wales Wind",  country: "AUS", lat: -32.5, lon: 146.2, tier: "live", kind: "wind",  source: "AEMO NEMWeb wind SEMIDISPATCHCAP", sourceUrl: "https://nemweb.com.au/Reports/Current/Next_Day_Dispatch/" },
  { id: "aemo-nsw-solar",   name: "New South Wales Solar", country: "AUS", lat: -32.2, lon: 146.8, tier: "live", kind: "solar", source: "AEMO NEMWeb solar SEMIDISPATCHCAP", sourceUrl: "https://nemweb.com.au/Reports/Current/Next_Day_Dispatch/" },
  { id: "aemo-vic-wind",    name: "Victoria Wind",         country: "AUS", lat: -37.0, lon: 144.5, tier: "live", kind: "wind",  source: "AEMO NEMWeb wind SEMIDISPATCHCAP", sourceUrl: "https://nemweb.com.au/Reports/Current/Next_Day_Dispatch/" },
  { id: "aemo-vic-solar",   name: "Victoria Solar",        country: "AUS", lat: -36.7, lon: 145.1, tier: "live", kind: "solar", source: "AEMO NEMWeb solar SEMIDISPATCHCAP", sourceUrl: "https://nemweb.com.au/Reports/Current/Next_Day_Dispatch/" },
  { id: "aemo-qld-wind",    name: "Queensland Wind",       country: "AUS", lat: -22.0, lon: 144.7, tier: "live", kind: "wind",  source: "AEMO NEMWeb wind SEMIDISPATCHCAP", sourceUrl: "https://nemweb.com.au/Reports/Current/Next_Day_Dispatch/" },
  { id: "aemo-qld-solar",   name: "Queensland Solar",      country: "AUS", lat: -21.7, lon: 145.3, tier: "live", kind: "solar", source: "AEMO NEMWeb solar SEMIDISPATCHCAP", sourceUrl: "https://nemweb.com.au/Reports/Current/Next_Day_Dispatch/" },
  { id: "aemo-sa-wind",     name: "South Australia Wind",  country: "AUS", lat: -33.0, lon: 137.7, tier: "live", kind: "wind",  source: "AEMO NEMWeb wind SEMIDISPATCHCAP", sourceUrl: "https://nemweb.com.au/Reports/Current/Next_Day_Dispatch/" },
  { id: "aemo-sa-solar",    name: "South Australia Solar", country: "AUS", lat: -32.7, lon: 138.3, tier: "live", kind: "solar", source: "AEMO NEMWeb solar SEMIDISPATCHCAP", sourceUrl: "https://nemweb.com.au/Reports/Current/Next_Day_Dispatch/" },
  { id: "aemo-tas-wind",    name: "Tasmania Wind",         country: "AUS", lat: -42.0, lon: 146.5, tier: "live", kind: "wind",  source: "AEMO NEMWeb wind SEMIDISPATCHCAP", sourceUrl: "https://nemweb.com.au/Reports/Current/Next_Day_Dispatch/" },
  { id: "aemo-tas-solar",   name: "Tasmania Solar",        country: "AUS", lat: -41.7, lon: 147.1, tier: "live", kind: "solar", source: "AEMO NEMWeb solar SEMIDISPATCHCAP", sourceUrl: "https://nemweb.com.au/Reports/Current/Next_Day_Dispatch/" },
  { id: "belgium",          name: "Belgium",         country: "BEL", lat: 50.5, lon:    4.5, tier: "live", kind: "mixed", source: "Elia Open Data (wind+solar)", sourceUrl: "https://opendata.elia.be/" },
  { id: "iberia",           name: "Iberia",          country: "ESP", lat: 39.5, lon:   -3.5, tier: "live", kind: "mixed", source: "ENTSO-E", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "portugal",         name: "Portugal",        country: "PRT", lat: 39.5, lon:   -8.0, tier: "live", kind: "mixed", source: "ENTSO-E", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "germany",          name: "Germany",         country: "DEU", lat: 52.5, lon:   10.5, tier: "live", kind: "mixed", source: "ENTSO-E", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "finland",          name: "Finland",         country: "FIN", lat: 62.0, lon:   25.0, tier: "live", kind: "wind",  source: "ENTSO-E", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "france",           name: "France",          country: "FRA", lat: 46.5, lon:    2.5, tier: "live", kind: "mixed", source: "RTE eco2mix wind+solar", sourceUrl: "https://odre.opendatasoft.com/" },
  // Netherlands rate is a TenneT BritNed/COBRA cross-border-loss share rather
  // than a directly-published curtailment-as-fraction-of-generation; counted
  // as T1b live-domestic-anchored per B4 Option B (locked 2026-04-25). See
  // docs/proposals/b4-option-b-decision.md §"Post-B1 rerun (2026-04-26)".
  { id: "netherlands",      name: "Netherlands",     country: "NLD", lat: 52.2, lon:    5.3, tier: "live-domestic-anchored", kind: "mixed", source: "ENTSO-E", sourceUrl: "https://transparency.entsoe.eu/" },
  // Denmark split by Energinet PriceArea. DK1 (Jutland/Fyn) hosts most
  // onshore wind and is interconnected to Germany; DK2 (Zealand) sits
  // across the Øresund from Sweden. Energi Data Service is natively zonal;
  // split 75/25 reflects DK1's share of combined wind+solar generation.
  { id: "denmark-west",      name: "Denmark DK1",     country: "DNK", lat: 56.2, lon:    9.1, tier: "live", kind: "mixed", source: "Energinet wind+solar (DK1)", sourceUrl: "https://api.energidataservice.dk/" },
  { id: "denmark-east",      name: "Denmark DK2",     country: "DNK", lat: 55.4, lon:   12.3, tier: "live", kind: "mixed", source: "Energinet wind+solar (DK2)", sourceUrl: "https://api.energidataservice.dk/" },
  { id: "poland",           name: "Poland",          country: "POL", lat: 52.0, lon:   19.0, tier: "live", kind: "mixed", source: "ENTSO-E", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "greece",           name: "Greece",          country: "GRC", lat: 39.0, lon:   22.0, tier: "live", kind: "mixed", source: "ENTSO-E", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "romania",          name: "Romania",         country: "ROU", lat: 45.9, lon:   25.0, tier: "live", kind: "mixed", source: "ENTSO-E", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "turkey",           name: "Turkey",          country: "TUR", lat: 39.0, lon:   35.0, tier: "live", kind: "mixed", source: "EPIAS Transparency dashboard wind+solar", sourceUrl: "https://seffaflik.epias.com.tr/electricity-service/v1/dashboard/realtime-generation" },
  // italy-north-zone uses a Terna national-MSD-share rate rather than a
  // North-zone-specific MSD figure; T1b live-domestic-anchored per B4
  // Option B (modelled-share scope mismatch).
  { id: "italy-north-zone", name: "Italy North",     country: "ITA", lat: 45.0, lon:   10.0, tier: "live-domestic-anchored", kind: "mixed", source: "ENTSO-E Terna (North zone)", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "italy-south",     name: "Italy South",     country: "ITA", lat: 40.5, lon:   16.0, tier: "live", kind: "mixed", source: "ENTSO-E Terna (South zone)", sourceUrl: "https://transparency.entsoe.eu/" },
  // italy-sardinia uses the Terna national MSD rate scaled to Sardinia's
  // wind+PV share — a modelled-share split that captures the wrong scope.
  // T1b live-domestic-anchored per B4 Option B (post-B1 P67 +87.6% residual).
  { id: "italy-sardinia",  name: "Sardinia",        country: "ITA", lat: 40.1, lon:    9.1, tier: "live-domestic-anchored", kind: "mixed", source: "ENTSO-E Terna (Sardinia)", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "sweden-north",     name: "Sweden North",    country: "SWE", lat: 63.5, lon:   18.5, tier: "live", kind: "wind",  source: "ENTSO-E", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "sweden-south",     name: "Sweden South",    country: "SWE", lat: 56.0, lon:   14.0, tier: "live", kind: "mixed", source: "ENTSO-E", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "ukraine",          name: "Ukraine",         country: "UKR", lat: 48.38, lon: 31.17, tier: "static", kind: "solar", source: "Ember Ukraine 2024 (ENTSO-E absent post-war)", sourceUrl: "https://ember-energy.org/global-insights/ukraine-electricity-tracker/" },
  { id: "hungary",          name: "Hungary",         country: "HUN", lat: 47.16, lon: 19.50, tier: "live", kind: "mixed", source: "ENTSO-E MAVIR", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "czech-republic",   name: "Czech Republic",  country: "CZE", lat: 49.82, lon: 15.47, tier: "live", kind: "mixed", source: "ENTSO-E CEPS", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "bulgaria",         name: "Bulgaria",        country: "BGR", lat: 42.73, lon:   25.49, tier: "live", kind: "mixed", source: "ENTSO-E ESO", sourceUrl: "https://transparency.entsoe.eu/" },
  // baltics uses a Litgrid Estonia-share extrapolation across the three
  // Baltic states rather than a published Baltic curtailment rate.
  // T1b live-domestic-anchored per B4 Option B (modelled-share split).
  { id: "baltics",          name: "Baltic states",   country: "EST", lat: 57.0,  lon: 24.0,  tier: "live-domestic-anchored", kind: "wind",  source: "ENTSO-E Litgrid", sourceUrl: "https://transparency.entsoe.eu/" },
  // GB split — NESO Markets Roadmap 2024 reports ~11 TWh/yr of constraint
  // actions, dominated by the Scotland-to-England export boundary. Split
  // 70/30 at consumption: Scotland carries the bulk of curtailed wind.
  { id: "gb-scotland",      name: "GB Scotland",     country: "GBR", lat: 56.8, lon:   -4.2, tier: "live", kind: "wind",  source: "Elexon BMRS wind+solar (Scotland share, ~70% via NESO constraint boundary)", sourceUrl: "https://www.neso.energy/data-portal/monthly-operational-metered-wind-output" },
  { id: "gb-england-wales", name: "GB England+Wales", country: "GBR", lat: 52.9, lon:  -1.8, tier: "live", kind: "mixed", source: "Elexon BMRS wind+solar (England+Wales share)", sourceUrl: "https://www.elexon.co.uk/data/" },
  // Brazil ONS constrained-off split by state and technology. The loader
  // fetches ONS wind and solar CSV families separately, so dashboard rows
  // remain single-fuel instead of using a bundled wind+solar state bar.
  { id: "brazil-rn-wind",        name: "Rio Grande do Norte Wind", country: "BRA", lat: -5.8, lon: -36.5, tier: "live", kind: "wind",  source: "ONS wind constrained-off", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-rn-solar",       name: "Rio Grande do Norte Solar", country: "BRA", lat: -5.6, lon: -36.1, tier: "live", kind: "solar", source: "ONS solar constrained-off", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-ce-wind",        name: "Ceara Wind",                country: "BRA", lat: -5.0, lon: -39.2, tier: "live", kind: "wind",  source: "ONS wind constrained-off", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-ce-solar",       name: "Ceara Solar",               country: "BRA", lat: -4.8, lon: -38.8, tier: "live", kind: "solar", source: "ONS solar constrained-off", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-bahia-wind",     name: "Bahia Wind",                country: "BRA", lat: -11.0, lon: -41.2, tier: "live", kind: "wind",  source: "ONS wind constrained-off", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-bahia-solar",    name: "Bahia Solar",               country: "BRA", lat: -10.8, lon: -40.8, tier: "live", kind: "solar", source: "ONS solar constrained-off", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-piaui-wind",     name: "Piaui Wind",                country: "BRA", lat: -8.0, lon: -43.2, tier: "live", kind: "wind",  source: "ONS wind constrained-off", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-piaui-solar",    name: "Piaui Solar",               country: "BRA", lat: -7.8, lon: -42.8, tier: "live", kind: "solar", source: "ONS solar constrained-off", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-pernambuco-wind", name: "Pernambuco Wind",          country: "BRA", lat: -8.0, lon: -37.7, tier: "live", kind: "wind",  source: "ONS wind constrained-off", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-pernambuco-solar", name: "Pernambuco Solar",        country: "BRA", lat: -7.8, lon: -37.3, tier: "live", kind: "solar", source: "ONS solar constrained-off", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-paraiba-wind",   name: "Paraiba Wind",              country: "BRA", lat: -7.1, lon: -36.9, tier: "live", kind: "wind",  source: "ONS wind constrained-off", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-paraiba-solar",  name: "Paraiba Solar",             country: "BRA", lat: -6.9, lon: -36.5, tier: "live", kind: "solar", source: "ONS solar constrained-off", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-maranhao-wind",  name: "Maranhao Wind",             country: "BRA", lat: -5.0, lon: -45.5, tier: "live", kind: "wind",  source: "ONS wind constrained-off", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-maranhao-solar", name: "Maranhao Solar",            country: "BRA", lat: -4.8, lon: -45.1, tier: "live", kind: "solar", source: "ONS solar constrained-off", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-other-wind",     name: "Brazil Other ONS States Wind", country: "BRA", lat: -18.0, lon: -50.2, tier: "live", kind: "wind",  source: "ONS wind constrained-off", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-other-solar",    name: "Brazil Other ONS States Solar", country: "BRA", lat: -17.8, lon: -49.8, tier: "live", kind: "solar", source: "ONS solar constrained-off", sourceUrl: "https://www.ons.org.br/" },
  // Norway split into 5 ENTSO-E bidding zones (2026-04-24). Prior
  // `n-norway` aggregated only NO4 — the northern export-constrained
  // zone — and left ~80% of Norwegian renewable generation unmodelled,
  // including NO2 which hosts the Sørlige Nordsjø II offshore wind
  // programme and the landing points for NorNed, NordLink, and the
  // North Sea Link interconnectors. Lat/lon are zone centroids.
  { id: "norway-no1",       name: "Norway NO1 (Oslo)",         country: "NOR", lat: 59.9, lon:   10.7, tier: "live", kind: "mixed", source: "ENTSO-E NO1 hydro+wind (load-centre, low curtailment)", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "norway-no2",       name: "Norway NO2 (Kristiansand)", country: "NOR", lat: 58.2, lon:    7.6, tier: "live", kind: "mixed", source: "ENTSO-E NO2 hydro+offshore wind (NorNed/NordLink/NSL cable zone)", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "norway-no3",       name: "Norway NO3 (Trondheim)",    country: "NOR", lat: 63.4, lon:   10.4, tier: "live", kind: "mixed", source: "ENTSO-E NO3 hydro+onshore wind", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "norway-no4",       name: "Norway NO4 (Tromsø)",       country: "NOR", lat: 68.5, lon:   17.5, tier: "live", kind: "mixed", source: "ENTSO-E NO4 hydro+wind (export-constrained north; former n-norway)", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "norway-no5",       name: "Norway NO5 (Bergen)",       country: "NOR", lat: 60.4, lon:    5.3, tier: "live", kind: "hydro", source: "ENTSO-E NO5 reservoir hydro (spring-spill only)", sourceUrl: "https://transparency.entsoe.eu/" },
  // Switzerland — PV-only ENTSO-E feed via Swissgrid. Hydro spill is
  // not captured in A75 data, so this understates total Swiss
  // curtailment but captures the fastest-growing summer-midday PV
  // oversupply component. The calibration rate is extrapolated from
  // the Czech Republic CEPS rate (no domestic Swiss rate is published),
  // so this is T1c live-neighbour-anchored per B4 Option B (post-B1
  // empirical residual −35.5%).
  { id: "switzerland",      name: "Switzerland",     country: "CHE", lat: 46.8, lon:    8.2, tier: "live-neighbour-anchored", kind: "solar", source: "ENTSO-E Swissgrid PV-only (hydro spill not in A75)", sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "ontario-wind",     name: "Ontario Wind",    country: "CAN", lat: 44.0, lon:  -81.0, tier: "live", kind: "wind",  source: "IESO wind generation capability", sourceUrl: "https://reports-public.ieso.ca/public/GenOutputCapability/" },
  { id: "ontario-solar",    name: "Ontario Solar",   country: "CAN", lat: 43.8, lon:  -80.5, tier: "live", kind: "solar", source: "IESO solar generation capability", sourceUrl: "https://reports-public.ieso.ca/public/GenOutputCapability/" },
  { id: "alberta-wind",     name: "Alberta Wind",    country: "CAN", lat: 51.5, lon: -114.0, tier: "live", kind: "wind",  source: "AESO wind snapshot", sourceUrl: "http://ets.aeso.ca/ets_web/ip/Market/Reports/CSDReportServlet" },
  { id: "alberta-solar",    name: "Alberta Solar",   country: "CAN", lat: 51.0, lon: -113.5, tier: "live", kind: "solar", source: "AESO solar snapshot", sourceUrl: "http://ets.aeso.ca/ets_web/ip/Market/Reports/CSDReportServlet" },
  // Ireland loader emits both children from one EirGrid/SONI DD half-hourly
  // workbook fetch. The all-island half-hourly DD feed is split 58/42 using
  // the 2024 annual ROI/NI anchor.
  { id: "ireland-republic", name: "Ireland (Republic)",  country: "IRL", lat: 53.3, lon:   -7.8, tier: "live", kind: "wind",  source: "EirGrid/SONI DD half-hourly workbook (ROI 58% of all-island DD)", sourceUrl: "https://www.eirgrid.ie/grid/system-and-renewable-data-reports" },
  { id: "northern-ireland", name: "Northern Ireland",    country: "GBR", lat: 54.65, lon:  -6.65, tier: "live", kind: "wind",  source: "EirGrid/SONI DD half-hourly workbook (NI 42% of all-island DD)", sourceUrl: "https://www.eirgrid.ie/grid/system-and-renewable-data-reports" },
  { id: "peru-hydro",       name: "Peru Hydro",       country: "PER", lat: -12.5, lon: -75.0, tier: "live", kind: "hydro", source: "COES-SINAC live hydro generation × 2% curtailment calibration (vertimiento anchor ~0.8 TWh/yr)", sourceUrl: "https://www.coes.org.pe/Portal/portalinformacion/generacion" },
  { id: "peru-solar",       name: "Peru Solar",       country: "PER", lat: -14.0, lon: -71.5, tier: "live", kind: "solar", source: "COES-SINAC live solar generation × 2% curtailment calibration (vertimiento anchor ~0.8 TWh/yr)", sourceUrl: "https://www.coes.org.pe/Portal/portalinformacion/generacion" },
  { id: "peru-wind",        name: "Peru Wind",        country: "PER", lat: -17.0, lon: -72.0, tier: "live", kind: "wind",  source: "COES-SINAC live wind generation × 2% curtailment calibration (vertimiento anchor ~0.8 TWh/yr)", sourceUrl: "https://www.coes.org.pe/Portal/portalinformacion/generacion" },
  { id: "south-africa-solar", name: "South Africa Solar", country: "ZAF", lat: -29.0, lon:  22.0, tier: "live", kind: "solar", source: "Eskom Data Portal total hourly renewable generation (PV+CSP columns × 12% curtailment)", sourceUrl: "https://www.eskom.co.za/dataportal/renewables-performance/total-hourly-renewable-generation/" },
  { id: "south-africa-wind",  name: "South Africa Wind",  country: "ZAF", lat: -33.5, lon:  25.5, tier: "live", kind: "wind", source: "Eskom Data Portal total hourly renewable generation (Wind column × 12% curtailment)", sourceUrl: "https://www.eskom.co.za/dataportal/renewables-performance/total-hourly-renewable-generation/" },
  { id: "new-zealand",      name: "New Zealand",     country: "NZL", lat: -40.9, lon: 172.0, tier: "live", kind: "mixed", source: "EMI wind+solar+geo", sourceUrl: "https://www.emi.ea.govt.nz/Wholesale/Datasets/Generation/Generation_MD" },
  { id: "atacama",          name: "Atacama",         country: "CHL", lat: -24.5, lon: -69.2, tier: "live",   kind: "solar", source: "CEN Chile XLSX", sourceUrl: "https://www.coordinador.cl/operacion/documentos/reducciones-de-generacion-renovable/" },
  { id: "chile-wind",       name: "Chile Wind",      country: "CHL", lat: -38.5, lon: -72.5, tier: "live",   kind: "wind",  source: "CEN Chile monthly XLSX wind reductions", sourceUrl: "https://www.coordinador.cl/operacion/documentos/reducciones-de-generacion-renovable/" },
  // Tier 2 - static fallback regions
  { id: "sichuan",          name: "Sichuan",         country: "CHN", lat: 30.6, lon:  102.8, tier: "static", kind: "hydro", source: "NEA 2024 / Sichuan hydro-spill proxy", sourceUrl: "https://www.nea.gov.cn/20251113/cc1fb0298a2944f8bd5441f67c9be9b3/c.html" },
  { id: "xinjiang",         name: "Xinjiang",        country: "CHN", lat: 41.5, lon:   85.0, tier: "static", kind: "solar", source: "NEA 2024 / Huaon-NBS generation", sourceUrl: "https://www.nea.gov.cn/20251113/cc1fb0298a2944f8bd5441f67c9be9b3/c.html" },
  { id: "inner-mongolia",   name: "Inner Mongolia",  country: "CHN", lat: 43.0, lon:  112.0, tier: "static", kind: "wind",  source: "NEA 2024 / Huaon-NBS generation", sourceUrl: "https://www.nea.gov.cn/20251113/cc1fb0298a2944f8bd5441f67c9be9b3/c.html" },
  { id: "gansu",            name: "Gansu",           country: "CHN", lat: 39.0, lon:   97.0, tier: "static", kind: "mixed", source: "NEA 2024 / Gansu MIIT generation", sourceUrl: "https://www.nea.gov.cn/20251113/cc1fb0298a2944f8bd5441f67c9be9b3/c.html" },
  { id: "qinghai",          name: "Qinghai",         country: "CHN", lat: 36.0, lon:   98.0, tier: "static", kind: "solar", source: "NEA 2024 / Huaon-NBS generation", sourceUrl: "https://www.nea.gov.cn/20251113/cc1fb0298a2944f8bd5441f67c9be9b3/c.html" },
  { id: "ningxia",          name: "Ningxia",         country: "CHN", lat: 37.5, lon:  106.0, tier: "static", kind: "mixed", source: "NEA 2024 / Huaon-NBS generation", sourceUrl: "https://www.nea.gov.cn/20251113/cc1fb0298a2944f8bd5441f67c9be9b3/c.html" },
  { id: "yunnan",           name: "Yunnan",          country: "CHN", lat: 25.0, lon:  101.5, tier: "static", kind: "hydro", source: "NEA 2024 / Yunnan statistics", sourceUrl: "https://www.nea.gov.cn/20251113/cc1fb0298a2944f8bd5441f67c9be9b3/c.html" },
  { id: "tibet",            name: "Tibet (Xizang)",  country: "CHN", lat: 30.0, lon:   90.0, tier: "static", kind: "hydro", source: "NEA 2024 / Huaon-NBS generation", sourceUrl: "https://www.nea.gov.cn/20251113/cc1fb0298a2944f8bd5441f67c9be9b3/c.html" },
  { id: "iceland",          name: "Iceland",         country: "ISL", lat: 64.9, lon:  -19.0, tier: "static", kind: "hydro", source: "Published", sourceUrl: "https://orkustofnun.is/" },
  { id: "argentina",        name: "Argentina",       country: "ARG", lat: -43.0, lon: -65.0, tier: "static", kind: "wind",  source: "CAMMESA / IRENA fallback", sourceUrl: "https://cammesaweb.cammesa.com/" },
  { id: "uruguay",          name: "Uruguay",         country: "URY", lat: -33.5, lon: -56.0, tier: "live", kind: "wind",  source: "ADME hourly Restricciones Operativas workbook", sourceUrl: "https://www.adme.com.uy/panelControl/ro_excel.php" },
  { id: "paraguay",         name: "Paraguay",        country: "PRY", lat: -25.4, lon: -54.6, tier: "static", kind: "hydro", source: "Itaipu fallback", sourceUrl: "https://www.itaipu.gov.py/" },
  { id: "mexico",           name: "Mexico",          country: "MEX", lat: 25.0, lon: -103.0, tier: "static", kind: "solar", source: "CENACE fallback", sourceUrl: "https://www.cenace.gob.mx/SIM/Reportes/" },
  { id: "japan",            name: "Japan",           country: "JPN", lat: 33.0, lon:  131.0, tier: "live",   kind: "solar", source: "Kyushu Electric area-demand CSV (5-min solar) × 10% calibrated curtailment (Kyushu 2024 anchor: ~1.7 TWh/yr)", sourceUrl: "https://www.kyuden.co.jp/td_power_usages/pc.html" },
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
  { id: "wa-swis-solar", name: "Western Australia Solar (SWIS)", country: "AUS", lat: -28.8, lon: 114.6, tier: "live", kind: "solar", source: "AEMO WEM Facility SCADA (solar DUIDs)", sourceUrl: "https://data.wa.aemo.com.au/" },
  { id: "wa-swis-wind",  name: "Western Australia Wind (SWIS)", country: "AUS", lat: -35.0, lon: 117.9, tier: "live", kind: "wind", source: "AEMO WEM Facility SCADA (wind DUIDs)", sourceUrl: "https://data.wa.aemo.com.au/" },
  { id: "nt-pilbara",       name: "NT & Pilbara",    country: "AUS", lat: -22.0, lon: 118.0, tier: "static", kind: "solar", source: "Horizon/Pilbara fallback", sourceUrl: "https://www.horizonpower.com.au/" },
  { id: "indonesia",        name: "Indonesia",       country: "IDN", lat:  -7.0, lon: 110.0, tier: "static", kind: "solar", source: "PLN fallback", sourceUrl: "https://web.pln.co.id/" },
  { id: "malaysia",         name: "Malaysia",        country: "MYS", lat:   3.5, lon: 102.0, tier: "static", kind: "solar", source: "IRENA/ST 2024 anchor; GSO real-time solar feed is generation-only/current-day, not 30-day curtailment", sourceUrl: "https://www.gso.org.my/" },
  { id: "philippines-solar", name: "Philippines Solar", country: "PHL", lat: 14.6, lon: 121.0, tier: "static", kind: "solar", source: "IRENA Philippines RE Statistics 2024 anchor; IEMOP RTD endpoint exposes current-day dispatch schedules, not curtailed-energy. The 2% rate previously applied was an invented placeholder with no published source. Held at T3 until IEMOP/WESM publishes a citable curtailment rate.", sourceUrl: "https://www.iemop.ph/market-data/rtd-prices-and-schedules/" },
  { id: "philippines-wind",  name: "Philippines Wind",  country: "PHL", lat: 14.6, lon: 121.0, tier: "static", kind: "wind",  source: "IRENA Philippines RE Statistics 2024 anchor; IEMOP RTD endpoint exposes current-day dispatch schedules, not curtailed-energy. The 2% rate previously applied was an invented placeholder with no published source. Held at T3 until IEMOP/WESM publishes a citable curtailment rate.", sourceUrl: "https://www.iemop.ph/market-data/rtd-prices-and-schedules/" },
  { id: "south-korea",      name: "South Korea (mainland)", country: "KOR", lat: 35.5, lon: 127.0, tier: "static", kind: "solar", source: "KPX fallback", sourceUrl: "https://www.kpx.or.kr/eng/" },
  { id: "russia-mainland",  name: "Russia (European grid)", country: "RUS", lat: 55.8, lon:  38.0, tier: "static", kind: "hydro", source: "SO UES fallback", sourceUrl: "https://www.so-ups.ru/" },
  { id: "taiwan",           name: "Taiwan",          country: "TWN", lat:  23.9, lon: 120.4, tier: "static", kind: "mixed", source: "TAIPOWER/TREC/IRENA 2024 anchor; genary.json is current unit output, not a 30-day public curtailment archive", sourceUrl: "https://www.taipower.com.tw/d006/loadGraph/loadGraph/genshx_.html" },
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
  { id: "brazil-mg-wind",   name: "Minas Gerais Wind", country: "BRA", lat: -18.0, lon: -44.2, tier: "live", kind: "wind",  source: "ONS wind constrained-off", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-mg-solar",  name: "Minas Gerais Solar", country: "BRA", lat: -17.8, lon: -43.8, tier: "live", kind: "solar", source: "ONS solar constrained-off", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-sp-wind",   name: "Sao Paulo Wind", country: "BRA", lat: -22.5, lon: -48.2, tier: "live", kind: "wind",  source: "ONS wind constrained-off", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-sp-solar",  name: "Sao Paulo Solar", country: "BRA", lat: -22.3, lon: -47.8, tier: "live", kind: "solar", source: "ONS solar constrained-off", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-mt-wind",   name: "Mato Grosso Wind", country: "BRA", lat: -13.0, lon: -56.2, tier: "live", kind: "wind",  source: "ONS wind constrained-off", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-mt-solar",  name: "Mato Grosso Solar", country: "BRA", lat: -12.8, lon: -55.8, tier: "live", kind: "solar", source: "ONS solar constrained-off", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-go-wind",   name: "Goias Wind", country: "BRA", lat: -16.0, lon: -49.7, tier: "live", kind: "wind",  source: "ONS wind constrained-off", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-go-solar",  name: "Goias Solar", country: "BRA", lat: -15.8, lon: -49.3, tier: "live", kind: "solar", source: "ONS solar constrained-off", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-pr-wind",   name: "Parana Wind", country: "BRA", lat: -25.0, lon: -52.2, tier: "live", kind: "wind",  source: "ONS wind constrained-off", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-pr-solar",  name: "Parana Solar", country: "BRA", lat: -24.8, lon: -51.8, tier: "live", kind: "solar", source: "ONS solar constrained-off", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-rs-wind",   name: "Rio Grande do Sul Wind", country: "BRA", lat: -30.0, lon: -53.2, tier: "live", kind: "wind",  source: "ONS wind constrained-off", sourceUrl: "https://www.ons.org.br/" },
  { id: "brazil-rs-solar",  name: "Rio Grande do Sul Solar", country: "BRA", lat: -29.8, lon: -52.8, tier: "live", kind: "solar", source: "ONS solar constrained-off", sourceUrl: "https://www.ons.org.br/" },
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
  // Phase-2.7 Pattern-D Latin-America bulk-add (2026-04-27, codex/phase-27-latam-pattern-d).
  // Sixteen Caribbean + Central American + small South American grids tagged
  // `recommended_action: introduce-as-T3` in the audit
  // `data/coverage-audit/2026-04-26-latin-america.csv`. Each row is a sub-1 TWh
  // anchor, all T3-modelled (±40% envelope) per the canonical Pattern-D entry
  // pattern documented at `docs/proposals/2026-04-27-phase-2-7-pattern-d-dispatch.md` §3.
  // No fetch logic — the matching `STATIC_REGIONS` entries in
  // `src/data/statics.json.ts` carry the typical-shape × annual-TWh dispatch.
  // lat/lon are capital-city coordinates unless noted otherwise.
  { id: "guatemala",          name: "Guatemala",            country: "GTM", lat: 14.6, lon:  -90.5, tier: "static", kind: "solar", source: "IRENA Renewable Energy Statistics 2024 (Guatemala VRE share) + AMM Plan Operativo 2024", sourceUrl: "https://www.amm.org.gt/" },
  { id: "el-salvador",        name: "El Salvador",          country: "SLV", lat: 13.7, lon:  -89.2, tier: "static", kind: "solar", source: "IRENA Renewable Energy Statistics 2024 (El Salvador VRE share)", sourceUrl: "https://www.ut.com.sv/" },
  { id: "nicaragua",          name: "Nicaragua",            country: "NIC", lat: 12.1, lon:  -86.3, tier: "static", kind: "solar", source: "IRENA Nicaragua VRE statistics 2024 (CNDC/ENATREL weekly bulletins)", sourceUrl: "https://www.enatrel.gob.ni/" },
  { id: "costa-rica",         name: "Costa Rica",           country: "CRI", lat: 9.93, lon:  -84.1, tier: "static", kind: "hydro", source: "IRENA Costa Rica 2024 (98% renewable; hydro spill not anchored to hourly feed; ICE/CENCE)", sourceUrl: "https://www.grupoice.com/" },
  { id: "panama",             name: "Panama",               country: "PAN", lat: 8.98, lon:  -79.5, tier: "static", kind: "solar", source: "Secretaria Nacional de Energia 2024 (solar+wind ~10%; ETESA/CND PDF reports)", sourceUrl: "https://www.etesa.com.pa/" },
  { id: "guatemala-siepac",   name: "Central America (SIEPAC)", country: "GTM", lat: 13.7, lon:  -86.0, tier: "static", kind: "solar", source: "IRENA Central America Interconnect 2024 (SIEPAC corridor; EOR Ente Operador Regional)", sourceUrl: "https://www.enteoperador.org/" },
  { id: "cuba",               name: "Cuba",                 country: "CUB", lat: 23.1, lon:  -82.4, tier: "static", kind: "mixed", source: "Cuba UNE 2022-24 grid restoration + Ember Cuba Electricity Review 2024 (post-Hurricane-Ian grid stress; not steady-state anchor)", sourceUrl: "https://www.une.cu/" },
  { id: "dominican-republic", name: "Dominican Republic",   country: "DOM", lat: 18.5, lon:  -69.9, tier: "static", kind: "solar", source: "IRENA Dominican Republic 2024 + OC reports; OC live endpoint is total generation, not renewable curtailment", sourceUrl: "https://www.oc.org.do/" },
  { id: "jamaica",            name: "Jamaica",              country: "JAM", lat: 18.0, lon:  -76.8, tier: "static", kind: "solar", source: "Office of Utilities Regulation Jamaica Annual Report 2024 (Wigton wind + Content solar)", sourceUrl: "https://www.jpsco.com/" },
  { id: "trinidad-tobago",    name: "Trinidad & Tobago",    country: "TTO", lat: 10.7, lon:  -61.5, tier: "static", kind: "flare", source: "GGFR 2024 Trinidad offshore flares ~1 BCM (upstream offshore flare lifted onto T&TEC grid coverage)", sourceUrl: "https://ttec.co.tt/" },
  { id: "barbados",           name: "Barbados",             country: "BRB", lat: 13.1, lon:  -59.6, tier: "static", kind: "solar", source: "IRENA Barbados Renewables 2024 (rooftop PV; at inclusion threshold)", sourceUrl: "https://www.blpc.com.bb/" },
  { id: "bolivia",            name: "Bolivia",              country: "BOL", lat: -16.5, lon: -68.2, tier: "static", kind: "solar", source: "IRENA Bolivia 2024 (hydro+gas dominated grid; solar+wind ~3% of mix; CNDC PDF reports)", sourceUrl: "https://www.cndc.bo/" },
  { id: "ecuador",            name: "Ecuador",              country: "ECU", lat: -0.18, lon: -78.5, tier: "static", kind: "hydro", source: "IRENA Ecuador 2024 (hydro-dominated; CENACE Ecuador PDF reports; at inclusion threshold)", sourceUrl: "https://www.cenace.gob.ec/" },
  { id: "guyana",             name: "Guyana",               country: "GUY", lat: 6.80, lon:  -58.2, tier: "static", kind: "flare", source: "GGFR 2024 Guyana Stabroek block flaring offshore (Liza FPSO; upstream off-grid lifted onto GPL coverage)", sourceUrl: "https://www.gplinc.com/" },
  { id: "suriname",           name: "Suriname",             country: "SUR", lat: 5.85, lon:  -55.2, tier: "static", kind: "flare", source: "GGFR 2024 Suriname Block 58 offshore flaring forecast (upstream off-grid; at inclusion threshold)", sourceUrl: "https://www.nvebs.com/" },
  { id: "french-guiana",      name: "French Guiana",        country: "GUF", lat: 4.92, lon:  -52.3, tier: "static", kind: "solar", source: "EDF SEI Bilan Previsionnel Guyane 2024 (below normal inclusion threshold; included for completeness as the only South-American French overseas territory)", sourceUrl: "https://www.edf.fr/edf-sei/" },
  // Phase-2.7 Pattern-D — Africa bulk-add (2026-04-27).
  // 32 audit rows tagged `recommended_action: introduce-as-T3` in
  // `data/coverage-audit/2026-04-26-africa.csv`; 6 sub-0.05 TWh rows skipped
  // (Burundi, Gambia, Lesotho, Liberia, Seychelles, Sierra Leone). Net 26
  // T3-modelled statics; ~11.7 TWh aggregate anchor. ±40% envelope.
  // Lat/lon = capital city by default (operator-published curtailment is
  // country-level, not zone-level, so a single capital point is the most
  // honest representation). Region.kind reflects the dominant fuel of the
  // grid; the StaticSpec.kind in src/data/statics.json.ts may collapse
  // hydro/mixed to a flat profile when no curated seasonal-share data is
  // available — both still land at T3-modelled.
  // See `docs/proposals/2026-04-27-phase-2-7-pattern-d-dispatch.md` §3 +
  // §4 CODEX-PHASE27-AFR for the canonical pattern.
  { id: "algeria",          name: "Algeria",           country: "DZA", lat:  36.75, lon:    3.06, tier: "static", kind: "solar", source: "IRENA Country Statistics 2024 (Algeria SONELGAZ/OS, ~1.5 GW wind+PV)", sourceUrl: "https://www.grte.dz/" },
  { id: "angola",           name: "Angola",            country: "AGO", lat:  -8.84, lon:   13.23, tier: "static", kind: "solar", source: "IRENA Angola 2024 (RNT transmission; nascent solar)", sourceUrl: "https://www.rnt.co.ao/" },
  { id: "benin",            name: "Benin",             country: "BEN", lat:   6.37, lon:    2.39, tier: "static", kind: "solar", source: "IRENA Benin 2024 (SBEE; imports ~80% via WAPP)", sourceUrl: "https://sbee.bj/" },
  { id: "botswana",         name: "Botswana",          country: "BWA", lat: -24.65, lon:   25.91, tier: "static", kind: "solar", source: "IRENA Botswana 2024 (BPC; SAPP member; Mmadinare PV)", sourceUrl: "https://www.bpc.bw/" },
  { id: "burkina-faso",     name: "Burkina Faso",      country: "BFA", lat:  12.37, lon:   -1.52, tier: "static", kind: "solar", source: "IRENA Burkina Faso 2024 (SONABEL; Zagtouli + Nagreongo PV ~70 MW)", sourceUrl: "https://www.sonabel.bf/" },
  { id: "cabo-verde",       name: "Cabo Verde",        country: "CPV", lat:  14.93, lon:  -23.51, tier: "static", kind: "mixed", source: "IRENA Cabo Verde 2024 (ELECTRA; 9-island system; high VRE)", sourceUrl: "https://www.electra.cv/" },
  { id: "cameroon",         name: "Cameroon",          country: "CMR", lat:   3.85, lon:   11.50, tier: "static", kind: "hydro", source: "IRENA Cameroon 2024 (ENEO/SONATREL; mostly hydro)", sourceUrl: "https://eneo.cm/" },
  { id: "congo-drc",        name: "DR Congo",          country: "COD", lat:  -4.32, lon:   15.32, tier: "static", kind: "hydro", source: "IRENA DRC 2024 (SNEL; Inga hydro complex ~2.5 GW; SAPP)", sourceUrl: "https://www.snel.cd/" },
  { id: "cote-divoire",     name: "Cote d'Ivoire",     country: "CIV", lat:   5.32, lon:   -4.02, tier: "static", kind: "mixed", source: "IRENA Cote d'Ivoire 2024 (CIE; major WAPP exporter)", sourceUrl: "https://www.cie.ci/" },
  { id: "eswatini",         name: "Eswatini",          country: "SWZ", lat: -26.31, lon:   31.13, tier: "static", kind: "mixed", source: "IRENA Eswatini 2024 (EEC; SAPP member; biomass+hydro)", sourceUrl: "https://www.eec.co.sz/" },
  { id: "gabon",            name: "Gabon",             country: "GAB", lat:   0.42, lon:    9.45, tier: "static", kind: "hydro", source: "IRENA Gabon 2024 (SEEG; hydro+gas; flaring relevant)", sourceUrl: "https://www.seeg-gabon.com/" },
  { id: "ghana",            name: "Ghana",             country: "GHA", lat:   5.61, lon:   -0.20, tier: "static", kind: "hydro", source: "Ember Ghana 2024 (GRIDCo TSO; Akosombo hydro + PV)", sourceUrl: "https://www.gridcogh.com/" },
  { id: "madagascar",       name: "Madagascar",        country: "MDG", lat: -18.88, lon:   47.51, tier: "static", kind: "hydro", source: "IRENA Madagascar 2024 (JIRAMA; hydro+thermal isolated grids)", sourceUrl: "https://www.jirama.mg/" },
  { id: "malawi",           name: "Malawi",            country: "MWI", lat: -13.95, lon:   33.78, tier: "static", kind: "hydro", source: "IRENA Malawi 2024 (ESCOM/EGENCO; Shire hydro + Salima PV; SAPP)", sourceUrl: "https://www.escom.mw/" },
  { id: "mauritania",       name: "Mauritania",        country: "MRT", lat:  18.07, lon:  -15.97, tier: "static", kind: "wind",  source: "IRENA Mauritania 2024 (SOMELEC; Boulenouar wind 100 MW + Sheikh Zayed PV)", sourceUrl: "https://somelec.mr/" },
  { id: "mauritius",        name: "Mauritius",         country: "MUS", lat: -20.16, lon:   57.51, tier: "static", kind: "mixed", source: "IRENA Mauritius 2024 (CEB; bagasse+coal+oil + PV; island)", sourceUrl: "https://ceb.mu/" },
  { id: "mozambique",       name: "Mozambique",        country: "MOZ", lat: -25.97, lon:   32.58, tier: "static", kind: "hydro", source: "IRENA Mozambique 2024 (EDM; Cahora Bassa hydro; SAPP)", sourceUrl: "https://www.edm.co.mz/" },
  { id: "nigeria",          name: "Nigeria",           country: "NGA", lat:   9.00, lon:    8.50, tier: "static", kind: "mixed", source: "Ember Nigeria 2024 + GGFR Niger Delta flaring 2024-25 (TCN; load-shed + ~7 TWh-eq/yr flare composite)", sourceUrl: "https://www.tcn.org.ng/" },
  { id: "rwanda",           name: "Rwanda",            country: "RWA", lat:  -1.94, lon:   30.06, tier: "static", kind: "mixed", source: "IRENA Rwanda 2024 (REG/EUCL; Lake Kivu methane + hydro+solar)", sourceUrl: "https://www.reg.rw/" },
  { id: "senegal",          name: "Senegal",           country: "SEN", lat:  14.69, lon:  -17.45, tier: "static", kind: "mixed", source: "IRENA Senegal 2024 (SENELEC; Taiba N'Diaye 158 MW wind + PV)", sourceUrl: "https://www.senelec.sn/" },
  { id: "tanzania",         name: "Tanzania",          country: "TZA", lat:  -6.79, lon:   39.21, tier: "static", kind: "hydro", source: "IRENA Tanzania 2024 + JNHPP commissioning (TANESCO; gas+hydro)", sourceUrl: "https://www.tanesco.co.tz/" },
  { id: "togo",             name: "Togo",              country: "TGO", lat:   6.13, lon:    1.22, tier: "static", kind: "solar", source: "IRENA Togo 2024 (CEET; WAPP imports; Blitta PV 50 MW)", sourceUrl: "https://ceet.tg/" },
  { id: "tunisia",          name: "Tunisia",           country: "TUN", lat:  36.81, lon:   10.18, tier: "static", kind: "mixed", source: "IRENA Tunisia 2024 + STEG Annual Report (Bizerte wind + PV; gas-dominated)", sourceUrl: "https://www.steg.com.tn/" },
  { id: "uganda",           name: "Uganda",            country: "UGA", lat:   0.32, lon:   32.58, tier: "static", kind: "hydro", source: "ERA Annual Performance 2024 (UETCL/UEDCL; Karuma+Isimba hydro)", sourceUrl: "https://www.uetcl.com/" },
  { id: "zambia",           name: "Zambia",            country: "ZMB", lat: -15.42, lon:   28.28, tier: "static", kind: "hydro", source: "Ember Zambia 2024 + Kariba drought (ZESCO; Kariba+Kafue; severe drought load-shed; SAPP)", sourceUrl: "https://www.zesco.co.zm/" },
  { id: "zimbabwe",         name: "Zimbabwe",          country: "ZWE", lat: -17.83, lon:   31.05, tier: "static", kind: "hydro", source: "Ember Zimbabwe 2024 + Kariba South (ZPC/ZETDC; Kariba South hydro+coal; SAPP)", sourceUrl: "https://www.zetdc.co.zw/" },
  // Tier 3 - flare (4 regions)
  { id: "permian",   name: "Permian Basin",   country: "USA",    lat:  31.9, lon: -102.5, tier: "flare",  kind: "flare", source: "VIIRS + GGFR", sourceUrl: "https://www.worldbank.org/en/programs/gasflaringreduction" },
  { id: "w-siberia", name: "W. Siberia",      country: "RUS",    lat:  61.0, lon:   73.0, tier: "flare",  kind: "flare", source: "VIIRS + GGFR", sourceUrl: "https://www.worldbank.org/en/programs/gasflaringreduction" },
  { id: "s-iraq",    name: "S. Iraq",         country: "IRQ",    lat:  30.5, lon:   47.5, tier: "flare",  kind: "flare", source: "VIIRS + GGFR", sourceUrl: "https://www.worldbank.org/en/programs/gasflaringreduction" },
  { id: "e-saudi",   name: "E. Saudi Arabia", country: "SAU",    lat:  26.5, lon:   49.5, tier: "flare",  kind: "flare", source: "VIIRS + GGFR", sourceUrl: "https://www.worldbank.org/en/programs/gasflaringreduction" }
];
