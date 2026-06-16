# Global Coverage Expansion Report — 2026-06-16

## 1. Country Coverage Summary

### Current Dashboard Coverage

- **196 unique country codes** in `src/lib/regions.ts`
- **193 UN member states + 2 observer states (Vatican, Palestine) + Taiwan** = 196 ISO codes
- **195 countries covered** (all UN members except Vatican City — trivially covered by Italy's grid)
- **Only truly missing**: Vatican City (VAT) — zero VRE capacity, import-dependent on Italian grid

### Tier Breakdown

| Tier | Regions | Countries | Notes |
|------|---------|-----------|-------|
| **live** | 149 | 38 | Real TSO feed, verified |
| **live-domestic-anchored** | 10 | 4 | Live feed with domestic calibration |
| **live-neighbour-anchored** | 1 | 1 | Live feed with cross-border calibration |
| **anchored** | 14 | 8 | Annual anchor (flare/hydro), not modelled |
| **estimated** | 211 | 157 | T3-modelled fallback |

**Key insight**: The dashboard already has comprehensive *country* coverage. The real gaps are in **data quality** — 157 countries are at T3 (modelled estimates) vs 42 countries with live TSO feeds.

---

## 2. Countries Already Covered But at T3 — T1 Promotion Potential

### Tier 1: High Potential (TSO publishes data we could wire up)

#### 🇲🇽 Mexico (CENACE) — T3 → T1 potential
- **TSO**: CENACE (Centro Nacional de Control de Energía)
- **Data URL**: `https://estrategia.cenace.gob.mx/SIM/VISTA/Pronosticos/Generacion/Default.aspx`
- **Also**: `https://www.cenace.gob.mx/Programas/DemandaReal/Default.aspx`
- **Format**: Real-time supply/demand portal visible on web
- **Curtailment**: Northern grid saturation (Sonora/Chihuahua/Coahuila solar; Oaxaca wind)
- **Anchor**: ~1.2 TWh/yr from SENER PRODESEN + CRE confiabilidad reports
- **Blocker**: Portal is web-based; need to check if API exists behind the scenes
- **Priority**: HIGH — 20 GW VRE, significant curtailment, largest Latin American gap

#### 🇮🇳 India (State SLDCs) — T3 → T1a potential for individual states
- **TSOs**: Various State Load Despatch Centres
- **Current status**: 7 state-level regions, all T3
- **Data sources found**:
  - CEA gen-re.cea.gov.in daily Excel (State-Wise sheet) — machine-readable
  - Individual SLDC portals (Rajasthan, Gujarat, Tamil Nadu, Karnataka, Andhra Pradesh, Maharashtra) — all login-gated
- **Historical CSVs already exist**: `data/historical/india-*-gen-daily.csv` for 5 states
- **Curtailment**: POSOCO/Ember estimates ~8-10 TWh/yr total across states
- **Blocker**: SLDC portals require authentication; CEA daily reports are PDF/Excel
- **Priority**: HIGH — 120 GW VRE, massive curtailment, but data access is gated

#### 🇻🇳 Vietnam (EVN/NLDC) — T3, likely to remain
- **TSO**: EVN (Electricity of Vietnam) / NLDC
- **Data URL**: `https://nldc.evn.vn/`
- **Format**: PDF-only daily dispatch reports
- **Curtailment**: 20-35% in Central/South-Central provinces (Ninh Thuan, Binh Thuan)
- **Anchor**: ~4 TWh/yr
- **Blocker**: PDF-only, no machine-readable endpoint
- **Priority**: MEDIUM — 23 GW VRE, severe curtailment, but data not accessible

#### 🇰🇷 South Korea (KPX EPSIS) — T3, browser-only blocker
- **TSO**: KPX (Korea Power Exchange)
- **Data URL**: `https://epsis.kpx.or.kr/epsisnew/selectKnreMain.do`
- **Format**: Interactive SVG map click → AJAX POST → JSON response
- **Curtailment**: Renewable utilisation rate available but requires browser interaction
- **Blocker**: Interactive SVG map required, not programmatically accessible
- **Alternative**: `https://www.data.go.kr/data/15103243/openapi.do` — requires approved serviceKey
- **Priority**: MEDIUM — 27 GW VRE, data exists but not API-accessible

#### 🇹🇼 Taiwan (TAIPOWER) — T3, likely to remain
- **TSO**: TAIPOWER
- **Data URL**: `https://www.taipower.com.tw/`
- **Format**: genary.json (instantaneous unit output), no curtailment archive
- **Curtailment**: ~0.3 TWh/yr from 2023 Sustainability Report
- **Blocker**: No daily/monthly machine-readable curtailment endpoint
- **Priority**: MEDIUM — 13 GW VRE, growing solar, but data not accessible

### Tier 2: Medium Potential (data exists but restricted)

#### 🇦🇷 Argentina (CAMMESA) — T3, API restricted
- **TSO**: CAMMESA (Compañía Administradora del Mercado Mayorista Eléctrico)
- **Data URL**: `https://api.cammesa.com/`
- **Format**: REST API (marginal cost, demand data only)
- **Curtailment**: Patagonian wind ~0.5 TWh/yr
- **Blocker**: Curtailment/restricciones endpoints restricted to registered market participants
- **Priority**: MEDIUM — 6 GW VRE, API exists but gated

#### 🇪🇬 Egypt (EETC/NREA) — T3, no dispatch data
- **TSO**: EETC (Egyptian Electricity Transmission Company)
- **Data URL**: `https://nrea.gov.eg/`
- **Format**: Annual/monthly PDFs only
- **Curtailment**: ~0.3 TWh/yr from Benban frequency-driven disconnection
- **Blocker**: No public dispatch or curtailment data
- **Priority**: MEDIUM — 6.6 GW VRE, documented curtailment but no machine-readable source

#### 🇵🇰 Pakistan (NTDC/NEPRA) — T3, annual PDF reports only
- **TSO**: NTDC (National Transmission & Despatch Company)
- **Data URL**: `https://nepra.org.pk/`
- **Format**: PDF annual reports (State of Industry Report)
- **Curtailment**: 1,337 GWh wind NPMV in FY2023-24
- **Blocker**: No hourly API; annual PDF reports only
- **Priority**: LOW — 8 GW VRE, data is annual/PDF

#### 🇲🇦 Morocco (ONEE/ANRE) — T3, no dispatch data
- **TSO**: ONEE (Office National de l'Electricité et de l'Eau Potable)
- **Data URL**: `http://www.anre.ma/`
- **Format**: Annual regulatory reports
- **Curtailment**: ~0.4 TWh/yr (3% transmission-limited proxy)
- **Blocker**: No public dispatch data
- **Priority**: LOW — 4 GW VRE, south-north transmission constraint

### Tier 3: Low Potential (no public data found)

#### 🇧🇩 Bangladesh (BPDB/PGCB) — T3
- **TSO**: BPDB (Bangladesh Power Development Board)
- **Data URL**: `https://bpdb.gov.bd/`
- **Status**: Limited renewable capacity (1 GW solar), no public dispatch data
- **Priority**: VERY LOW

#### 🇮🇩 Indonesia (PLN) — T3
- **TSO**: PLN (Perusahaan Listrik Negara)
- **Data URL**: `https://web.pln.co.id/`
- **Status**: Limited VRE (1 GW solar), no public dispatch data
- **Priority**: VERY LOW

#### 🇹🇭 Thailand (EGAT/ERC) — T3
- **TSO**: EGAT (Electricity Generating Authority of Thailand)
- **Data URL**: `https://www.egat.co.th/`
- **Status**: No public curtailment data
- **Priority**: LOW — 5.5 GW VRE, growing but limited data

#### 🇵🇭 Philippines (IEMOP) — T3
- **TSO**: IEMOP (Independent Market Operator of the Philippines)
- **Data URL**: `https://www.iemop.ph/market-data/rtd-prices-and-schedules/`
- **Status**: RTD endpoint has dispatch schedules, not curtailment
- **Priority**: LOW — 2.5 GW VRE, dispatch only

#### 🇲🇾 Malaysia (GSO) — T3
- **TSO**: GSO (Grid System Operator)
- **Data URL**: `https://www.gso.org.my/`
- **Status**: Real-time solar feed exists but generation-only, not curtailment
- **Priority**: LOW — 2 GW VRE

#### 🇮🇱 Israel (Noga) — T3
- **TSO**: Noga (Independent System Operator)
- **Data URL**: `https://www.noga-iso.co.il/`
- **Status**: No public curtailment data
- **Priority**: LOW — 4.1 GW VRE, growing solar

#### 🇯🇴 Jordan (NEPCO) — T3
- **TSO**: NEPCO (National Electric Power Company)
- **Data URL**: `https://www.nepco.com.jo/`
- **Status**: No public curtailment data
- **Priority**: LOW — 1.2 GW VRE

---

## 3. Countries NOT in Dashboard — Data Availability

### Truly Missing (not in regions.ts at all)

**Vatican City (VAT)** — Only UN member state not covered. Zero VRE capacity, import-dependent on Italian grid. **No action needed.**

### Countries in Dashboard but Could Be Split Further

#### Central American SIEPAC Countries
- **Guatemala (AMM)**: `https://www.amm.org.gt/` — No public curtailment data
- **El Salvador (UT)**: `https://www.ut.com.sv/` — No public curtailment data
- **Honduras (ODS)**: `https://ods.org.hn/` — No public curtailment data
- **Nicaragua (ENATREL)**: `https://www.enatrel.gob.ni/` — No public curtailment data
- **Costa Rica (ICE/CENCE)**: `https://www.grupoice.com/` — 98% renewable, hydro spill potential
- **Panama (ETESA)**: `https://www.etesa.com.pa/` — No public curtailment data
- **SIEPAC EOR**: `https://www.enteoperador.org/` — No public curtailment data
- **Assessment**: All T3, no machine-readable sources found

#### Caribbean Nations
- **Dominican Republic (OC)**: `https://www.oc.org.do/` — GetGeneracionReprogramadaJSon has scheduled/actual generation, not renewable-specific curtailment
- **Jamaica (JPS/OUR)**: `https://www.jpsco.com/` — No public curtailment data
- **Cuba (UNE)**: `https://www.une.cu/` — Post-Hurricane grid stress, not steady-state
- **Trinidad & Tobago (T&TEC)**: `https://ttec.co.tt/` — Flare-dominant, no VRE curtailment
- **Assessment**: All T3, no machine-readable sources found

#### Pacific Island Nations
- **Fiji (EFL)**: `https://www.efl.com.fj/` — Hydro-dominant, no public dispatch data
- **Papua New Guinea (PNG Power)**: `https://pngpower.com.pg/` — Hydro-dominant, no public dispatch data
- **Solomon Islands (SIEA)**: Very small grid, no public data
- **Assessment**: All T3, no machine-readable sources found

#### Central Asian States
- **Kazakhstan (KEGOC)**: `https://www.kegoc.kz/` — No public dispatch data found
- **Uzbekistan**: No public data
- **Kyrgyzstan**: Hydro-dominant, VRE <50 MW
- **Tajikistan**: Hydro-dominant, VRE <50 MW
- **Turkmenistan**: Solar growing but no public data
- **Assessment**: All T3, no machine-readable sources found

#### African Nations (beyond Kenya/Egypt/Morocco/South Africa/Namibia)
- **Nigeria (TCN)**: `https://www.tcn.org.ng/` — No public dispatch data
- **Ghana (GRIDCo)**: `https://www.gridcogh.com/` — No public dispatch data
- **Ethiopia (EEP)**: `https://www.eep.com.et/` — Hydro-dominant, no public dispatch data
- **Tanzania (TANESCO)**: `https://www.tanesco.co.tz/` — No public dispatch data
- **Uganda (UETCL)**: `https://www.uetcl.com/` — No public dispatch data
- **Senegal (SENELEC)**: `https://www.senelec.sn/` — No public dispatch data
- **Assessment**: All T3, no machine-readable sources found

---

## 4. Ranked Priority List for Expansion

### Priority 1: Wire Up Existing Data Sources (Low-hanging fruit)

| Rank | Country | TSO | Data URL | Format | What's Available | Action |
|------|---------|-----|----------|--------|------------------|--------|
| 1 | 🇲🇽 Mexico | CENACE | `estrategia.cenace.gob.mx` | Web portal | Real-time supply/demand | Probe for API behind portal |
| 2 | 🇮🇳 India (5 states) | Various SLDCs | CEA gen-re.cea.gov.in | Excel | Daily generation by state | Wire CSV loaders (some already exist) |
| 3 | 🇦🇷 Argentina | CAMMESA | `api.cammesa.com` | REST API | Marginal cost, demand | Check if curtailment endpoints exist with auth |
| 4 | 🇪🇬 Egypt | EETC/NREA | `nrea.gov.eg` | PDF only | Annual capacity stats | Monitor for API publication |

### Priority 2: Research New Data Sources (Need investigation)

| Rank | Country | TSO | Lead | Potential |
|------|---------|-----|------|-----------|
| 5 | 🇰🇷 South Korea | KPX | EPSIS interactive map | Medium — data exists but browser-only |
| 6 | 🇹🇼 Taiwan | TAIPOWER | genary.json | Medium — unit output, no curtailment |
| 7 | 🇻🇳 Vietnam | EVN/NLDC | PDF daily reports | Low — PDF only |
| 8 | 🇵🇭 Philippines | IEMOP | RTD endpoint | Low — dispatch only, not curtailment |
| 9 | 🇲🇾 Malaysia | GSO | JSON endpoints | Low — generation only, not curtailment |
| 10 | 🇮🇱 Israel | Noga | Unknown | Low — no public data found |

### Priority 3: Countries with Significant VRE but No Data Path

| Rank | Country | VRE Capacity | Curtailment Estimate | Data Status |
|------|---------|--------------|---------------------|-------------|
| 11 | 🇸🇦 Saudi Arabia | 15.4 GW | ~0.8 TWh/yr | GASTAT annual only |
| 12 | 🇹🇭 Thailand | 5.5 GW | ~0.3 TWh/yr | No public data |
| 13 | 🇲🇦 Morocco | 4 GW | ~0.4 TWh/yr | ANRE annual only |
| 14 | 🇵🇰 Pakistan | 8 GW | ~1.3 TWh/yr | NEPRA annual PDF |
| 15 | 🇧🇩 Bangladesh | 1 GW | Minimal | No public data |

### Priority 4: Smaller Countries (Low impact but easy wins if data appears)

| Country | VRE | Notes |
|---------|-----|-------|
| 🇯🇴 Jordan | 1.2 GW | NEPCO — no public data |
| 🇱🇰 Sri Lanka | 0.8 GW | CEB — no public data |
| 🇰🇿 Kazakhstan | 2.5 GW | KEGOC — no public data |
| 🇮🇩 Indonesia | 1 GW | PLN — no public data |

---

## 5. Key Findings

### What We Found

1. **Country coverage is essentially complete** — all 193 UN member states + observers are covered. The only missing one is Vatican City (trivial).

2. **The real gap is data quality, not country coverage** — 157 countries (211 regions) are at T3-modelled estimates vs only 42 countries with live TSO feeds.

3. **Most TSOs do not publish machine-readable curtailment data** — The vast majority of grid operators publish annual PDF reports at best. Even major economies like India, Vietnam, South Korea, and Taiwan have no programmatic curtailment endpoints.

4. **The ENTSO-E model is exceptional** — Europe's transparency platform is unique globally. No other region has anything comparable for renewable curtailment data.

5. **Mexico CENACE is the most promising unfired TSO** — They have a real-time portal that might have an API behind it. Worth investigating.

6. **India has partial data** — CEA gen-re.cea.gov.in publishes daily Excel files that some loaders already use. Could expand to more states.

7. **Caribbean/Central American/Pacific nations are data deserts** — No machine-readable sources found for any of them.

8. **Africa is a data desert** — Beyond Kenya (EPRA), Egypt (EETC), Morocco (ANRE), South Africa (Eskom), and Namibia (NamPower), no African TSO publishes machine-readable dispatch data.

9. **Central Asia is a data desert** — KEGOC (Kazakhstan) and other Central Asian TSOs publish no public dispatch data.

### What We Could Do

1. **Probe Mexico CENACE portal** — Check if the real-time supply/demand portal has an API that could be wired up.

2. **Expand India coverage** — The CEA gen-re.cea.gov.in daily Excel pattern could work for more states if we can access the data programmatically.

3. **Monitor emerging data portals** — Several TSOs (South Korea KPX, Taiwan TAIPOWER, Vietnam EVN) publish data that could become machine-readable in the future.

4. **Accept T3 as the ceiling for most countries** — For the majority of the world's grids, T3-modelled estimates are the best we can do until TSOs publish machine-readable data.

---

## 6. Files Created/Modified

- **Created**: `docs/research/2026-06-16-global-coverage-expansion-report.md` (this file)

## 7. Issues Encountered

- **macOS grep**: `-P` flag not supported on macOS; used `-E` with `sed` instead
- **Shell interpretation**: Python `&` operator was interpreted by bash; used heredoc syntax
- **No new data sources found**: The web research confirmed what the existing codebase already documented — most TSOs do not publish machine-readable curtailment data
