# Validation — Colombia (`colombia`)

Last updated: 2026-04-30 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `colombia`
- **Country:** COL
- **Tier:** live
- **Kind:** hydro
- **Source:** XM SinerGox API via Britta daily relay — system-wide vertimientos hidráulicos. T1b-CSV: trailing-365-day mean from committed daily CSV (Britta cron 18:30 UTC). 5-yr baseline 7.53 TWh/yr (range 0.53–13.12 TWh/yr ENSO-driven). Bimodal hydro-seasonal shape (Apr–Jun + Oct–Nov peaks).
- **Source URL:** [https://servapibi.xm.com.co/daily](https://servapibi.xm.com.co/daily)
- **Loader:** [`colombia.json.ts`](../../src/data/colombia.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** —
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

The 5-year mean of 7.53 TWh/yr is held as the T3 anchor. The natural year-on-year variance (0.53–13.12 TWh/yr) exceeds the ±40% T3 envelope, so the envelope here under-states ENSO-cycle uncertainty rather than over-stating it. The honest reading is "this region's expected annual is 7.5 TWh, but it could be 0.5 TWh in a strong El Niño year or 13 TWh in a strong La Niña year." A future T1a live loader would surface this honestly month-by-month rather than collapse it to a static mean.

## Known limitations

The Colombian SIN is hydro-dominant (~60–70% of generation in normal years). Reservoir-overflow spillage (`vertimientos hidráulicos`) is the dominant "wasted potential renewable energy" mechanism and is conceptually identical to the spillage already modelled for Iceland (5.3 TWh/yr) and Sichuan (30 TWh/yr). VRE (solar / wind) curtailment in Colombia is currently negligible (<1%) per UPME / SER Colombia analyses — most "missing" La Guajira renewable generation is structural (transmission projects delayed) rather than operational spillage.

The XM SinerGox API is geoblocked outside Colombia, but is **otherwise fully open** (no auth, no rate-limit observed, structured JSON). Promotion from T3-static to T1a-live is therefore gated only on a persistent Colombian-egress relay (a small Colombian VPS, a residential proxy with Colombian PoP, or a Cloudflare Worker with country-routing). For the v1.0 dataset, the static 5-year mean is sufficient and honest. T1a promotion is a follow-up.

T3-modelled, ±40% envelope. Bimodal hydro-seasonal shape (`HYDRO_SEASONAL_SHARES.colombia`) lagging the rainfall peaks by reservoir-fill cycle: peak May-Jun and Nov-Dec, dry windows Jan-Feb and Jul-Aug.

## Links

- Loader source: [`colombia.json.ts`](../../src/data/colombia.json.ts)
- Backfill archive: `data/historical/backfill/*_colombia_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
