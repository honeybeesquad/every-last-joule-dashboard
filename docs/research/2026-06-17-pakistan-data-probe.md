# Pakistan NEPRA Data Probe — 2026-06-17

## Summary

Pakistan has ~8 GW installed VRE capacity (wind + solar) with significant curtailment
reported in NEPRA State of Industry Reports (1,337 GWh wind curtailment in FY2023-24).
However, **no programmatic data access** was found for hourly generation or curtailment data.
All three candidate data sources (NEPRA, NTDC, AEDB) publish annual PDF reports or static
HTML tables with monthly aggregates — none expose JSON/CSV APIs.

## Data Sources Investigated

### 1. NEPRA (National Electric Power Regulatory Authority)
- **URL:** https://nepra.org.pk/
- **State of Industry Reports:** Published annually (2004–2025), PDF format
- **Data Repository:** HTML framesets containing Excel-exported tables
  - URL pattern: `https://nepra.org.pk/publications/State%20of%20Industry%20Reports/Detail%20of%20Generation/SIR%20Data%2020XX.htm`
  - Contains: Company-level installed capacity (MW), dependable capacity (MW), monthly generation (GWh), plant utilization (%) for FY 2023-24
  - Format: Excel → HTML conversion, no CSV/JSON available
  - Wind curtailment: 1,337 GWh NPMV (Non-Project Missed Volume) for wind in FY2023-24
  - Solar curtailment: Not separately quantified in NEPRA reports
- **Key finding:** Data Repository is HTML framesets with embedded Excel tables. Could potentially scrape HTML tables but would need custom parser. No API or bulk download.

### 2. NTDC (National Transmission & Despatch Company)
- **URL:** https://www.ntdc.gov.pk/
- **Data availability:** No data portal, no API, no generation/dispatch data publicly available
- **Content:** Corporate website with project details, tenders, press releases
- **Key finding:** NTDC operates the 220kV and 500kV grid but does not publish generation data publicly

### 3. AEDB (Alternative Energy Development Board)
- **URL:** https://aedb.org.pk (site unreachable during probe)
- **Expected content:** RE project registry, capacity data
- **Key finding:** Website was down/unreachable; likely no programmatic data access based on pattern

## Alternative Data Sources Considered

### IRENA
- Pakistan country profile available but annual aggregates only
- No hourly data

### IGCEP (Indicative Generation Capacity Expansion Plan)
- NEPRA document, PDF format
- Contains capacity projections and curtailment narratives
- No structured data

## Recommendation

**Keep current T3 fallback modelled loader.** The existing `pakistan.json.ts` correctly:
- Uses typical wind/solar profiles (synthetic hourly shape)
- Calibrates to 1,337 GWh NPMV anchor (90% wind / 10% solar split)
- Documents the data limitation clearly

**Potential future improvement:** NEPRA Data Repository HTML tables could be scraped
for monthly company-level generation data. This would allow:
- Validation of annual curtailment totals
- Monthly disaggregation
- But still no hourly resolution

**No loader build warranted** — the data does not exist in a programmatic format.
The current fallback is the appropriate approach until NEPRA or NTDC publish structured data.

## Files Created
- `docs/research/2026-06-17-pakistan-data-probe.md` (this document)

## Files Unchanged
- `src/data/pakistan.json.ts` — existing T3 loader retained
- `src/lib/regions.ts` — region entries already correct
