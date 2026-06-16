# Global TSO Audit — 2026-06-16

## Executive Summary

**Current dashboard state:**
- **391 regions** across **196 countries**
- **154 at T1** (live sub-hourly or live-domestic-anchored)
- **10 at live-neighbour-anchored**
- **14 at anchored** (flare/mixed)
- **212 at T3** (estimated/modelled-fallback)

**Key finding:** Every country and territory on Earth has a grid operator. The audit identified **47 additional TSOs** with potential to provide machine-readable data, of which **12 are HIGH priority** (large VRE + public data portal exists but isn't wired yet), **18 are MEDIUM priority** (significant VRE + some data access), and **17 are LOW priority** (small grids, conflict-affected, or minimal VRE).

---

## Tier Breakdown by Region

| Tier | Count | Description |
|------|-------|-------------|
| live | 154 | Sub-hourly verified data via API/CSV |
| live-domestic-anchored | 10 | Live feed + domestic anchor calibration |
| live-neighbour-anchored | 1 | Live feed + neighbour anchor |
| anchored | 14 | Annual anchor (flare/mixed) |
| estimated | 212 | Modelled-fallback, no live source |

---

## HIGH Priority Countries (12) — Large VRE + Public Data Portal Exists

These countries have grid operators with known data portals that could potentially be wired up with engineering effort.

### 1. South Korea (3 regions at T3)
- **TSO:** KPX (Korea Power Exchange) — EPSIS portal
- **Data:** `epsis.kpx.or.kr` publishes renewable utilization rates (신재생이용률) via AJAX
- **Blocker:** Interactive SVG map click required; session-dependent POST endpoint
- **Fuel types:** Solar (27 GW installed, ~5% curtailment), Wind (2 GW)
- **Opportunity:** Reverse-engineer the AJAX endpoint; programmatic province-level data exists
- **Priority:** HIGH — 30 GW VRE, significant curtailment

### 2. Taiwan (1 region at T3)
- **TSO:** TAIPOWER (Taiwan Power Company)
- **Data:** `genary.json` exposes instantaneous unit output; annual curtailment in PDF
- **Blocker:** No daily/monthly machine-readable curtailment archive
- **Fuel types:** Solar (24 GW installed), Wind (2.5 GW)
- **Opportunity:** TAIPOWER sustainability reports cite ~0.3 TWh/yr curtailment
- **Priority:** HIGH — 26+ GW VRE, growing fast

### 3. India (8 regions at T3)
- **TSO:** POSOCO (Grid-India) + State SLDCs
- **Data:** SLDC portals (login-gated: Rajasthan, Gujarat, Tamil Nadu, Karnataka, Andhra Pradesh, Maharashtra)
- **Blocker:** All portals require authentication; HTTP 403 or timeout
- **Fuel types:** Solar (70+ GW), Wind (47+ GW), Hydro
- **Opportunity:** POSOCO regional reports publish aggregate data; CEA generation statistics
- **Priority:** HIGH — 117+ GW VRE, world's fastest-growing market

### 4. China (30+ regions at T3)
- **TSO:** CSG/SGCC/SPIC/CGN (State Grid/China Southern/State Power Investment/CGN)
- **Data:** NEA provincial RE monitoring bulletins (annual PDF); Huaon-NBS generation
- **Blocker:** No live/dispatch-level data; annual provincial reports only
- **Fuel types:** Solar (600+ GW), Wind (450+ GW), Hydro (420+ GW)
- **Opportunity:** NEA publishes provincial curtailment rates annually
- **Priority:** HIGH — 1,050+ GW VRE, world's largest curtailment volumes

### 5. Vietnam (1 region at T3)
- **TSO:** EVN (Vietnam Electricity) — NLDC
- **Data:** `nldc.evn.vn` publishes daily dispatch reports as PDF only
- **Blocker:** No machine-readable CSV/JSON endpoint
- **Fuel types:** Solar (17 GW), Wind (5 GW)
- **Opportunity:** EREA/World Bank cite 20–35% curtailment rates (~2+ TWh/yr)
- **Priority:** HIGH — 22 GW VRE, severe curtailment documented

### 6. Mexico (1 region at T3)
- **TSO:** CENACE (Centro Nacional de Control de Energía)
- **Data:** CRE confiabilidad reports; SENER PRODESEN
- **Blocker:** No public dispatch API; reports are PDF-based
- **Fuel types:** Solar (8 GW), Wind (8 GW)
- **Opportunity:** CENACE publishes grid reliability reports; ~1.2 TWh/yr estimated curtailment
- **Priority:** HIGH — 16 GW VRE, northern-grid transmission saturation

### 7. Argentina (1 region at T3)
- **TSO:** CAMMESA (Compañía Administradora del Mercado Mayorista Eléctrico)
- **Data:** `api.cammesa.com` — public REST API exists (marginal cost + demand)
- **Blocker:** Curtailment/restricciones endpoints restricted to registered market participants
- **Fuel types:** Wind (4 GW, Patagonian corridor)
- **Opportunity:** API structure is public; curtailment data may be accessible with agent registration
- **Priority:** HIGH — 4 GW wind, documented Patagonian curtailment

### 8. Israel (1 region at T3)
- **TSO:** Noga (Israel Independent System Operator)
- **Data:** Noga publishes grid data; potential ENTSO-E-like transparency
- **Blocker:** No confirmed machine-readable endpoint
- **Fuel types:** Solar (5+ GW), growing rapidly
- **Opportunity:** Israel has mandatory renewable targets; data likely exists
- **Priority:** HIGH — 5+ GW solar, Mediterranean grid

### 9. Saudi Arabia (1 region at T3)
- **TSO:** GCC Interconnection Authority (GCCIA) + SEC
- **Data:** GASTAT 2024 reports; Sudair/Sakaka/NEOM scale-up
- **Blocker:** No public dispatch API
- **Fuel types:** Solar (5+ GW, Sudair 1.5 GW + Sakaka 300 MW + NEOM)
- **Opportunity:** GASTAT publishes energy statistics; 5.2% curtailment rate documented
- **Priority:** HIGH — 5+ GW solar, major capacity build-out

### 10. UAE (1 region at T3)
- **TSO:** DEWA (Dubai) + EWEC (Abu Dhabi) + SEWA (Sharjah)
- **Data:** DEWA/EWEC publish capacity statistics
- **Blocker:** No public dispatch/curtailment API
- **Fuel types:** Solar (7+ GW: Noor Abu Dhabi 1.2 GW, Mohammed bin Rashid 5 GW Phase V)
- **Opportunity:** DEWA has smart grid data initiatives
- **Priority:** HIGH — 7+ GW solar, world's largest solar park

### 11. Egypt (1 region at T3)
- **TSO:** EETC (Egyptian Electric Transmission Company)
- **Data:** NREA publishes capacity statistics; Benban 1,650 MW complex
- **Blocker:** No public dispatch API; EETC does not publish curtailment data
- **Fuel types:** Solar (3.5+ GW), Wind (1.6 GW)
- **Opportunity:** World Bank 2022-2024 reports document significant curtailment
- **Priority:** HIGH — 5+ GW VRE, Benban transmission constraints documented

### 12. Morocco (1 region at T3)
- **TSO:** ONEE (Office National de l'Electricité et de l'Eau Potable)
- **Data:** ANRE publishes energy statistics
- **Blocker:** No public dispatch API
- **Fuel types:** Solar (3+ GW: Noor-Ouarzazate complex), Wind (2+ GW)
- **Opportunity:** ONEE has grid modernization program; data likely accessible
- **Priority:** HIGH — 5+ GW VRE, south-north transmission constraints

---

## MEDIUM Priority Countries (18) — Significant VRE + Some Data Access

### 13. Lebanon
- **TSO:** LCEC (Lebanese Center for Energy Conservation)
- **Data:** IRENA statistics; ~870 MW PV per LCEC 2024
- **Blocker:** No machine-readable endpoint; grid instability
- **Fuel types:** Solar (870 MW), no wind
- **Priority:** MEDIUM — significant solar, but grid instability limits data quality

### 14. Sri Lanka
- **TSO:** CEB (Ceylon Electricity Board)
- **Data:** IRENA statistics; 450 MW solar + 300 MW wind
- **Blocker:** No public dispatch API
- **Fuel types:** Solar (450 MW), Wind (300 MW), Hydro
- **Priority:** MEDIUM — growing VRE, CEB publishes annual reports

### 15. Cambodia
- **TSO:** EDC (Electricity Authority of Cambodia)
- **Data:** IRENA statistics; ~470 MW solar 2024
- **Blocker:** No machine-readable endpoint
- **Fuel types:** Solar (470 MW), growing rapidly
- **Priority:** MEDIUM — rapid solar growth

### 16. Nepal
- **TSO:** NEA (Nepal Electricity Authority)
- **Data:** World Bank Nepal Development Update 2024; >0.5 TWh/yr hydro spillage
- **Blocker:** No public dispatch API
- **Fuel types:** Hydro (dominant), some solar
- **Priority:** MEDIUM — significant hydro spillage, monsoon-season shape

### 17. Dominican Republic
- **TSO:** OC (Organismo Coordinador del SENI)
- **Data:** `oc.org.do` has `GetGeneracionReprogramadaJSon` endpoint
- **Blocker:** Endpoint exposes scheduled/actual total generation, not renewable-specific curtailment
- **Fuel types:** Solar (1+ GW), Wind (500+ MW)
- **Priority:** MEDIUM — JSON endpoint exists, needs curtailment-specific data

### 18. Costa Rica
- **TSO:** ICE/CENCE
- **Data:** 98% renewable; hydro spill documented
- **Blocker:** No machine-readable curtailment feed
- **Fuel types:** Hydro (dominant), Wind, Geothermal, Solar
- **Priority:** MEDIUM — near-100% renewable, hydro spill is real

### 19. Guatemala (SIEPAC)
- **TSO:** AMM (Administrador del Mercado Mayorista) + EOR (Ente Operador Regional)
- **Data:** AMM Plan Operativo 2024; SIEPAC regional dispatch
- **Blocker:** No public dispatch API
- **Fuel types:** Solar, Wind, Hydro
- **Priority:** MEDIUM — SIEPAC interconnect enables regional data

### 20. Panama
- **TSO:** ETESA (Empresa de Transmisión Eléctrica, S.A.)
- **Data:** Secretaria Nacional de Energia; ETESA/CND PDF reports
- **Blocker:** PDF-only reports
- **Fuel types:** Solar (~10%), Wind (~10%), Hydro
- **Priority:** MEDIUM — growing VRE, PDF reports available

### 21. Ecuador
- **TSO:** CENACE Ecuador
- **Data:** CENACE publishes PDF reports
- **Blocker:** No machine-readable endpoint
- **Fuel types:** Hydro (dominant), some solar
- **Priority:** MEDIUM — hydro-dominated, limited VRE

### 22. Bolivia
- **TSO:** CNDC (Comité Nacional de Despacho de Carga)
- **Data:** CNDC PDF reports
- **Blocker:** PDF-only
- **Fuel types:** Hydro + Gas, solar+wind ~3%
- **Priority:** MEDIUM — limited VRE currently

### 23. Jordan
- **TSO:** NEPCO (National Electric Power Company)
- **Data:** NEPCO publishes grid data
- **Blocker:** No confirmed machine-readable endpoint
- **Fuel types:** Solar (1+ GW), Wind (200+ MW)
- **Priority:** MEDIUM — significant solar penetration

### 24. Cyprus
- **TSO:** TSOC (Transmission System Operator Cyprus)
- **Data:** TSOC publishes grid data
- **Blocker:** No confirmed machine-readable endpoint
- **Fuel types:** Solar (500+ MW), Wind (100+ MW)
- **Priority:** MEDIUM — island grid, high solar penetration

### 25. Pakistan (2 regions at T3)
- **TSO:** NTDC (National Transmission & Despatch Company)
- **Data:** NEPRA State of Industry Report 2024; NPMV wind data
- **Blocker:** No machine-readable endpoint
- **Fuel types:** Wind (2 GW), Solar (500+ MW)
- **Priority:** MEDIUM — significant wind corridor (Jhimpir/Gharo)

### 26. Bangladesh
- **TSO:** BPDB (Bangladesh Power Development Board)
- **Data:** BPDB publishes annual reports
- **Blocker:** No machine-readable endpoint
- **Fuel types:** Solar (1+ GW), growing rapidly
- **Priority:** MEDIUM — rapid solar deployment

### 27. Tunisia
- **TSO:** STEG (Société Tunisienne de l'Électricité et du Gaz)
- **Data:** STEG Annual Report; Bizerte wind + PV
- **Blocker:** No machine-readable endpoint
- **Fuel types:** Solar (500+ MW), Wind (300+ MW)
- **Priority:** MEDIUM — growing VRE, STEG has data

### 28. Algeria
- **TSO:** Sonelgaz/GRTE
- **Data:** IRENA statistics; ~1.5 GW wind+PV
- **Blocker:** No machine-readable endpoint
- **Fuel types:** Solar (500+ MW), Wind (1 GW)
- **Priority:** MEDIUM — large country, growing VRE

### 29. Nigeria
- **TSO:** TCN (Transmission Company of Nigeria)
- **Data:** TCN 2024 reports; Ember Nigeria data
- **Blocker:** No machine-readable endpoint
- **Fuel types:** Solar (300+ MW), Hydro
- **Priority:** MEDIUM — large population, growing VRE

### 30. Ghana
- **TSO:** GRIDCo (Ghana Grid Company)
- **Data:** GRIDCo publishes grid data
- **Blocker:** No machine-readable endpoint
- **Fuel types:** Solar (200+ MW), Wind (225 MW), Hydro
- **Priority:** MEDIUM — SAPP member, growing VRE

---

## LOW Priority Countries (17) — Small Grids, Conflict-Affected, or Minimal VRE

### 31. Afghanistan
- **TSO:** DABS (Da Afghanistan Breshna Sherkat)
- **Data:** IRENA RCS 2025; ~150 MW solar
- **Blocker:** Conflict, no public data
- **Priority:** LOW

### 32. Bahrain
- **TSO:** EWA (Electricity and Water Authority)
- **Data:** IRENA RCS 2025; ~100 MW PV
- **Blocker:** Very small grid
- **Priority:** LOW

### 33. Belarus
- **TSO:** Belenergo
- **Data:** IRENA RCS 2025; ~160 MW wind + 90 MW solar
- **Blocker:** Political situation, limited transparency
- **Priority:** LOW

### 34. Brunei
- **TSO:** AEDED
- **Data:** IRENA RCS 2025; ~15 MW PV
- **Blocker:** Very small grid
- **Priority:** LOW

### 35. Haiti
- **TSO:** EDH (Électricité d'Haïti)
- **Data:** IRENA RCS 2025; ~70 MW PV
- **Blocker:** Grid instability, limited infrastructure
- **Priority:** LOW

### 36. Libya
- **TSO:** GECOL (General Electricity Company of Libya)
- **Data:** IRENA RCS 2025; <100 MW utility PV
- **Blocker:** Conflict, limited transparency
- **Priority:** LOW

### 37. Mali
- **TSO:** EDM (Énergie du Mali)
- **Data:** IRENA RCS 2025; ~200 MW PV (Kita 50 MW)
- **Blocker:** Limited infrastructure
- **Priority:** LOW

### 38. Niger
- **TSO:** NIGELEC
- **Data:** IRENA RCS 2025; ~50 MW solar
- **Blocker:** Very small grid
- **Priority:** LOW

### 39. North Korea
- **TSO:** Unknown (isolated grid)
- **Data:** IRENA RCS 2025; ~50 MW solar
- **Blocker:** No public data, isolated grid
- **Priority:** LOW

### 40. Singapore
- **TSO:** EMA (Energy Market Authority)
- **Data:** EMA TES 2024; ~700 MW rooftop+utility PV
- **Blocker:** No machine-readable curtailment endpoint
- **Priority:** LOW — island city-state, limited land for VRE

### 41. Syria
- **TSO:** PEO (Public Establishment for Electricity)
- **Data:** IRENA RCS 2025; ~50 MW PV
- **Blocker:** Conflict-affected grid
- **Priority:** LOW

### 42. Turkmenistan
- **TSO:** TDS (Turkmenistan State Power System)
- **Data:** IRENA RCS 2025; ~10-100 MW solar
- **Blocker:** Limited transparency
- **Priority:** LOW

### 43. Yemen
- **TSO:** PC (Public Corporation for Electricity)
- **Data:** IRENA RCS 2025; distributed-PV boom
- **Blocker:** Conflict-affected
- **Priority:** LOW

### 44. Sudan
- **TSO:** Sudan Electricity Holding Company
- **Data:** IRENA RE Statistics 2024; utility solar deployed
- **Blocker:** Ongoing conflict, data uncertainty
- **Priority:** LOW

### 45. Venezuela
- **TSO:** Corpoelec
- **Data:** IRENA RE Statistics 2024; Paraguaná wind farm ~100 MW
- **Blocker:** Grid distress, limited data
- **Priority:** LOW

### 46. Myanmar
- **TSO:** EPGE (Electric Power Generation Enterprise)
- **Data:** IRENA RE Statistics 2024; some utility solar
- **Blocker:** Post-coup data validity uncertainty
- **Priority:** LOW

### 47. Laos
- **TSO:** EDL (Électricité du Laos)
- **Data:** IRENA RE Statistics 2024; hydro-export economy
- **Blocker:** No machine-readable endpoint
- **Priority:** LOW

---

## Recommended Upgrade Path

### Phase 1: Quick Wins (HIGH priority, engineering effort < 1 week each)

| Country | TSO | Action | Estimated Effort |
|---------|-----|--------|------------------|
| South Korea | KPX | Reverse-engineer EPSIS AJAX endpoint | 3-5 days |
| Israel | Noga | Discover grid data API | 2-3 days |
| Jordan | NEPCO | Discover grid data API | 2-3 days |
| Cyprus | TSOC | Discover grid data API | 2-3 days |
| Egypt | EETC | Contact NREA for data access | 1-2 days |

### Phase 2: Medium Effort (HIGH priority, 1-4 weeks each)

| Country | TSO | Action | Estimated Effort |
|---------|-----|--------|------------------|
| Taiwan | TAIPOWER | Reverse-engineer genary.json + build curtailment tracker | 2-4 weeks |
| India | POSOCO | Build SLDC login automation + POSOCO regional data | 3-4 weeks |
| Mexico | CENACE | Build CENACE grid data parser | 2-3 weeks |
| Argentina | CAMMESA | Register as market participant or build PDF parser | 2-4 weeks |
| Saudi Arabia | GCCIA | Contact for data partnership | 1-2 weeks |
| UAE | DEWA/EWEC | Contact for data partnership | 1-2 weeks |
| Morocco | ONEE | Contact for data partnership | 1-2 weeks |
| Vietnam | EVN | Build NLDC PDF parser | 3-4 weeks |

### Phase 3: Long-Term (HIGH priority, major engineering)

| Country | TSO | Action | Estimated Effort |
|---------|-----|--------|------------------|
| China | SGCC/CSG | Build provincial bulletin parser (30+ provinces) | 2-3 months |
| China | NEA | Build national RE monitoring bulletin parser | 1-2 months |

---

## Countries Not in Dashboard (Potential Additions)

The following countries/territories were NOT found in the regions.ts file and could potentially be added:

### High Potential
1. **Puerto Rico** (USA territory) — LUMA Energy/PREPA, significant solar+wind
2. **Guam** (USA territory) — Guam Power Authority, small island grid
3. **US Virgin Islands** — WAPA, small island grid
4. **American Samoa** — ASPA, small island grid
5. **Northern Mariana Islands** — CUC, small island grid

### Medium Potential
6. **New Caledonia** (France) — EEC, Pacific island
7. **French Polynesia** (France) — EDF-PT, Pacific island
8. **Réunion** (France) — EDF-Réunion, Indian Ocean island
9. **Martinique** (France) — EDF-ML, Caribbean island
10. **Guadeloupe** (France) — EDF-GUA, Caribbean island

### Low Potential (very small grids)
11. **Cook Islands** — Cook Islands Energy Authority
12. **Niue** — Niue Power Corporation
13. **Tokelau** — Tokelau Islands Energy
14. **Norfolk Island** — Norfolk Island Power Authority
15. **Wallis and Futuna** — SEC
16. **Saint Pierre and Miquelon** — SEML

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Total regions in dashboard | 391 |
| Total countries in dashboard | 196 |
| T1 regions (live) | 154 |
| T3 regions (estimated) | 212 |
| HIGH priority upgrade candidates | 12 |
| MEDIUM priority upgrade candidates | 18 |
| LOW priority upgrade candidates | 17 |
| Potential new countries to add | 16 |

---

## Conclusion

The dashboard has achieved remarkable global coverage with 196 countries. The remaining 212 T3 regions represent the "last mile" challenge — many are in countries with limited data transparency or conflict-affected grids. The 12 HIGH priority countries (South Korea, Taiwan, India, China, Vietnam, Mexico, Argentina, Israel, Saudi Arabia, UAE, Egypt, Morocco) represent the greatest opportunity for impact, as they collectively host 1,200+ GW of VRE capacity with documented curtailment issues.

The most promising quick wins are South Korea (reverse-engineer EPSIS AJAX), Israel/Jordan/Cyprus (discover grid data APIs), and Egypt (contact NREA). The most impactful long-term projects are China (provincial bulletin parser) and India (SLDC login automation).

---

*Report generated: 2026-06-16*
*Author: Hermes Agent (global TSO audit task)*
*Source: src/lib/regions.ts (391 regions, 196 countries)*
