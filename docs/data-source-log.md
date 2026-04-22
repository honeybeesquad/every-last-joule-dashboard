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
