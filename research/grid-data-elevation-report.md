# Grid Data Elevation Research — Every Last Joule

**Date:** 2026-06-18
**Goal:** Find how to elevate non-live countries from 'estimated'/'anchored' to 'live' tier
**Source:** ElectricityMap open-source parsers (electricitymaps/electricitymaps-contrib) + direct API testing

---

## Executive Summary

| Priority | Country | Current Tier | Elevation Target | Feasibility | Data Source |
|----------|---------|-------------|-----------------|-------------|-------------|
| 🔴 P0 | **China** | anchored (49 regions) | live | ❌ No known live source | Estimated only |
| 🟡 P1 | **India** | estimated (13 regions) | live | ✅ Already exists | POSOCO/NPP/CEA parsers |
| 🟡 P1 | **Argentina** | estimated | live | ✅ Open API | CAMMESA REST API |
| 🟡 P1 | **Mexico** | estimated (2 regions) | live | ✅ Already exists | CENACE (needs proxy) |
| 🟡 P1 | **Russia** | anchored (2 regions) | live | ⚠️ Needs proxy | SO-UPS (partial fuel mix) |
| 🟢 P2 | **South Korea** | estimated (3 regions) | live | ✅ Already exists | KPX (WAF-blocked) |
| 🟢 P2 | **Malaysia** | estimated | live | ✅ Open API | GSO 10-min API |
| 🟢 P2 | **Philippines** | estimated (3 regions) | live | ✅ Already exists | IEMOP per-plant |
| 🟢 P2 | **Thailand** | estimated | live | ⚠️ Partial | EGAT (total gen only) |
| 🟢 P2 | **Nigeria** | estimated | live | ✅ Accessible | niggrid.org |
| 🔵 P3 | **Saudi Arabia** | estimated | anchored | ⚠️ Consumption only | GCCIA |
| 🔵 P3 | **Iran** | estimated | anchored | ❌ No parser | Estimated only |
| 🔵 P3 | **Kenya** | estimated | anchored | ❌ No parser | Estimated only |
| 🔵 P3 | **Egypt** | estimated | anchored | ❌ No parser | Estimated only |
| 🔵 P3 | **Vietnam** | estimated | anchored | ❌ Blocked + no fuel | NLDC (consumption only) |
| 🔵 P3 | **Indonesia** | estimated | anchored | ❌ No data | Fully estimated |

---

## Detailed Per-Country Assessment

### 🔴 P0 — CHINA (49 regions, currently 'anchored')

**Status:** NO live production parser exists anywhere in ElectricityMap.
**Data available:** Only `EMBER.fetch_production_capacity` (annual capacity numbers).
**The problem:** China does not publish real-time provincial generation data publicly. The National Energy Administration (NEA) and China Electricity Council (CEC) publish monthly/quarterly reports, not hourly.
**Potential approaches:**
- Satellite-derived solar/wind estimation (improve the 'estimated' model)
- Academic datasets: Tsinghua University's China Grid Project, some provincial EPBs publish daily data
- Commercial satellite + weather model ensemble (Tomorrow.io, Solcast)
- No public TSO API or open data portal identified
**Verdict:** Elevating China to 'live' tier is not feasible without a commercial data partnership. Best path: improve the estimation model with better satellite/weather inputs.

---

### 🟡 P1 — INDIA (13 regions, currently 'estimated')

**Already has ElectricityMap parsers** — the data pipeline exists and works. ELJ just needs to integrate it.
**Data sources (from `IN.py` + sub-zone parsers):**
- `meritindia.in` — State-wise consumption (needs proxy outside India)
- `npp.gov.in` — National Power Portal, daily generation Excel reports (~1 day lag)
- `cea.nic.in` — Central Electricity Authority daily RE reports (PDF/XLSX)
- `grid-india.in` — POSOCO real-time portal (15-min data)
- `wrldc.in` — Western Region consumption
- IEX (`iexindia.com`) — 15-min market data, **accessible globally without proxy**
**Fuel breakdown:** Coal, Gas, Oil, Hydro, Solar, Wind, Nuclear, Biomass
**Sub-zones:** IN-NO, IN-SO, IN-WE, IN-EA, IN-NE
**Accessibility:** ⚠️ Most Indian grid sites block non-India IPs. ElectricityMap uses a GCP-based proxy (`in-proxy-jfnx5klx2a-el.a.run.app`). IEX market data is accessible globally.
**Integration path:** Mirror the ElectricityMap IN parsers in ELJ. Set up a proxy (Cloudflare Worker or GCP Cloud Run) for the blocked endpoints. The IEX data alone provides 15-min market data accessible worldwide.

---

### 🟡 P1 — ARGENTINA (currently 'estimated')

**⭐ BEST FINDING — Open REST API with no auth required.**
**Data source:** CAMMESA (Compañía Administradora del Mercado Mayorista Eléctrico)
- API: `https://api.cammesa.com/demanda-svc/generacion/ObtieneGeneracioEnergiaPorRegion/`
- Renewables: `https://cdsrenovables.cammesa.com/exhisto/RenovablesService/GetChartTotalTRDataSource/`
- Swagger docs: `https://api.cammesa.com/demanda-svc/swagger-ui.html`
**Parser file:** `CAMMESA.py`
**Fuel breakdown:** Full — thermal, hydro, nuclear, solar, wind, plus regional exchanges
**Accessibility:** ✅ Open API, no key required, not blocked from US/EU
**Frequency:** Real-time (sub-hourly)
**Integration path:** Direct integration. This is the single easiest win — an open REST API with full fuel breakdown, no auth, no proxy needed.

---

### 🟡 P1 — MEXICO (2 regions, currently 'estimated')

**Already has ElectricityMap parser** (`CENACE.py`).
**Data source:** CENACE (Centro Nacional de Control de Energía)
- Production: `https://www.cenace.gob.mx/Paginas/SIM/Reportes/EnergiaGeneradaTipoTec.aspx`
- Exchange: `https://www.cenace.gob.mx/Paginas/Publicas/Info/DemandaRegional.aspx`
**Accessibility:** ⚠️ Needs proxy — ElectricityMap uses `us-ca-proxy-jfnx5klx2a-uw.a.run.app` (CAISO proxy)
**Sub-zones:** 9 regions (MX-BC, MX-NW, MX-NO, MX-NE, MX-CE, MX-OR, MX-OC, MX-PN, MX-SE)
**Fuel breakdown:** Full — coal, gas, hydro, nuclear, solar, wind, geothermal, biomass
**Integration path:** Mirror CENACE parser. Set up proxy (reuse the CAISO proxy pattern).

---

### 🟡 P1 — RUSSIA (2 regions, currently 'anchored')

**Already has ElectricityMap parser** (`RU.py`).
**Data source:** SO-UPS (System Operator of the Unified Power System)
- URL: `http://br.so-ups.ru` — NOT available outside Russia
- Reverse proxy: `https://858127-cc16935.tmweb.ru` (used by ElectricityMap)
**Sub-zones:** RU-1 (European/Urals), RU-2 (Siberia), RU-AS (Far East)
**Fuel breakdown:** ⚠️ Partial — nuclear, hydro, solar, wind identified, but coal/gas labeled "unknown" (no public fuel-type breakdown for thermal plants)
**Accessibility:** ⚠️ Needs reverse proxy in Russia. The electricityMap proxy works but is a fragile dependency.
**Integration path:** Mirror RU parser. Deploy a proxy in Russia (or use the existing tmweb.ru one). Accept that thermal generation is undifferentiated.

---

### 🟢 P2 — SOUTH KOREA (3 regions, currently 'estimated')

**Already has ElectricityMap parser** (`KPX.py`).
**Data source:** KPX (Korea Power Exchange) — `new.kpx.or.kr`
**Fuel breakdown:** ✅ Coal, Gas, Oil, Nuclear, Hydro, Wind, Solar, "New&Renewable"
**Accessibility:** ⚠️ WAF/firewall blocks non-Korean IPs. CSRF tokens required. Data embedded in JS functions (HTML scraping).
**Integration path:** Needs VPN/proxy in South Korea. Parse Highcharts data from KPX dashboard.

---

### 🟢 P2 — MALAYSIA (Peninsula, currently 'estimated')

**⭐ Already has open API — best SE Asia source.**
**Data source:** GSO (Grid System Operator) — `www.gso.org.my`
- Production: `POST /SystemData/CurrentGen.aspx/GetChartDataSource`
- Consumption: `POST /SystemData/SystemDemand.aspx/GetChartDataSource`
- Exchange: `POST /SystemData/TieLine.aspx/GetChartDataSource`
**Fuel breakdown:** Coal, Gas, Oil, Hydro, Solar, CoGen
**Frequency:** 10-minute intervals
**Accessibility:** ✅ FULLY ACCESSIBLE, no auth, not blocked
**Integration path:** Direct integration. Works globally. Tested and confirmed 2026-06-18.

---

### 🟢 P2 — PHILIPPINES (3 sub-zones, currently 'estimated')

**Already has ElectricityMap parser** (`IEMOP.py`).
**Data source:** IEMOP — `iemop.ph` (WordPress admin-ajax API)
**Fuel breakdown:** ✅ Per-plant mapping — coal, gas, hydro, solar, wind, biomass, geothermal, battery storage
**Sub-zones:** PH-LU (Luzon), PH-VI (Visayas), PH-MI (Mindanao)
**Accessibility:** ⚠️ Needs correct action parameters for WordPress AJAX endpoint
**Integration path:** Mirror IEMOP parser. Determine correct API parameters.

---

### 🟢 P2 — THAILAND (currently 'estimated')

**Already has ElectricityMap parser** (`TH.py`).
**Data source:** EGAT — `sothailand.com/sysgen/ws/sysgen`
**Fuel breakdown:** ❌ Primary API returns TOTAL generation only. No fuel mix from known endpoint.
**Accessibility:** ✅ API accessible, returns React app/JSON
**Integration path:** Limited value without fuel breakdown. Investigate if EGAT has additional fuel-mix endpoints.

---

### 🟢 P2 — NIGERIA (currently 'estimated')

**Already has ElectricityMap parser** (`NG.py`).
**Data source:** `niggrid.org/GenerationProfile2`
**Fuel breakdown:** ✅ Fuel mix available
**Accessibility:** ✅ Accessible globally
**Integration path:** Mirror NG parser.

---

### 🔵 P3 — SAUDI ARABIA / GULF (estimated)

**Parser:** `GCCIA.py` — Gulf Cooperation Council Interconnection Authority
**Data source:** `gccia.com.sa`
**Data:** ❌ CONSUMPTION ONLY — no production/fuel breakdown
**Integration path:** Only provides demand data. Not useful for generation tracking without fuel mix.

---

### 🔵 P3 — IRAN, KENYA, EGYPT, INDONESIA, VIETNAM (all estimated)

**Status:** No production parsers exist. No known public grid operator data portals.
**Iran:** `productionCapacity` only (EMBER). No live data source identified.
**Kenya:** `productionCapacity` only (EMBER). Kenya Power (KPLC) does not publish real-time data.
**Egypt:** `productionCapacity` only (EMBER). No public TSO data.
**Indonesia:** PLN does not publish live data. Fully estimated.
**Vietnam:** NLDC has consumption API but it's blocked outside Vietnam and has NO fuel breakdown.
**Verdict:** These countries need either commercial data partnerships or improved estimation models.

---

## Recommended Integration Priority

### Immediate (this sprint)
1. **Argentina** — Open REST API, no auth, full fuel mix. Easiest win.
2. **Malaysia Peninsula** — Open API, 10-min data, full fuel mix.
3. **Nigeria** — Accessible API, fuel mix available.

### Next sprint
4. **India** — Parser exists but needs proxy setup. IEX data is globally accessible as fallback.
5. **Mexico** — Parser exists, needs proxy.
6. **Russia** — Parser exists, needs proxy, partial fuel mix.

### Later
7. **South Korea** — Needs VPN + HTML scraping
8. **Philippines** — Needs API parameter discovery
9. **Thailand** — Limited value (no fuel breakdown)

### Requires fundamentally different approach
10. **China** — No public TSO data. Needs satellite estimation improvement or commercial partnership.
11. **Iran, Kenya, Egypt, Indonesia, Vietnam** — No known data sources. Improve estimation models.

---

## Sources
- ElectricityMaps open-source: https://github.com/electricitymaps/electricitymaps-contrib
- CAMMESA Argentina: https://api.cammesa.com/demanda-svc/swagger-ui.html
- GSO Malaysia: https://www.gso.org.my
- IEX India: https://www.iexindia.com
- niggrid Nigeria: https://niggrid.org
