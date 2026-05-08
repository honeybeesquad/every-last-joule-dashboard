# MW ↔ USD Toggle — Design Spec

**Date:** 2026-05-07  
**Status:** Approved for implementation

---

## Overview

Add a MW ↔ USD toggle that lets users switch the entire dashboard from showing wasted energy in power units (GW / TWh) to showing the wholesale market value of that wasted energy in US dollars ($/h and $/year). The toggle lives beside the headline number, applies globally to globe pillar heights, hotspot list rankings, and all headline statistics, and is backed by real price data for ~80 live-tier regions and published annual averages for the remainder.

---

## Decisions Summary

| # | Topic | Decision |
|---|-------|----------|
| 1 | Pricing strategy | **Hybrid** — live hourly prices for ~80 T1 regions; static annual averages for T2; explicit gaps for the rest |
| 2 | Headline framing | **D** — $/h (instantaneous) + $/year (annualised running rate), mirroring existing GW + TWh pairing |
| 3 | No-price regions | **B+C** — grey pillars on globe (present, unpriced); gap-row callout in hotspot lists |
| 4 | Time alignment | **C** — hourly price × hourly curtailment for T1; scalar annual price × MW for T2/T3 |
| 5 | Toggle placement | **B** — pill toggle beside the headline number |
| 6 | FX handling | **C** — all stored prices are `priceUSD`; loaders convert at fetch time; no runtime FX logic |

---

## 1. Data Model

### RegionData additions

Each region gains three optional fields alongside existing `curtailmentMW` / `profile[24]`:

```ts
interface RegionPriceData {
  priceTier: 'live' | 'static' | 'none';   // determines display confidence
  priceUSD?: number;                         // T2/T3: scalar $/MWh annual avg (USD)
  priceProfileUSD?: number[];                // T1: 24-element array of $/MWh per hour (USD)
}
```

Rules:
- `priceTier === 'live'` → `priceProfileUSD[24]` is present. Value = sum of `priceProfileUSD[h] × profile[h]` over 24h.
- `priceTier === 'static'` → `priceUSD` scalar present. Value = `priceUSD × curtailmentMW × 24` (annualised: `× 8760`).
- `priceTier === 'none'` → no price fields. Region renders as grey in USD mode; excluded from totals.

### Snapshot impact

T1 regions: snapshot grows by one 24-element float array (~200 bytes / region). For ~80 live regions this adds ~16 KB to the snapshot payload — negligible.

T2 regions: one extra scalar per region. Trivial.

---

## 2. Price Sources

### T1 — Live hourly prices (~80 regions)

Fetched when the live loader runs (same cadence as curtailment). All values converted to USD at fetch time using the day's ECB noon rate (fetched once per loader run, cached for that session):

| Market | API | Coverage |
|--------|-----|----------|
| ENTSO-E Day-Ahead | `transparency.entsoe.eu` (free, key required) | 37 EU bidding zones |
| EIA Open Data | `api.eia.gov` (free, no key needed) | 9 US ISO LMP hubs |
| AEMO | `aemo.com.au` open API | Australian NEM regions |
| ERCOT | ERCOT public API | Texas |
| NordPool | NordPool public API | NO/DK/SE/FI |

Prices fetched: day-ahead hourly settlement prices. Multiplied element-wise against `profile[24]` for that region.

FX: EUR → USD, AUD → USD fetched from ECB daily rates at loader run time. Embedded into `priceProfileUSD` before snapshot write.

### T2 — Static annual averages

One scalar `priceUSD` per country, sourced from:
- IEA *World Energy Prices* (primary — published annually, 150+ countries)
- EIA *International Electricity Prices* (supplement for remaining countries)
- Ember *Global Electricity Review* (fill for gaps)

Stored as a manually curated `data/static-prices.csv`, refreshed once per year when IEA publishes. Conversion from local currency to USD applied at CSV curation time (IMF annual average FX rate for that publication year).

### T3 / `priceTier: 'none'`

Regions without a citable price (opaque subsidised markets, unreported grids): `priceTier: 'none'`. Not estimated, not filled. Honest gap.

---

## 3. Value Computation

### Per-region instantaneous USD value ($/h)

```
if priceTier === 'live':
  valueUSD_per_h = sum(priceProfileUSD[h] × profile[h], h=0..23) / 24
  // weighted hourly average: captures price/curtailment correlation

if priceTier === 'static':
  valueUSD_per_h = priceUSD × curtailmentMW
  // scalar multiply; correlation not capturable — documented in methodology
```

### Annualised rate ($/year)

```
valueUSD_per_year = valueUSD_per_h × 8760
```

This is a running-rate annualisation (same methodology as existing TWh figure).

### Global headline

Sum of `valueUSD_per_h` across all regions with `priceTier !== 'none'`. Displayed with explicit footnote: "excludes N regions without price data."

---

## 4. Toggle UI

### Pill toggle — beside headline number

```
[MW]  USD          ← MW active, USD inactive (current state)
 MW  [USD]         ← USD active
```

Styled identically to the existing avg30d / last24h pill: `background: rgba(255,208,90,0.18); border-radius: 999px`. Lives in the hero stat block, flush-right of the headline number line. No header placement.

### Scope of toggle effect

When set to USD:

| Element | MW mode | USD mode |
|---------|---------|----------|
| Headline stat | GW (instantaneous) | $/h |
| Sub-headline | TWh annualised | $/year |
| Globe pillar heights | proportional to MW | proportional to $/h |
| Globe pillar colour | fuel colour | fuel colour (same) |
| Globe pillar opacity (no price) | full | 30% (greyed) |
| Hotspot list value | MW | $/h |
| Hotspot list sort | by MW | by $/h |
| Hotspot list — gap row | hidden | shown ("+ N regions without price data") |
| Confidence badge | existing tier badge | existing tier badge + "est." suffix for T2 |

Toggle state is stored in a top-level Observable reactive variable (`unitMode = Mutable('MW')`). All downstream cells that render values observe it.

---

## 5. No-Price Region Treatment

### Globe (B)

Regions with `priceTier === 'none'` in USD mode:
- Pillar still rendered (height = curtailmentMW, same as MW mode, so the globe stays populated)
- Pillar opacity: 0.30 (desaturated / ghosted)
- Dot: rendered at 40% opacity, no glow
- Tooltip: "No price data for this region"

### Hotspot list (C)

Below the ranked USD list, a dashed separator and a dim footer row:

```
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
+ 47 SOLAR REGIONS WITHOUT PRICE DATA
Pakistan, Bangladesh, …        — · 2.1 GW
```

Clicking the footer row does nothing (non-interactive label).

---

## 6. Methodology Page

Add a "USD Conversion" section documenting:
- T1 live methodology: hourly price × hourly curtailment, sources per market
- T2 static methodology: annual average price, IEA/EIA/Ember source, vintage year
- FX methodology: ECB daily noon rate for T1; IMF annual average for T2
- Confidence bands: ±10% T1, ±30% T2
- Honest gap: list of T3 regions with no price data

---

## 7. Error Handling

- **Price API timeout / unavailable**: fall back to previous snapshot's `priceProfileUSD`; display "(using cached prices)" tooltip on the $/h value.
- **FX rate unavailable**: fall back to previous day's cached rate; log warning. Do not fail the snapshot.
- **Region has `priceProfileUSD` but all zeros**: treat as `priceTier: 'none'` for that snapshot cycle; log.

---

## 8. Out of Scope (this phase)

- Local-currency display (everything is USD)
- Per-region historical USD timeline (timeline chart stays in MW mode)
- T3 modelled/estimated prices (IEA LCOE benchmarks etc.) — deferred to phase 2
- Social share cards in USD mode

---

## 9. Implementation Phases

**Phase 1 — Data layer (~2 weeks)**
- Curate `data/static-prices.csv` (T2 regions, IEA/EIA/Ember sources)
- Build T1 live price loaders (ENTSO-E, EIA, AEMO, ERCOT, NordPool)
- Extend snapshot schema with `priceTier`, `priceUSD`, `priceProfileUSD`
- Add FX fetch utility (ECB daily rates)
- Unit tests: value computation, edge cases (zero price, negative price, missing profile)

**Phase 2 — UI layer (~1 week)**
- `unitMode` reactive variable
- Toggle pill component (reuse existing pill styles)
- Globe renderer: USD mode pillar heights, grey opacity for no-price regions
- Hotspot list: USD sort, gap-row component
- Headline stat block: USD headline + annualised sub-line
- Methodology page: USD section

**Phase 3 — QA (~3 days)**
- Snapshot smoke test: all T1 regions produce non-zero `priceProfileUSD`
- Visual review: globe USD mode, hotspot lists, headline stat
- Methodology page review for scientific accuracy
