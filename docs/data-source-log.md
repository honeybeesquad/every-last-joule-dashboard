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
