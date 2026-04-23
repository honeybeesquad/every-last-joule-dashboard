# Data source log

Per-source notes on status, API quirks, and access. One section per feed.

---

## Cambridge CBECI (intended) / mempool.space (used)

**Intended:** Cambridge Centre for Alternative Finance Bitcoin Electricity Consumption Index (`https://ccaf.io/cbnsi/cbeci`). CBECI is the canonical academic source for Bitcoin network energy estimates.

**Status:** CBECI's API endpoints are recaptcha-gated. `GET https://ccaf.io/cbeci/api/data/` returns HTTP 400 with body `Invalid recaptcha response`. The dashboard at `ccaf.io/cbnsi/cbeci` evidently solves the recaptcha in-browser before issuing the JSON request. Not usable from a server-side GitHub Actions loader.

**Substitute:** mempool.space mining-stats endpoint. Free, unauthenticated, reliable.

- Endpoint: `https://mempool.space/api/v1/mining/hashrate/24h`
- Response: `{ currentHashrate: <H/s>, currentDifficulty: <number>, hashrates: [{timestamp, avgHashrate}], ... }`
- Cadence: updates ~continuously; `currentHashrate` is a 24-hour rolling average.

**Annualised consumption derivation:** our loader computes consumption from observed hashrate at the dashboard's primary ASIC reference of 16 J/TH (CBECI's implied fleet average). Formula:

```
power_W          = hashrate_TH/s × 16 J/TH
consumption_TWh  = power_W × 8760 h / 1e12
```

At ~1000 EH/s this yields ~140 TWh/yr, within ~2% of CBECI's ~138 TWh/yr reported value.

**Methodology note for user-facing methodology page:** explicitly state:

1. Hashrate source: mempool.space 24-hour rolling average.
2. Consumption: derived at 16 J/TH, not pulled from CBECI.
3. CBECI is the canonical academic source but its API requires in-browser auth; we cross-check quarterly against CBECI's published dashboard value.
4. If hashrate × 16 J/TH diverges materially from CBECI's published consumption in future quarters, investigate (CBECI may revise fleet assumption; we then update our ASIC reference).

---

## ERCOT (intended native API) / EIA (used as proxy for v0)

**Intended:** ERCOT Public API via developer portal (`apiexplorer.ercot.com`), which publishes 5-minute wind output and separately reports dispatch-down curtailment.

**Status:** two independent barriers encountered from a NZ IP:

1. **Developer portal signup** is geo-blocked at the Incapsula WAF (Error 16 page). Workaround was a VPN-assisted signup.
2. **Even with valid OAuth2 credentials** (ROPC flow confirmed working against `ercotb2c.b2clogin.com`), `api.ercot.com/api/public-reports/*` and `data.ercot.com` both return HTTP 403 Incapsula challenge pages from NZ IPs. The block is geographic, not an auth failure.

GitHub Actions runners (US-based) would likely get through, but the loader would be untestable locally without a VPN round-trip on every iteration. Not a sustainable development posture.

**Substitute:** US EIA "Hourly Electric Grid Monitor" via the v2 REST API. Free registration, instant API key, no geo-block.

- Endpoint: `https://api.eia.gov/v2/electricity/rto/fuel-type-data/data/`
- Query used: `frequency=hourly`, `facets[respondent][]=ERCO`, `facets[fueltype][]=WND`
- Auth: `api_key` query param (stored as `EIA_API_KEY` in `.env.local`)
- Response: `{ response: { total: N, data: [{ period: "YYYY-MM-DDTHH", respondent: "ERCO", fueltype: "WND", value: "<MWh>", ... }] } }`
- `value` is hourly wind generation in MWh (= average MW over that hour).
- Cadence: hourly, published on a 1-2 day lag.
- Fixture: `tests/fixtures/ercot-eia-wind.json` (30-day window, 694 rows).

**Curtailment-proxy derivation (v0):**

EIA does not directly publish curtailment for ERCOT. We derive a proxy from live wind generation at a calibrated rate.

Calibration (from `research/energy_arithmetic.md`):

- ERCOT 2024 wind curtailment ≈ **8 TWh/yr** (Modo Energy; Amperon; book research)
- ERCOT 2024 wind generation ≈ **130 TWh/yr** (EIA annuals; book research)
- Curtailment ratio ≈ **8 / 130 ≈ 6.15 %** of wind output

Proxy formula applied per hourly point:

```
curtailment_MW(h)  = wind_generation_MW(h) × 0.0615
```

The 30-day time-of-day average of this series inherits the real diurnal shape of ERCOT wind (night-heavy output → night-heavy proxy curtailment), which matches the actual pattern of Texas curtailment (overnight low-demand + high-wind hours are when Generic Transmission Constraints bind most often).

**Methodology-page labelling:**

- Region cards: "ERCOT West" and "ERCOT East".
- Source label: "EIA hourly wind × calibrated curtailment rate (6.15 %, per ERCOT 2024 actuals)".
- "Live observation" qualifier: **No** - this is a derived proxy, not a directly reported curtailment figure. Native ERCOT upgrade planned for v0.5.

**v0.5 B1 split:** the single ERCOT series is emitted as two regions using a 66/34 West/East proportional split, matching the book's 2024 West+Panhandle share of ERCOT curtailment (5.3 TWh of ~8 TWh).

**v0.5 upgrade path:**

1. Keep `ERCOT_USERNAME` and `ERCOT_PASSWORD` in `.env.local` (already present from the Option-A attempt, unused by the current EIA-based loader).
2. Run native-ERCOT loader via VPN-enabled GitHub Actions (or GitHub-hosted US runner, which should bypass the WAF).
3. Swap `ercot.json.ts` loader to use the native 5-minute dispatch-down series when its daily runs are proven stable for two weeks.

**v0.5 B2 hard-unlock attempt:** committed `src/data/ercot-native.json.ts` as an inactive probe behind `ERCOT_NATIVE_ENABLED = false` in `src/index.md`.

- Token path: ROPC token acquisition succeeds with the existing `ERCOT_USERNAME`, `ERCOT_PASSWORD`, and `ERCOT_API_KEY` setup.
- Native endpoint attempted: ERCOT's public `np6-915-cd` "Summary Report of HDL and LDL" SCED product. It is the closest public SCED aggregate candidate found in the one-day spike because it reports high/low dispatch limits after each SCED run. The loader resolves the product artifact endpoint dynamically from `api/public-reports/np6-915-cd`.
- Local outcome: token acquired, then HTTP 403 Incapsula challenge from `api.ercot.com` with an Error 16 incident page. The loader writes `data/snapshots/diagnostics/ercot-native.json` and falls through to `data/snapshots/last-good/ercot-native.json`.
- Vercel outcome: the first production build showed the three ERCOT env vars were absent from Vercel despite the prerequisite; they were added to Production from `.env.local`. The redeployed Vercel US build then acquired a token and bypassed Incapsula, but the SCED artifact data call returned HTTP 404 Resource Not Found.
- Product outcome: `ERCOT_NATIVE_ENABLED` remains `false`; the dashboard stays on the EIA proxy (`ercot-west` and `ercot-east`). The native loader remains in the repo for a future endpoint-discovery pass now that the Vercel-US auth path is known to reach ERCOT.

---

## AEMO NEMWeb per-state intermittent output (used)

**Feed used:** `https://nemweb.com.au/Reports/Current/Next_Day_Intermittent_Gen_Scada/`

**Why this path:** the AEMO app JSON endpoints and the registration spreadsheet were both Cloudflare-blocked from this NZ environment during implementation. The full `Daily_Reports` archive was reachable but materially heavier. The intermittent SCADA daily feed is smaller, public, and still sourced from AEMO NEMWeb.

- Cadence: one ZIP per market day, published shortly after 04:00 AEST.
- Payload used: `LOCL` rows per DUID as a live proxy for wind/solar output.
- Window: latest 30 daily ZIPs from the directory listing.
- Split logic: DUIDs mapped to NSW/VIC/QLD/SA/TAS via a checked-in unit map derived primarily from OpenNEM's published station metadata, with a small supplement for newer units cross-checked against public AESOP listings.

**Curtailment method:** direct curtailment was not cleanly exposed in a stable public API from this environment, so v0.5 B1 uses the approved fallback: per-state wind+solar output proxy × 3%.

**Methodology note:** this is a calibrated live-generation proxy, not a direct AEMO dispatch-down measure. South Australia and Tasmania remain wind-heavy; NSW/VIC/QLD are solar-heavy.

---

## Norway NO-4 via ENTSO-E (used)

**Feed used:** ENTSO-E Transparency API `A75` actual generation per type for NO-4.

- Domain: `10YNO-4--------9`
- PSR types summed: `B12` hydro + `B19` wind
- Window: trailing 30 days
- Cadence: quarter-hourly, as published by ENTSO-E

**Method:** NO-4 is used as the live replacement for `n-norway`. The dashboard still labels this as "N. Norway", but the methodology note makes clear that much of the economic waste here is export-constrained hydro rather than classical renewable curtailment.

**Calibration:** 6% of observed hydro+wind generation.

---

## Brazil Northeast curtailment clusters (used)

**Feed used:** ONS constrained-off wind CSVs at `restricao_coff_eolica_tm`.

**Change in v0.5 B1:** the loader now clusters plant-level rows by `id_estado` before profiling.

- `RN -> brazil-rn`
- `CE -> brazil-ce`
- `BA -> brazil-bahia`
- `PI -> brazil-piaui`
- `PE -> brazil-pernambuco`
- everything else -> `brazil-other`

This remains a direct curtailment feed, not a calibrated proxy.

---

## ENTSO-E regional expansion (used)

The existing ENTSO-E loader now covers six bidding zones instead of three:

- Germany: wind onshore, 2%
- Iberia: solar, 2%
- Finland: wind onshore, 5%
- France: wind onshore, 3%
- Netherlands: solar, 4%
- Denmark West: wind onshore, 4%

All six use the same ENTSO-E Transparency API `A75` actual-generation pattern and are wrapped under the same resilient multi-region loader.

---

## Ontario IESO generator output (used)

**Feed used:** `https://reports-public.ieso.ca/public/GenOutputCapability/PUB_GenOutputCapability*.xml`

- Cadence: daily XML, hourly per-unit output and capability
- Window: current rolling XML plus 29 dated daily files
- Method: sum `FuelType=WIND` hourly output across all units, then apply a 4% calibrated curtailment proxy
- Calibration rationale: Ontario wind curtailment is modest relative to total wind generation; v0.5 uses ~1.5 TWh / 35 TWh as the proxy baseline
- Quirk: the XML is local-market hourly output rather than direct curtailment, so this remains a proxy feed

---

## Alberta AESO current supply-demand snapshot (temporary v0.5 path)

**Feed used:** `http://ets.aeso.ca/ets_web/ip/Market/Reports/CSDReportServlet`

- Cadence: live HTML snapshot with 60-second refresh
- Window: no public historical series wired here yet, so v0.5 repeats the current wind snapshot across a synthetic 30-day window
- Method: parse the current `WIND` TNG row and apply a 5% calibrated curtailment proxy
- Calibration rationale: Alberta 2024 wind curtailment is roughly 0.5-1 TWh on ~12 TWh wind generation
- Quirk: this is intentionally labelled as a snapshot-derived fallback until a public historical AESO path is confirmed

---

## Ireland EirGrid renewables page (temporary v0.5 path)

**Feed used:** `https://www.eirgridgroup.com/how-the-grid-works/renewables/`

- Cadence: page availability check only
- Intended source: SmartGrid Dashboard API
- Status: `https://www.smartgriddashboard.com/DashboardService.svc/data` remained HTTP 503 from this environment during B3
- Method: if the EirGrid page is reachable, emit a calibrated 30-day wind-shaped fallback profile at 6%
- Calibration rationale: Ireland SNSP-related dispatch-down is commonly reported in the ~5-7% range of wind output
- Quirk: this is not a direct measured time series yet; the note is surfaced in `sourceNote`

---

## Peru COES generation dashboard (used)

**Feed used:** `https://www.coes.org.pe/Portal/portalinformacion/Generacion`

- Auth: none; public POST endpoint used by the dashboard JS
- Cadence: half-hourly SCADA series
- Window: requested as a trailing 30-day POST range
- Method: sum `SOLAR` + `EÓLICA/EOLICA`, aggregate half-hours to hourly values, then apply a 2% calibrated curtailment proxy
- Calibration rationale: Peru renewable curtailment is still modest at a system scale, but southern transmission constraints justify a small non-zero proxy
- Quirk: timestamps are local Peru time and converted to UTC in-loader

---

## South Africa Eskom Data Portal (temporary v0.5 path)

**Feed used:** `https://www.eskom.co.za/dataportal/`

- Cadence: page availability check only
- Intended source: public chart/CSV endpoints behind the renewables dashboard
- Status: the public HTML exposes the portal shell and menu structure, but not a stable unauthenticated renewable time-series endpoint
- Method: if the portal is reachable, emit a calibrated 30-day mixed renewable fallback profile at 2%
- Calibration rationale: South African wind/solar curtailment exists but remains modest relative to broader grid constraints
- Quirk: this is a temporary fallback profile, documented explicitly until a public CSV or chart endpoint is confirmed

---

## Chile Atacama / Coordinador Electrico Nacional (B2 attempt, fallback used)

**Intended:** native Chile renewable-reduction or vertimiento data from Coordinador Electrico Nacional.

**v0.5 B2 hard-unlock attempt:** Playwright headless Chromium can load the public `reportes-y-estadisticas` landing page from this environment after waiting for the Cloudflare check. That page exposes relevant leads including `Reducciones de Generación Renovable`, `Generación de Energía`, `Histórico Generación Horaria por Central`, and `Vertimientos`.

**Blocker:** the specific `Reducciones de Generación Renovable` document path still returns Cloudflare "Just a moment" / bot-verification content in headless Chromium, even after first visiting the unlocked landing page in the same browser context. No stable CSV/XLSX download path was exposed within the B2 time box.

**Fallback used:** `src/data/atacama-chile.json.ts` now emits a typical solar shape via `solarProfile(16.5, 5.9)`, using local solar noon around UTC 16:30 and the book's 5.9 TWh/year Atacama annual baseline.

- Region id: `atacama`
- Tier: `static`
- 30-day total: `5.9 * 30 / 365 = 0.485 TWh`
- Peak: synthetic daylight peak around UTC hour 16
- Source note: explicitly labelled as a typical-shape fallback, not a native measured feed
