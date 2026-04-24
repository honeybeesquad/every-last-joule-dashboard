# Data source log

Per-source notes on status, API quirks, and access. One section per feed.

---

## Colombia XM SINERGOX API (absent)

**Intended feed:** XM's documented public SINERGOX API, exposed by the official `pydataxm` client.

- Base URL: `https://servapibi.xm.com.co`
- Documented endpoints: `POST /hourly`, `POST /daily`, `POST /monthly`, `POST /lists`
- Auth: none. The official README states that API XM does not require a user or key.
- Official client: `https://github.com/EquipoAnaliticaXM/API_XM`
- Client implementation: `pydataxm.ReadDB` posts JSON to `https://servapibi.xm.com.co/{period_base}` and loads metric inventory from `POST https://servapibi.xm.com.co/Lists` with `{"MetricId":"ListadoMetricas"}`.

**Metric IDs confirmed from the official repo:**

- `Gene`: `Generacion Real`, entity `Sistema` and `Recurso`, `Horaria`
- `GeneProgDesp`: `Generacion Programada Despacho`, entity `Recurso`, `Horaria`
- `GeneProgRedesp`: `Generacion Programada Redespacho`, entity `Recurso`, `Horaria`
- `DesvEner`: `Desviaciones Energia`, entity `Recurso`, `Horaria`
- `CapEfecNeta`: `Listado Recursos Generacion`, entity `Recurso`, `Diaria`
- `ListadoRecursos`: `Listado Recursos`, entity `Sistema` and `Agente`, `Lista`
- The requested shorthand `Desp` and `DesvGene` were not present in `pydataxm/metricasAPI.json`; XM's published spellings are `GeneProgDesp` and `DesvEner`.

**Documented request shapes attempted:**

```json
POST https://servapibi.xm.com.co/Lists
{"MetricId":"ListadoMetricas"}
```

```json
POST https://servapibi.xm.com.co/hourly
{"MetricId":"Gene","StartDate":"2024-01-01","EndDate":"2024-01-02","Entity":"Sistema"}
```

```json
POST https://servapibi.xm.com.co/hourly
{"MetricId":"GeneProgDesp","StartDate":"2024-01-01","EndDate":"2024-01-02","Entity":"Recurso"}
```

**Local outcome on 2026-04-24:** not reachable from this build environment.

- Plain `curl` to `https://servapibi.xm.com.co/Lists` failed with `curl: (6) Could not resolve host: servapibi.xm.com.co`.
- `dig +short servapibi.xm.com.co` returned no usable answer.
- `nslookup servapibi.xm.com.co` first returned `SERVFAIL` from the local resolver, then showed `191.97.49.119` and `179.1.12.119`.
- Explicit `curl --resolve servapibi.xm.com.co:443:191.97.49.119 ...` timed out after 10 seconds; both `191.97.49.119` and `179.1.12.119` timed out after 75 seconds.
- General internet access from the same environment was working; `https://github.com/EquipoAnaliticaXM/API_XM` returned HTTP 200.

**Corroborating public issue:** EquipoAnaliticaXM/API_XM issue #37 documents the same DNS/proxy class of failure for `servapibi.xm.com.co` from outside Colombia and notes that routing through a Colombian proxy can resolve it.

**Decision:** Colombia remains absent. It must not be represented by a modelled fallback; add it only when XM's documented public API is reachable in the production build path and response samples can be checked in as fixtures.

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

**v1 focused CSV spike:** added `.github/workflows/chile-ercot-csv-spike.yml` and `scripts/probe-chile-ercot.ts` so ERCOT endpoint reachability is recorded from a GitHub-hosted US runner instead of the NZ local network. The probe writes `docs/spikes/chile-ercot-csv-probe.md`.

- Candidate `https://www.ercot.com/mp/data-products/data-product-details?id=NP6-970-CD` is reachable in public crawls, but the page identifies NP6-970-CD as `RTD Indicative LMPs by Resource Nodes, Load Zones and Hubs`, not wind curtailment.
- Candidate `https://www.ercot.com/content/cdr/html/CURRENT_DAYWGRPP.html` is the actual current-day forecast/actual wind production table, but it is generation/forecast rather than direct dispatch-down curtailment and only current-day.
- Decision: keep `ERCOT_NATIVE_ENABLED = false` until the US-runner probe identifies a direct report with timestamped curtailment or enough SCED fields to defensibly derive it. Existing EIA proxy remains primary.

---

## AEMO NEMWeb per-state direct dispatch-down (used)

**Feed used:** `https://nemweb.com.au/Reports/Current/Next_Day_Dispatch/`

**v1b change:** upgraded from intermittent-generation proxy to direct semi-scheduled dispatch-down measurement.

- Cadence: one ZIP per market day, published shortly after 04:00 AEST.
- Payload used: `DISPATCH_UNIT_SOLUTION` rows per DUID.
- Window: latest 30 daily ZIPs from the directory listing.
- Split logic: DUIDs mapped to NSW/VIC/QLD/SA/TAS via a checked-in unit map derived primarily from OpenNEM's published station metadata, with a small supplement for newer units cross-checked against public AESOP listings.

**Curtailment method:** direct measurement. When `SEMIDISPATCHCAP=1`, the semi-scheduled unit is actively capped; the loader estimates curtailed MW as `max(0, UIGF - TOTALCLEARED)` and aggregates by NEM state.

**Methodology note:** "NEMWEB DISPATCHIS/Next Day Dispatch SEMIDISPATCHCAP direct curtailment per state".

---

## CAISO OASIS direct curtailment / EIA fallback (used)

**Direct feed attempted:** `https://oasis.caiso.com/oasisapi/SingleZip?queryname=SLD_REN_CURTAIL&version=1&...&resultformat=6`

**v1b outcome:** the loader now attempts `SLD_REN_CURTAIL` first and parses wind+solar curtailment CSVs when OASIS returns them. From this NZ environment, the endpoint still returns `INVALID_REQUEST.xml.zip` for the surveyed query name/date format, so the production path falls back inside the loader to the prior EIA CISO solar proxy when `EIA_API_KEY` is present, or to the resilient last-good snapshot when not.

**Fallback method:** EIA hourly CISO solar × 4.25% calibrated curtailment rate. This remains a calibrated proxy until the correct OASIS query contract is confirmed.

---

## US ISO EIA Hourly Electric Grid Monitor expansion (used)

**Feed used:** EIA Hourly Electric Grid Monitor fuel-type data, same endpoint and API key path as the ERCOT/CAISO EIA proxy.

- Endpoint: `https://api.eia.gov/v2/electricity/rto/fuel-type-data/data/`
- Query used: `frequency=hourly`, `data[0]=value`, `facets[respondent][]=<ISO>`, `facets[fueltype][]=WND|SUN`
- Window: trailing 30 days, WND and SUN fetched in parallel.
- Method: calibrated curtailment proxy, merged wind+solar hourly generation with fuel-specific rates; `fuelShare` is computed dynamically from observed 30-day MW volumes.
- Shared implementation: `src/lib/eia-iso.ts`, used by the six simple single-region ISO loaders.

**v1o regions and calibration citations:**

- MISO (`MISO`): Minnesota, Iowa, Illinois, Michigan, Indiana, Wisconsin, Missouri, Arkansas, Mississippi, Louisiana. Rates: wind 8%, solar 4%, based on ~5 TWh 2024 wind curtailment plus ~0.5 TWh solar against ~65 TWh wind and ~12 TWh solar. Source: MISO 2024 State of the Market, Potomac Economics.
- PJM (`PJM`): Mid-Atlantic and Ohio Valley footprint. Rates: wind 2%, solar 2.5%, reflecting small but growing 2024 solar curtailment concentrated in NJ/MD/VA and smaller PA/WV/OH wind curtailment. Sources: PJM Renewable Integration Study 2024 and PJM Markets Monitor 2024 State of the Market.
- SPP (`SWPP`): Great Plains/Southwest Power Pool footprint. Rates: wind 4%, solar 3%, based on ~3 TWh 2024 wind curtailment on ~75 TWh wind and emerging Oklahoma solar. Sources: SPP 2024 State of the Market, Monitoring Analytics, and SPP 2024 Reliability Report.
- NYISO (`NYIS`): New York state including Long Island. Rates: wind 3%, solar 2%, with low current curtailment and expected offshore wind growth from Sunrise Wind and Empire Wind. Sources: NYISO 2024 Power Trends Report and Gold Book 2024.
- ISO-NE (`ISNE`): Massachusetts, Connecticut, Rhode Island, New Hampshire, Vermont, Maine. Rates: wind 3%, solar 2%, reflecting small total regional curtailment. Source: ISO-NE 2024 Regional Electricity Outlook.
- BPA (`BPAT`): Oregon, Washington, Idaho, western Montana. Rates: wind 6%, solar 2%, reflecting spring oversupply wind throttling during high-runoff, low-demand periods. Sources: BPA 2024 Oversupply Management Protocol implementation report and BPA Technical Operations.

**BPA seasonality note:** no separate seasonal correction is applied. The EIA hourly generation feed provides the 30-day observed shape, so spring-concentrated oversupply appears naturally when the trailing window covers April-June.

---

## Belgium Elia wind+solar CSV (used)

**Feed used:** Elia Open Data Opendatasoft CSV exports.

- Wind actual/forecast: `https://opendata.elia.be/api/explore/v2.1/catalog/datasets/ods086/exports/csv`
- Solar actual/forecast: `https://opendata.elia.be/api/explore/v2.1/catalog/datasets/ods087/exports/csv`
- Cadence: 15-minute rows.
- Format: UTF-8 BOM, semicolon-delimited.

**Endpoint surprise:** the research note had wind/solar ids reversed. Live probes show `ods086` is wind (has `offshoreonshore`) and `ods087` is solar.

**Curtailment method:** calibrated proxy, realtime MW when present else most-recent forecast, × 2% Belgium 2024 wind+solar curtailment ratio.

---

## France RTE eco2mix national CSV (used)

**Feed used:** `https://odre.opendatasoft.com/api/explore/v2.1/catalog/datasets/eco2mix-national-tr/exports/csv?refine=date_heure:YYYY-MM`

**v1b change:** France moved out of the ENTSO-E multi-zone loader into direct RTE eco2mix national coverage.

**Curtailment method:** calibrated proxy, `eolien_terrestre + eolien_offshore + solaire` × 3%.

---

## Denmark Energinet ProductionConsumptionSettlement (used)

**Feed used:** `https://api.energidataservice.dk/dataset/ProductionConsumptionSettlement`

**Endpoint surprise:** `?format=csv` currently returns a JSON envelope with `records` from this environment, so the loader parses the returned records rather than assuming a raw CSV body.

**v1b change:** Denmark moved out of ENTSO-E `denmark-west`; the dashboard now emits one national `denmark` region by summing DK1 and DK2.

**Curtailment method:** calibrated proxy, hourly wind+solar MWh columns × 4%.

---

## New Zealand EMI Generation_MD CSV (used)

**Feed used:** `https://www.emi.ea.govt.nz/Wholesale/Datasets/Generation/Generation_MD/YYYYMM_Generation_MD.csv`

**Endpoint surprise:** on 23 April 2026 the latest published file is `202603_Generation_MD.csv`; `202604_Generation_MD.csv` returns 404. The loader tries current and previous month and skips missing current-month files.

**Curtailment method:** calibrated proxy, Wind/Solar/Geo trading-period generation × 1.3%. EMI units are kWh by half-hour trading period, converted to hourly average MW before profiling.

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

The ENTSO-E loader remains for zones where direct TSO CSV access is not yet viable:

- Germany: wind onshore, 2%
- Iberia: solar, 2%
- Portugal: solar, 10% calibrated to ~0.4 TWh/yr
- Finland: wind onshore, 5%
- Netherlands: offshore wind, 4% (v1f fix: B16 solar was below visibility; B18 gives a non-zero ENTSO-E signal)
- Poland: wind onshore, 2%
- Greece: solar, 2.5%
- Romania: solar, 4% (v1f fix: B19 wind was below visibility; B16 solar gives a non-zero ENTSO-E signal)
- Italy North: solar, 2%
- Sweden North (SE2): wind onshore, 1%
- Sweden South (SE4): solar, 7% calibrated to ~0.3 TWh/yr

France and Denmark-West were removed in v1b after direct RTE and Energinet loaders were added.

**v1f zero-data audit:** the ENTSO-E parser now handles multiple `Period` blocks and `PT60M`/`PT30M`/`PT15M` resolutions. This fixed the previously invisible Netherlands, Romania, Italy North, and NO-4/N. Norway profiles. Turkey (`10YTR-TEIAS----W`) was probed against `B16`, `B18`, `B19`, `B11`, `B12`, and `B14`; ENTSO-E returned no usable A75 renewable generation data from this environment, and no stable unauthenticated TEIAS/EPIAS curtailment endpoint was integrated in the time-box. Turkey is therefore removed rather than shown as a zero-rate invisible region.

**2026-04-24 Turkey re-probe:** Turkey is promoted back to live through EPIAS' newer electricity-service dashboard endpoint. Probe details from this worktree:

- `https://seffaflik.epias.com.tr/electricity-service/technical/en/index.html`: HTTP 200, 3,379,338 bytes. API docs confirm `GET /v1/dashboard/realtime-generation` and the `RealTimeGenerationDto` fields `wind` and `sun`; docs still mark TGT auth as required for most range/history endpoints.
- `https://seffaflik.epias.com.tr/transparency/rehber`: timed out after 30 seconds with 0 bytes from this environment.
- `https://seffaflik.epias.com.tr/electricity-service/v1/dashboard/realtime-generation`: HTTP 200, 1,801 bytes, unauthenticated with `Accept: application/json` + User-Agent. Response shape: `{ items: [{ date, hour, wind, sun, ... }], latestUpdateTime }`. It returned current-day Turkey hourly generation through `2026-04-24T04:00:00+03:00` during the probe.
- `POST /electricity-service/v1/generation/data/realtime-generation`: HTTP 406, 209 bytes without TGT (`TGT` required message). Not integrated.
- `POST /electricity-service/v1/renewables/data/generation-forecast`: HTTP 401, 397 bytes without TGT. Not integrated.
- `POST /electricity-service/v1/renewables/data/licensed-realtime-generation`: HTTP 401, 397 bytes without TGT. Not integrated.
- Legacy `https://seffaflik.epias.com.tr/transparency/service/production/{real-time-generation,generation-forecast,renewable-sm-production,renewable-sm-forecast}` probes timed out or returned an empty reply from this environment. Not integrated.
- `https://www.teias.gov.tr/en-US`: HTTP 200, 177,226 bytes. TEIAS homepage exposes gross temporary live headline widgets, but the probed HTML showed zeroed source totals and no stable JSON history/curtailment endpoint.
- ENTSO-E A75 for `10YTR-TEIAS----W` with `B16`, `B19`, and `B18`: HTTP 401 without `ENTSOE_API_TOKEN` in this worktree. No ENTSO-E Turkey loader was added.
- EXIST/EPIAS corporate/publication pages: HTTP 200, but no unauthenticated curtailment or hourly historical wind+solar feed was found beyond the EPIAS dashboard service.
- IEA Türkiye renewables page: HTTP 403 from this environment, so it was not used as a machine-readable source.

Turkey loader: `src/data/turkey.json.ts` applies a conservative 0.8% rate to observed EPIAS dashboard wind+solar generation. The rate is anchored to roughly 0.5 TWh/yr in 2024 (`~0.8% × wind+solar generation`), using Ember's 2024 Turkey wind+solar generation share as the generation denominator and SHURA's low-curtailment integration work as a conservative benchmark. Because the unauthenticated EPIAS endpoint is dashboard/current-day only, `latestProfile` is intentionally `null` until a complete 24-hour day is returned.

---

## v1f fallback expansion regions (used)

These regions intentionally use typical-shape fallback profiles after one-day live-access probes found no stable unauthenticated hourly curtailment endpoint. Each loader still wraps in `withFallback` and writes a last-good snapshot.

- Argentina: CAMMESA public site probed; Patagonia wind fallback, 0.5 TWh/yr, wind profile.
- Uruguay: ADME/UTE probed; national wind fallback, 0.4 TWh/yr, wind profile.
- Paraguay: Itaipu/ANDE probed; Itaipu hydro spill fallback, 10 TWh/yr, near-flat hydro profile.
- Mexico: CENACE public reports and SENER mirror path probed; northern solar fallback, 1.2 TWh/yr, solar profile peaking UTC 19:00.
- Japan: OCCTO/JEPX/METI probed; Kyushu solar fallback, 1.7 TWh/yr, solar profile peaking UTC 03:00.
- Vietnam: EVN probed; Ninh Thuan/Binh Thuan solar fallback, 2 TWh/yr, solar profile peaking UTC 05:00.
- Thailand: EGAT/ERC probed; central solar fallback, 0.3 TWh/yr, solar profile peaking UTC 05:30.
- North India: NRLDC/CEA/MERIT probed; Rajasthan/Northern Region solar fallback, 1.5 TWh/yr, solar profile peaking UTC 06:30.
- Cyprus: TSOC/EAC probed; isolated-grid solar fallback, 0.1 TWh/yr, solar profile peaking UTC 10:00.
- Ethiopia: EEP probed; GERD/cascade hydro-spill fallback, 5 TWh/yr, near-flat hydro profile. This estimate is speculative and derived from reservoir capacity and seasonal inflow assumptions.

---

## v1k fallback expansion regions (used)

These 12 regions close Australia non-NEM, South/Southeast Asia, East Asia, Russia non-flare, and Middle East coverage gaps. All loaders wrap in `withFallback`; live probes are attempted by the executable loaders, while unit tests use deterministic typical-profile exports. No stable unauthenticated machine-readable hourly curtailment feed was integrated in the v1k time-box.

- Western Australia (SWIS): probed `https://data.wa.aemo.com.au/public/market-data/wem/` (404 from this environment), `https://aemo.com.au/energy-systems/electricity/wholesale-electricity-market-wem/data-wem/data-dashboard-wem` (Cloudflare 403), and `https://data.wa.aemo.com.au/` (market-data shell only). Fallback: solar-shaped SWIS profile peaking UTC 04:00, 0.4 TWh/yr, fuelShare solar 70% / wind 30%.
- NT & Pilbara: probed Horizon Power public site; Pilbara captive mining networks expose no public hourly curtailment. Fallback: solar profile peaking UTC 04:00, 0.2 TWh/yr.
- Indonesia: probed PLN public site; daily/generation materials are not an unauthenticated hourly curtailment feed. Fallback: Java-Bali solar profile peaking UTC 05:00, 0.3 TWh/yr.
- Malaysia: probed TNB/SEDA public sources; no hourly curtailment endpoint integrated. Fallback: Peninsular solar profile peaking UTC 04:00, 0.15 TWh/yr.
- South Korea (mainland): probed KPX English/EPSIS path; no mainland hourly curtailment feed integrated, with Jeju kept separate. 2026-04-24 refresh found KPX/Data Portal generation APIs but they require an approved Korea Open Data Portal `serviceKey`; direct `openapi.kpx.or.kr` calls timed out from this IP. Fallback: mainland solar profile peaking UTC 03:00, 0.5 TWh/yr.
- Russia (European grid): probed SO UES; sanctions/language/access constraints and no unauthenticated hourly hydro-spill feed. Fallback: seasonal hydro profile using Volga/western Russia NH spring-summer shares, 1 TWh/yr.
- Taiwan: probed Taipower generation-status page, data.gov.tw search, and T-REC. Taipower exposes live generation HTML, data.gov.tw exposes a portal shell, and T-REC is certificate metadata, not curtailment. Fallback: mixed offshore-wind + solar profile, 0.6 TWh/yr, fuelShare wind 67% / solar 33%.
- Jordan: probed NEPCO public site; annual/report-level curtailment references only. Fallback: mixed wind + solar profile, 0.35 TWh/yr, fuelShare wind 70% / solar 30%, calibrated to the 17% wind-curtailment headline.
- Saudi Arabia (solar): probed SEC/ECRA public path; no hourly solar curtailment endpoint integrated. This is separate from the `e-saudi` flare region. Fallback: solar profile peaking UTC 09:00, 0.3 TWh/yr.
- UAE: probed DEWA/EWEC public path; no hourly solar curtailment endpoint integrated. Fallback: solar profile peaking UTC 08:00, 0.2 TWh/yr.
- Oman: probed OPWP/Nama public path; annual-report level data only. Fallback: solar profile peaking UTC 08:00, 0.1 TWh/yr.
- Israel: probed Noga/IEC public path; no hourly solar curtailment endpoint integrated. Fallback: Negev solar profile peaking UTC 10:00, 0.15 TWh/yr.

---

## South Korea mainland live-probe refresh (2026-04-24)

Decision: keep fallback. KPX and EPSIS are reachable, and Korea Open Data Portal advertises KPX hourly solar/generation APIs, but the useful feeds require a free approved API key (`serviceKey`). The task explicitly forbids fabricating API keys, so no production live loader was added. Jeju remains a separate island-grid fallback.

Korea Open Data Portal API pages found:

- `https://www.data.go.kr/data/15103243/openapi.do` - KPX regional hourly solar generation. Swagger host `apis.data.go.kr/B552115/PvAmountByLocHr`, operation `getPvAmountByLocHr`; required params include `serviceKey`, `pageNo`, `numOfRows`, `dataType`, optional `tradeYmd`. This is generation, not curtailment, and needs key approval.
- `https://www.data.go.kr/data/15113384/openapi.do` - KPX fuel-by-fuel generation, system basis. Swagger host `apis.data.go.kr/B552115/PwrAmountByGen`, operation `getPwrAmountByGen`; required params include `serviceKey`, `pageNo`, `numOfRows`, `dataType`, optional `baseDate`. The portal note says this is mainland plus Jeju, so it is not directly a mainland-only curtailment feed.
- `https://www.data.go.kr/data/15142651/openapi.do` - KPX current fuel-by-fuel generation status. Service URL `https://openapi.kpx.or.kr/openapi/sumperfuel5m/getSumperfuel5m`; required `serviceKey`. This is current generation status, not curtailment.

Local endpoint probes:

| URL | HTTP | Content type | Size | Notes |
| --- | ---: | --- | ---: | --- |
| `https://www.kpx.or.kr/` | 200 | `text/html;charset=UTF-8` | 93,372 | KPX Korean homepage reachable; HTML portal only. |
| `https://www.kpx.or.kr/eng/` | 200 | `text/html;charset=UTF-8` | 26,949 | KPX English homepage reachable; links to EPSIS but no machine-readable mainland curtailment feed. |
| `http://epsis.kpx.or.kr/` | 000 | none | 0 | Port 80 connection failed from this IP. |
| `https://epsis.kpx.or.kr/` | 200 | `text/html` | 208 | Redirect shell to `/epsisnew/`. |
| `https://epsis.kpx.or.kr/epsisnew/` | 200 | `text/html;charset=UTF-8` | 44,459 | EPSIS portal shell reachable; menus expose statistics pages, not unauthenticated hourly curtailment JSON/CSV. |
| `https://epsis.kpx.or.kr/epsisnew/selectMain.do` | 200 | `text/html;charset=UTF-8` | 44,459 | Same EPSIS portal payload. |
| `https://www.keei.re.kr/` | 200 | `text/html;charset=UTF-8` | 79,675 | KEEI homepage reachable; links onward to KESIS. |
| `https://kesis.keei.re.kr/` | 200 | `text/html;charset=UTF-8` | 35,205 | KESIS statistics portal reachable; no live curtailment API found in this pass. |
| `https://kesis.keei.re.kr/portal/main/main.do` | 404 | `application/json;charset=UTF-8` | 131 | Guessed KESIS path not present. |
| `https://www.data.go.kr/` | 200 | `text/html;charset=UTF-8` | 135,498 | Korea Open Data Portal reachable. |
| `https://www.data.go.kr/data/15103243/openapi.do` | 200 | `text/html;charset=UTF-8` | 177,565 | KPX regional hourly solar generation API detail page; application flow and required `serviceKey`. |
| `https://www.data.go.kr/data/15113384/openapi.do` | 200 | `text/html;charset=UTF-8` | 179,502 | KPX fuel generation API detail page; application flow and required `serviceKey`. |
| `https://www.data.go.kr/data/15142651/openapi.do` | 200 | `text/html;charset=UTF-8` | 181,331 | KPX current fuel generation API detail page; application flow and required `serviceKey`. |
| `https://apis.data.go.kr/B552115/PvAmountByLocHr/getPvAmountByLocHr?pageNo=1&numOfRows=24&dataType=json&tradeYmd=20240401` | 401 | `text/plain; charset=utf-8` | 13 | Gateway returns `Unauthorized` without `serviceKey`. |
| `https://apis.data.go.kr/B552115/PwrAmountByGen/getPwrAmountByGen?pageNo=1&numOfRows=30&dataType=json&baseDate=20240401` | 401 | `text/plain; charset=utf-8` | 13 | Gateway returns `Unauthorized` without `serviceKey`. |
| `https://openapi.kpx.or.kr/openapiv2/PvAmountByLocHr?serviceKey=&pageNo=1&numOfRows=24&dataType=json&tradeYmd=20240401` | 000 | none | 0 | Timed out after 25 s from this IP. |
| `https://openapi.kpx.or.kr/openapiv2/PwrAmountByGen?serviceKey=&pageNo=1&numOfRows=30&dataType=json&baseDate=20240401` | 000 | none | 0 | Timed out after 25 s from this IP. |
| `https://openapi.kpx.or.kr/openapi/sumperfuel5m/getSumperfuel5m` | 000 | none | 0 | Timed out after 25 s from this IP. |
| `https://openapi.kpx.or.kr/openapi/sukub5mMaxDatetime/getSukub5mMaxDatetime` | 000 | none | 0 | Timed out after 25 s from this IP. |
| `https://openapi.kpx.or.kr/sukub.do` | 000 | none | 0 | Timed out after 25 s from this IP. |
| `https://www.komipo.co.kr/` | 200 | `text/html; charset=UTF-8` | 199 | KOMIPO redirect shell; no curtailment endpoint identified. |
| `https://www.khnp.co.kr/` | 200 | `text/html; charset=utf-8` | 321 | KHNP redirect shell; no curtailment endpoint identified. |
| `https://www.kosep.co.kr/` | 000 | none | 0 | DNS resolution failed. |
| `https://kosep.co.kr/` | 000 | none | 0 | TLS certificate name mismatch. |
| `https://www.koenergy.kr/` | 200 | `text/html;charset=UTF-8` | 247 | Korea South-East Power redirect shell; no curtailment endpoint identified. |
| `https://www.iea.org/countries/korea` | 403 | `text/html; charset=UTF-8` | 5,404 | Cloudflare challenge from this IP; country data is not a live curtailment feed. |

The existing South Korea mainland loader remains a conservative typical solar profile at 0.5 TWh/yr, peaking UTC 03:00 and excluding Jeju.

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

## Chile Atacama / Coordinador Electrico Nacional (v1 daily PDF + XLSX path used)

**Intended:** native Chile renewable-reduction or vertimiento data from Coordinador Electrico Nacional.

**v0.5 B2 hard-unlock attempt:** Playwright headless Chromium can load the public `reportes-y-estadisticas` landing page from this environment after waiting for the Cloudflare check. That page exposes relevant leads including `Reducciones de Generación Renovable`, `Generación de Energía`, `Histórico Generación Horaria por Central`, and `Vertimientos`.

**v1 unlock:** the Cloudflare-gated listing pages remain hostile to plain fetch, but direct WordPress XLSX upload URLs are reachable. The loader now tries predictable monthly upload paths such as `https://www.coordinador.cl/wp-content/uploads/2026/03/Reducciones-de-Energia-Eolica-Solar-Hidro-en-el-SEN_Febrero-26-PE-PFV_Publicar.xlsx`.

- Direct XLSX probe: February 2026 workbook returned HTTP 200 with `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
- Parser: unzip XLSX with the system `unzip`, parse `xl/workbook.xml`, shared strings, and `Resumen-DiarioHorario-Solar`; sum PFV plant rows across hourly MWh columns.
- Local result on 2026-04-23: 350 hourly points, `0.42905233735574794` TWh in the workbook month, peak hourly average `1.6409249376527262` GW, latest point `2026-02-28T22:00:00.000Z`.
- Other Chile paths checked: `energiaabierta.cl` did not connect locally; `infotecnica.coordinador.cl` returned HTTP 200; `api.coordinador.cl` and `sic.coordinadorelectrico.cl` did not resolve; `datos.gob.cl` returned HTTP 200; `generadoras.cl` redirected to `generadoras.cl`.

**2026-04-24 source refresh:**

- CEN `reportes-y-estadisticas`: documents the public report/product map. Relevant operational products include Generación de Energía (hourly, by technology and by plant), Histórico Generación Horaria por Central, Histórico Embalses/Vertimientos, Informe Diario de Novedades del CDC, and Reportes Mensuales.
- CEN `Reducciones de Generación Renovable`: still describes the reduction workbook series as a **registro mensual** of ERV reductions during real-time operation. Probing likely March 2026 direct XLSX names in the April 2026 upload directory returned 404 on 2026-04-24, while the February 2026 workbook remained reachable, so the XLSX cadence has not improved to daily/weekly.
- CEN developer portal: `https://portal.api.coordinador.cl/documentacion?service=sipubv2` exposes the SIP Swagger spec (`/swagger/spec/sip.json`, service endpoint `https://sipub.api.coordinador.cl`). It documents hourly real generation endpoints such as `/generacion-real/v3/findByDate`, but the security scheme requires `user_key` and says to request it through mesa de ayuda. Unauthenticated calls return `403 Authentication parameters missing`.
- CEN developer portal: `https://portal.api.coordinador.cl/documentacion?service=operaciones` exposes the Operación Swagger spec (`/swagger/spec/operaciones.json`, service endpoint `https://operacion.api.coordinador.cl`). It documents `/reduccion/v1/generacion` ("Obtener reducción generacion del sistema Neomante"), but the same `user_key` security applies; unauthenticated calls return `403 Authentication parameters missing`. This is the best candidate for a future direct API upgrade once a key is explicitly provisioned.
- CEN Informe de Novedades CDC: daily `Resumen Ejecutivo de Operación DD-MM-YYYY V1` PDFs are public and direct WordPress PDF URLs are reachable. On 2026-04-24, direct probes found `Resumen-Ejecutivo-de-Operacion-22-04-2026-V1.pdf` HTTP 200 while 23/24 April were not yet published. These PDFs include daily real/programmed generation plus "Reducción Energía Eólica y Solar durante la Operación en Tiempo Real (OTR)" with daily solar MWh and accumulated annual GWh.
- Implementation decision: use daily Resumen Ejecutivo solar-reduction MWh as the primary recent-volume source, apportioned across the 24 UTC hours using the measured hourly shape from the monthly XLSX. This reduces freshness from monthly to daily without replacing CEN-measured curtailment with a typical shape. If the daily PDF path or `pdftotext` extraction fails, the loader returns the monthly XLSX result. If both live paths fail, `withFallback` serves the last-good snapshot.
- Ember / OWID / IEA cross-checks: Ember and OWID publish annual or monthly Chile electricity-generation datasets rather than public daily/hourly Chile curtailment. IEA's VRE curtailment chart cites CEN's `Reducciones de energía eólica y solar en el SEN` workbooks and includes 2025 partial-year points, useful as annual cross-check only. These are not better primary feeds for the dashboard.
