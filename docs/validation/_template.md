# Validation — {{REGION_NAME}} ({{REGION_ID}})

Last updated: {{TODAY}} · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Loader:** `src/data/{{LOADER_FILE}}`
- **Source:** {{SOURCE_DESCRIPTION}}
- **Source URL:** {{SOURCE_URL}}
- **Kind:** {{KIND}} (wind / solar / mixed / hydro / flare / geothermal)
- **Tier:** {{TIER}} (live / cached / static)
- **Fuel focus:** {{FUEL_FOCUS}}

## Calibration

- **Rate applied:** {{RATE_APPLIED}}
- **Rate provenance:** {{RATE_SOURCE}}
- **Applies uniformly across backfill years:** {{UNIFORM_RATE}}

{{RATE_YEARBYYEAR_NOTE}}

## Cross-check against external anchors

### Live-feed 30-day snapshot (latest snapshot)

| Metric | Value | Provenance |
|---|---|---|
| 30-day total TWh | {{LIVE_30D_TWH}} | Live loader, current snapshot |
| Peak hourly GW | {{LIVE_PEAK_GW}} | Live loader, current snapshot |

### Multi-year backfill annual totals (2020–2026)

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
{{BACKFILL_ANNUAL_TABLE}}

### Published anchors

- **TSO annual curtailment (latest):** {{TSO_ANNUAL}}
- **Ember annual curtailment:** {{EMBER_ANNUAL}}
- **IRENA annual curtailment:** {{IRENA_ANNUAL}}
- **Other:** {{OTHER_ANCHOR}}

## Discrepancy analysis

{{DISCREPANCY_DISCUSSION}}

## Known limitations

{{LIMITATIONS}}

## Links

- Loader: [`src/data/{{LOADER_FILE}}`](../../src/data/{{LOADER_FILE}})
- Backfill archive: `data/historical/backfill/{{BACKFILL_GLOB}}`
- Methodology: [`docs/methodology/{{METHOD_DOC}}`](../methodology/{{METHOD_DOC}})
