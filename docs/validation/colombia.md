# Validation — Colombia (`colombia`)

Last updated: 2026-04-30 · Sprint: S1 + Gemini research wave 1 + XM API verification · Paper section: Technical Validation §4.2

## Source

- **Region id:** `colombia`
- **Country:** COL
- **Tier:** static
- **Kind:** hydro
- **Source:** XM SinerGox API (`servapibi.xm.com.co/daily`, `MetricId=VertEner`, `Entity=Sistema`) — system-wide vertimientos hidráulicos in kWh, daily granularity. Reservoir-overflow energy-equivalent spillage; the Colombian SIN's dominant wasted-renewable-energy mechanism. **5-year mean (2020–2024): 7.53 TWh/yr.** Range 0.53–13.12 TWh/yr (ENSO-driven).
- **Source URL:** [https://servapibi.xm.com.co/daily](https://servapibi.xm.com.co/daily) (geoblocked outside Colombia; promotion to T1a-live is gated only on a Colombian-egress relay)
- **Loader:** _(no single-file loader — emitted via `STATIC_REGIONS.colombia` in `src/data/statics.json.ts`. T1a promotion would replace this with a live loader pointed at the XM API through a Colombian-egress relay.)_
- **Structural gap:** no (data is fully reachable from any Colombian IP via XM's open public API; promotion is a deployment problem, not a data-availability problem)

## Calibration

- **Rate source:** n/a — vertimientos are direct measurements of energy-equivalent spillage, not a generation × rate calibration. Anchor = 5-year mean of monthly XM totals.
- **Uniform across backfill years:** No — vertimientos vary by ~25× year-on-year because of ENSO. 2020 (drought tail): 0.53 TWh. 2022 (very wet): 13.12 TWh. The 5-year mean smooths this for the static anchor.

## Multi-year monthly verification (2020–2025-Q1)

Source: XM SinerGox API, `MetricId=VertEner`, `Entity=Sistema`, daily values summed per month, kWh→GWh. Full data captured at [`data/historical/colombia-vertimientos-monthly.csv`](../../data/historical/colombia-vertimientos-monthly.csv).

| Year | Annual GWh | Annual TWh | Notes |
|---|---:|---:|---|
| 2020 | 526.93 | 0.53 | drought tail; Sep-Dec only |
| 2021 | 8,161.33 | 8.16 | wet year, May-Nov heavy |
| 2022 | 13,123.83 | 13.12 | wettest in series |
| 2023 | 9,664.10 | 9.66 | wet, especially Jan-May |
| 2024 | 6,172.53 | 6.17 | El Niño Q1 (almost zero) → wet Q2-Q3 |
| 2025 (Jan-Apr) | 3,682.32 | 3.68 | Q1+Q2 already wet; full-year likely ~10 TWh |
| **5-yr mean (2020-2024)** | **7,529.74** | **7.53** | **canonical T3 anchor** |

## Published anchors

- **XM SinerGox API (verified 2026-04-30):** Feb-2025 vertimientos hidráulicos = `705.24 GWh-mes` exactly (matches Gemini-3.1's cited figure to two decimal places). 5-year mean 7.53 TWh/yr. See `docs/methodology/2026-04-29-gemini-research-wave-1.md` §"Verification 2026-04-30".
- **UPME / SER Colombia:** VRE (solar / wind) curtailment <1% of generation — wasted-energy story is dominated by hydro spillage.
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** Acolgen industry commentary on hydro spillage during high-inflow seasons.

## Discrepancy analysis

The 5-year mean of 7.53 TWh/yr is held as the T3 anchor. The natural year-on-year variance (0.53–13.12 TWh/yr) exceeds the ±40% T3 envelope, so the envelope here under-states ENSO-cycle uncertainty rather than over-stating it. The honest reading is "this region's expected annual is 7.5 TWh, but it could be 0.5 TWh in a strong El Niño year or 13 TWh in a strong La Niña year." A future T1a live loader would surface this honestly month-by-month rather than collapse it to a static mean.

## Known limitations

The Colombian SIN is hydro-dominant (~60–70% of generation in normal years). Reservoir-overflow spillage (`vertimientos hidráulicos`) is the dominant "wasted potential renewable energy" mechanism and is conceptually identical to the spillage already modelled for Iceland (5.3 TWh/yr) and Sichuan (30 TWh/yr). VRE (solar / wind) curtailment in Colombia is currently negligible (<1%) per UPME / SER Colombia analyses — most "missing" La Guajira renewable generation is structural (transmission projects delayed) rather than operational spillage.

The XM SinerGox API is geoblocked outside Colombia, but is **otherwise fully open** (no auth, no rate-limit observed, structured JSON). Promotion from T3-static to T1a-live is therefore gated only on a persistent Colombian-egress relay (a small Colombian VPS, a residential proxy with Colombian PoP, or a Cloudflare Worker with country-routing). For the v1.0 dataset, the static 5-year mean is sufficient and honest. T1a promotion is a follow-up.

T3-modelled, ±40% envelope. Bimodal hydro-seasonal shape (`HYDRO_SEASONAL_SHARES.colombia`) lagging the rainfall peaks by reservoir-fill cycle: peak May-Jun and Nov-Dec, dry windows Jan-Feb and Jul-Aug.

## Links

- Loader: `src/data/statics.json.ts` (`STATIC_REGIONS.colombia`)
- Seasonal shape: `src/lib/typical-profiles.ts` (`HYDRO_SEASONAL_SHARES.colombia`)
- Monthly verification data: [`data/historical/colombia-vertimientos-monthly.csv`](../../data/historical/colombia-vertimientos-monthly.csv)
- Research wave methodology: [`docs/methodology/2026-04-29-gemini-research-wave-1.md`](../methodology/2026-04-29-gemini-research-wave-1.md)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
