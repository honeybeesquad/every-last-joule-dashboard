# Validation — Colombia (`colombia`)

Last updated: 2026-05-10 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `colombia`
- **Country:** COL
- **Tier:** live-domestic-anchored
- **Kind:** hydro
- **Source:** XM SinerGox API (servapibi.xm.com.co/daily, POST MetricId=VertEner Entity=Sistema). Direct live path tried first from any Colombian-egress runner; committed CSV at data/historical/colombia-vertimientos-daily.csv is the production source-of-truth, refreshed by Britta via the elj-co WireGuard tunnel (Colombian egress). Trailing-365-day annualised total. 5-yr baseline 7.53 TWh/yr (range 0.53–13.12 TWh/yr ENSO-driven). Bimodal hydro-seasonal shape (Apr–Jun + Oct–Nov peaks). T1b, ±50% envelope.
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

The XM SinerGox API is geoblocked outside Colombia, but is **otherwise fully open** (no auth, no rate-limit observed, structured JSON, POST body only). The loader tries the live API first; from Vercel/CI it fails and falls back to the Britta-committed CSV. When the build environment has Colombian egress (e.g. Britta with `elj-co` WireGuard up), the live path activates transparently. Reclassified from T1a to T1b on 2026-05-02 because the ENSO-cycle range (0.53–13.12 TWh/yr) exceeds the T1a ±15% fallback envelope and the ±50% T1b empirical band is the honest representation for a hydro-dominant grid with inter-annual ENSO swings.

The 2026-05-08 PR fixed two bugs in the loader's live path that had previously made it always fail-and-fallback (independent of geoblock): (1) the `XmDailyItem` interface assumed an `Values: Record<string, number>` field, but the actual API response uses `DailyEntities: Array<{Id, Value}>` with `Value` as a kWh string; (2) the loader requested all 365 days in a single call, but the API rejects windows >30 days with HTTP 400. The live path now uses 30-day chunks and parses `DailyEntities` correctly. From Britta with `elj-co` up, both the live API path and the relay-CSV path are now usable; production continues to read from the CSV (the relay's output) as the source-of-truth.

T3-modelled, ±40% envelope. Bimodal hydro-seasonal shape (`HYDRO_SEASONAL_SHARES.colombia`) lagging the rainfall peaks by reservoir-fill cycle: peak May-Jun and Nov-Dec, dry windows Jan-Feb and Jul-Aug.

## Links

- Loader source: [`colombia.json.ts`](../../src/data/colombia.json.ts)
- Backfill archive: `data/historical/backfill/*_colombia_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
