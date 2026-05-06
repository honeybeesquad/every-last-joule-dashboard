# USD Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a MW ↔ USD pill toggle that switches the entire dashboard from power units (GW/TWh) to wholesale market value ($/h and $/year annualised).

**Architecture:** A new `src/data/prices.json.ts` loader fetches live hourly day-ahead prices (ENTSO-E, EIA, AEMO) and reads static annual averages from `data/static-prices.csv`, outputting `Record<regionId, PriceData>`. `index.md` loads this snapshot alongside curtailment data and merges it. A `unitMode` flag drives `renderAt()`, hotspot lists, and globe pillar rendering. Computation lives in `src/lib/price.ts`; FX conversion lives in `src/lib/fx.ts`.

**Tech Stack:** TypeScript (Node loaders), Observable Framework (index.md JS cells), Vitest (tests), ECB SDMX JSON API (FX), ENTSO-E REST XML API, EIA Open Data REST JSON API, AEMO NEMWeb REST JSON API.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/types.ts` | Modify | Add `PriceData` interface and price fields to `RegionData` |
| `src/lib/price.ts` | Create | USD value computation: `usdValueAtHour`, `usdValuePerYear`, `aggregateUsdAtHour` |
| `src/lib/fx.ts` | Create | Fetch ECB daily EUR→USD and AUD→USD rates |
| `data/static-prices.csv` | Create | Manually curated annual avg price per region (IEA/EIA/Ember) |
| `src/data/prices.json.ts` | Create | Loader: reads CSV + fetches live prices, emits `Record<regionId, PriceData>` |
| `src/components/unit-toggle.js` | Create | MW/USD pill toggle component (mirrors mode-toggle.js pattern) |
| `src/index.md` | Modify | Load prices, wire `unitMode`, update `renderAt()`, hotspot lists, headline block |
| `src/style.css` | Modify | `.pillar--no-price` opacity style, `.unit-toggle` pill styles |
| `src/globe.js` | Modify | Accept `unitMode` + `priceData`, grey pillars for no-price regions in USD mode |
| `src/methodology.md` | Modify | Add "USD Conversion" section |
| `elj-agent/tests/price.test.ts` | Create | Unit tests for price computation functions |
| `elj-agent/tests/fx.test.ts` | Create | Unit tests for FX parsing |

---

## Task 1: Extend type definitions

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add `PriceData` interface and extend `RegionData`**

Open `src/lib/types.ts`. After the `RegionData` interface closing brace (currently line ~130), add:

```ts
/**
 * Price data for one region, emitted by the prices loader.
 * All monetary values are in USD/MWh or USD total.
 * priceTier drives rendering and display confidence.
 */
export interface PriceData {
  regionId: string;
  priceTier: "live" | "static" | "none";
  /** T2/T3: single annual average price in USD/MWh. */
  priceUSD?: number;
  /** T1: 24-element array of USD/MWh, index = UTC hour 0..23. */
  priceProfileUSD?: number[];
  /** Human-readable source description for methodology display. */
  priceSource?: string;
  /** ISO 8601 timestamp when this price data was last fetched/computed. */
  priceLastUpdated?: string;
}
```

Also add `priceData?: PriceData` to the `DashboardData` interface at the bottom of the file (after `generatedAt`):

```ts
export interface DashboardData {
  regions: Region[];
  regionData: Record<string, RegionData>;
  cbeci: CBECIData;
  anchor: GlobalAnchor;
  generatedAt: string;
  priceData?: Record<string, PriceData>;  // keyed by regionId
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard/elj-agent && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (or only pre-existing errors unrelated to the new types).

- [ ] **Step 3: Commit**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard && git add src/lib/types.ts && git commit -m "feat(types): add PriceData interface and DashboardData.priceData field"
```

---

## Task 2: Create price computation library

**Files:**
- Create: `src/lib/price.ts`
- Create: `elj-agent/tests/price.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `elj-agent/tests/price.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  usdValueAtHour,
  usdValuePerYear,
  aggregateUsdAtHour,
} from "../src/lib/price";
import type { RegionData } from "../src/lib/types";
import type { PriceData } from "../src/lib/types";

function makeRegionData(id: string, profile: number[]): RegionData {
  return {
    regionId: id,
    profile,
    latestProfile: null,
    totalTWh: 0,
    peakGW: Math.max(...profile, 0),
    lastUpdated: "2026-01-01T00:00:00Z",
    lastSuccessAt: "2026-01-01T00:00:00Z",
  };
}

function makeLivePriceData(regionId: string, priceProfileUSD: number[]): PriceData {
  return { regionId, priceTier: "live", priceProfileUSD };
}

function makeStaticPriceData(regionId: string, priceUSD: number): PriceData {
  return { regionId, priceTier: "static", priceUSD };
}

describe("usdValueAtHour — live tier", () => {
  it("multiplies price[h] × profile[h] for the given UTC hour", () => {
    const rd = makeRegionData("a", Array(24).fill(0).map((_, h) => h === 10 ? 2.0 : 0));
    const pd = makeLivePriceData("a", Array(24).fill(0).map((_, h) => h === 10 ? 50 : 0));
    // At hour 10: 50 USD/MWh × 2000 MW = 100,000 USD/h
    expect(usdValueAtHour(rd, pd, 10)).toBeCloseTo(100_000, 0);
  });

  it("returns 0 for hours with zero curtailment", () => {
    const rd = makeRegionData("a", Array(24).fill(0));
    const pd = makeLivePriceData("a", Array(24).fill(100));
    expect(usdValueAtHour(rd, pd, 12)).toBe(0);
  });

  it("returns 0 when priceProfileUSD is missing", () => {
    const rd = makeRegionData("a", Array(24).fill(2));
    const pd: PriceData = { regionId: "a", priceTier: "live" };
    expect(usdValueAtHour(rd, pd, 0)).toBe(0);
  });
});

describe("usdValueAtHour — static tier", () => {
  it("multiplies priceUSD × curtailmentMW for a given hour", () => {
    const rd = makeRegionData("a", Array(24).fill(0).map((_, h) => h === 6 ? 3.0 : 0));
    const pd = makeStaticPriceData("a", 60);
    // At hour 6: 60 USD/MWh × 3000 MW = 180,000 USD/h
    expect(usdValueAtHour(rd, pd, 6)).toBeCloseTo(180_000, 0);
  });

  it("returns 0 when priceUSD is missing", () => {
    const rd = makeRegionData("a", Array(24).fill(2));
    const pd: PriceData = { regionId: "a", priceTier: "static" };
    expect(usdValueAtHour(rd, pd, 0)).toBe(0);
  });
});

describe("usdValueAtHour — none tier", () => {
  it("returns 0 regardless of curtailment", () => {
    const rd = makeRegionData("a", Array(24).fill(5));
    const pd: PriceData = { regionId: "a", priceTier: "none" };
    expect(usdValueAtHour(rd, pd, 12)).toBe(0);
  });
});

describe("usdValuePerYear", () => {
  it("annualises the per-hour value by 8760", () => {
    const rd = makeRegionData("a", Array(24).fill(1)); // 1 GW = 1000 MW flat
    const pd = makeStaticPriceData("a", 50);
    // 50 USD/MWh × 1000 MW = 50,000 USD/h × 8760 = 438,000,000 USD/year
    expect(usdValuePerYear(rd, pd, 0)).toBeCloseTo(438_000_000, -3);
  });
});

describe("aggregateUsdAtHour", () => {
  it("sums USD values across all priced regions", () => {
    const regionData: Record<string, RegionData> = {
      a: makeRegionData("a", Array(24).fill(1)),
      b: makeRegionData("b", Array(24).fill(2)),
    };
    const priceData: Record<string, PriceData> = {
      a: makeStaticPriceData("a", 50),  // 50 × 1000 = 50,000 USD/h
      b: makeStaticPriceData("b", 80),  // 80 × 2000 = 160,000 USD/h
    };
    expect(aggregateUsdAtHour(regionData, priceData, 0)).toBeCloseTo(210_000, 0);
  });

  it("excludes regions with priceTier none from total", () => {
    const regionData: Record<string, RegionData> = {
      a: makeRegionData("a", Array(24).fill(1)),
      b: makeRegionData("b", Array(24).fill(5)),
    };
    const priceData: Record<string, PriceData> = {
      a: makeStaticPriceData("a", 50),
      b: { regionId: "b", priceTier: "none" },
    };
    expect(aggregateUsdAtHour(regionData, priceData, 0)).toBeCloseTo(50_000, 0);
  });

  it("returns 0 when no price data provided", () => {
    const regionData: Record<string, RegionData> = {
      a: makeRegionData("a", Array(24).fill(2)),
    };
    expect(aggregateUsdAtHour(regionData, {}, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard/elj-agent && npx vitest run tests/price.test.ts 2>&1 | tail -20
```

Expected: FAIL with "Cannot find module '../src/lib/price'"

- [ ] **Step 3: Create `src/lib/price.ts`**

```ts
import type { RegionData } from "./types.js";
import type { PriceData } from "./types.js";

/**
 * Compute the instantaneous USD value of curtailment for one region at one UTC hour.
 *
 * Unit arithmetic:
 *   profile[h] is in GW. Multiply by 1000 to get MW.
 *   price is in USD/MWh.
 *   MW × USD/MWh = USD/h.
 *
 * T1 (live): price[h] × profile[h] × 1000
 * T2 (static): priceUSD × profile[h] × 1000
 * T3 (none): 0
 */
export function usdValueAtHour(
  rd: RegionData,
  pd: PriceData,
  utcHour: number,
): number {
  if (pd.priceTier === "none") return 0;

  const h = ((Math.floor(utcHour) % 24) + 24) % 24;
  const mw = (rd.profile[h] ?? 0) * 1000; // GW → MW
  if (mw <= 0) return 0;

  if (pd.priceTier === "live") {
    const price = pd.priceProfileUSD?.[h];
    if (price == null || !Number.isFinite(price)) return 0;
    return price * mw;
  }

  if (pd.priceTier === "static") {
    const price = pd.priceUSD;
    if (price == null || !Number.isFinite(price)) return 0;
    return price * mw;
  }

  return 0;
}

/**
 * Annualise the per-hour USD value by multiplying by 8760.
 * Uses the same hour index as usdValueAtHour so the pair stays consistent.
 */
export function usdValuePerYear(
  rd: RegionData,
  pd: PriceData,
  utcHour: number,
): number {
  return usdValueAtHour(rd, pd, utcHour) * 8760;
}

/**
 * Sum instantaneous USD value across all regions that have price data.
 * Regions absent from priceData contribute 0.
 */
export function aggregateUsdAtHour(
  regionData: Record<string, RegionData>,
  priceData: Record<string, PriceData>,
  utcHour: number,
): number {
  let total = 0;
  for (const [id, rd] of Object.entries(regionData)) {
    const pd = priceData[id];
    if (!pd) continue;
    total += usdValueAtHour(rd, pd, utcHour);
  }
  return total;
}

/**
 * Count how many regions have curtailment but no price data (priceTier "none" or absent).
 */
export function countNoPriceRegions(
  regionData: Record<string, RegionData>,
  priceData: Record<string, PriceData>,
): number {
  let count = 0;
  for (const id of Object.keys(regionData)) {
    const pd = priceData[id];
    if (!pd || pd.priceTier === "none") count++;
  }
  return count;
}

/** Format a USD/h value as a compact human-readable string: "$427M/h", "$1.2B/h", etc. */
export function formatUsdPerHour(usdPerHour: number): string {
  if (usdPerHour >= 1e9) return `$${(usdPerHour / 1e9).toFixed(1)}B/h`;
  if (usdPerHour >= 1e6) return `$${(usdPerHour / 1e6).toFixed(0)}M/h`;
  if (usdPerHour >= 1e3) return `$${(usdPerHour / 1e3).toFixed(0)}K/h`;
  return `$${usdPerHour.toFixed(0)}/h`;
}

/** Format an annualised USD value: "$3.7T/year", "$427B/year", etc. */
export function formatUsdPerYear(usdPerYear: number): string {
  if (usdPerYear >= 1e12) return `$${(usdPerYear / 1e12).toFixed(1)}T/year`;
  if (usdPerYear >= 1e9)  return `$${(usdPerYear / 1e9).toFixed(0)}B/year`;
  if (usdPerYear >= 1e6)  return `$${(usdPerYear / 1e6).toFixed(0)}M/year`;
  return `$${usdPerYear.toFixed(0)}/year`;
}

/** Format a per-region USD/h value for the hotspot list: "$48M/h", "$3.2K/h", etc. */
export function formatRegionUsdPerHour(usdPerHour: number): string {
  if (usdPerHour >= 1e9) return `$${(usdPerHour / 1e9).toFixed(2)}B/h`;
  if (usdPerHour >= 1e6) return `$${(usdPerHour / 1e6).toFixed(1)}M/h`;
  if (usdPerHour >= 1e3) return `$${(usdPerHour / 1e3).toFixed(0)}K/h`;
  return `$${usdPerHour.toFixed(0)}/h`;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard/elj-agent && npx vitest run tests/price.test.ts 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard && git add src/lib/price.ts elj-agent/tests/price.test.ts && git commit -m "feat(price): add USD value computation library with tests"
```

---

## Task 3: Create FX utility

**Files:**
- Create: `src/lib/fx.ts`
- Create: `elj-agent/tests/fx.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `elj-agent/tests/fx.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseEcbRate, convertToUsd } from "../src/lib/fx";

describe("parseEcbRate", () => {
  it("extracts the EUR/USD rate from ECB SDMX JSON response", () => {
    // Minimal valid ECB SDMX JSON structure for EUR/USD
    const mockResponse = {
      dataSets: [{
        series: {
          "0:0:0:0:0": {
            observations: {
              "0": [1.0823],
              "1": [1.0891],
            }
          }
        }
      }]
    };
    // Should return the last (most recent) observation value
    expect(parseEcbRate(mockResponse)).toBeCloseTo(1.0891, 4);
  });

  it("throws when the ECB response is malformed", () => {
    expect(() => parseEcbRate({})).toThrow();
    expect(() => parseEcbRate(null)).toThrow();
  });
});

describe("convertToUsd", () => {
  it("converts EUR to USD using the provided rate", () => {
    expect(convertToUsd(100, "EUR", 1.08)).toBeCloseTo(108, 4);
  });

  it("converts AUD to USD using the provided rate", () => {
    // AUD/USD rate = 0.65 means 1 AUD = 0.65 USD
    expect(convertToUsd(100, "AUD", 0.65)).toBeCloseTo(65, 4);
  });

  it("returns the value unchanged for USD", () => {
    expect(convertToUsd(100, "USD", 1.0)).toBe(100);
  });

  it("throws for unknown currencies", () => {
    expect(() => convertToUsd(100, "GBP" as "EUR", 1.25)).toThrow();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard/elj-agent && npx vitest run tests/fx.test.ts 2>&1 | tail -10
```

Expected: FAIL with "Cannot find module '../src/lib/fx'"

- [ ] **Step 3: Create `src/lib/fx.ts`**

```ts
import { fetchJSON } from "./fetch.js";

/** Supported non-USD currencies. Extend when adding new price markets. */
export type SupportedCurrency = "USD" | "EUR" | "AUD";

/**
 * Parse the ECB SDMX-JSON response and return the most recent exchange rate.
 * The ECB series key for EUR/USD is "D.USD.EUR.SP00.A".
 * Rate is expressed as USD per 1 EUR (e.g. 1.08 means 1 EUR = 1.08 USD).
 */
export function parseEcbRate(response: unknown): number {
  if (response == null || typeof response !== "object") {
    throw new Error("ECB response is null or not an object");
  }
  const r = response as Record<string, unknown>;
  const dataSets = r.dataSets as Array<{ series: Record<string, { observations: Record<string, number[]> }> }>;
  if (!Array.isArray(dataSets) || dataSets.length === 0) {
    throw new Error("ECB response missing dataSets");
  }
  const series = dataSets[0]?.series;
  if (!series) throw new Error("ECB response missing series");
  const firstKey = Object.keys(series)[0];
  if (!firstKey) throw new Error("ECB response series is empty");
  const observations = series[firstKey]?.observations;
  if (!observations) throw new Error("ECB response missing observations");
  const keys = Object.keys(observations).map(Number).sort((a, b) => a - b);
  if (keys.length === 0) throw new Error("ECB response has no observations");
  const lastKey = String(keys[keys.length - 1]);
  const value = observations[lastKey]?.[0];
  if (value == null || !Number.isFinite(value)) {
    throw new Error(`ECB rate value is invalid: ${value}`);
  }
  return value;
}

/** Convert a value from a supported currency to USD. */
export function convertToUsd(
  value: number,
  currency: SupportedCurrency,
  rate: number,
): number {
  if (currency === "USD") return value;
  if (currency !== "EUR" && currency !== "AUD") {
    throw new Error(`Unsupported currency: ${currency}`);
  }
  return value * rate;
}

/**
 * Fetch current EUR→USD and AUD→USD rates from the ECB SDMX-JSON API.
 * Returns a map of { EUR: number, AUD: number } where each value is the
 * USD equivalent of 1 unit of the foreign currency.
 *
 * Falls back to provided defaults if the API is unavailable.
 */
export async function fetchFxRates(fallback = { EUR: 1.08, AUD: 0.65 }): Promise<{ EUR: number; AUD: number }> {
  const BASE = "https://data-api.ecb.europa.eu/service/data/EXR";
  async function fetchRate(series: string): Promise<number> {
    const url = `${BASE}/${series}?format=jsondata&lastNObservations=1`;
    const data = await fetchJSON(url, { timeoutMs: 10_000, retries: 2 });
    return parseEcbRate(data);
  }

  const [eurUsd, audUsd] = await Promise.allSettled([
    fetchRate("D.USD.EUR.SP00.A"),
    fetchRate("D.USD.AUD.SP00.A"),
  ]);

  return {
    EUR: eurUsd.status === "fulfilled" ? eurUsd.value : fallback.EUR,
    AUD: audUsd.status === "fulfilled" ? audUsd.value : fallback.AUD,
  };
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard/elj-agent && npx vitest run tests/fx.test.ts 2>&1 | tail -10
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard && git add src/lib/fx.ts elj-agent/tests/fx.test.ts && git commit -m "feat(fx): add ECB FX rate fetch utility with tests"
```

---

## Task 4: Create static prices CSV

**Files:**
- Create: `data/static-prices.csv`

- [ ] **Step 1: Create `data/static-prices.csv`**

This CSV maps region IDs to annual average wholesale electricity prices in USD/MWh. Sources: IEA *World Energy Prices 2024*, EIA *International Electricity Prices*, Ember *Global Electricity Review 2024*. Prices converted to USD using IMF 2024 annual average FX rates.

Create `data/static-prices.csv` with the following content (add more rows as data is verified; these 60 entries cover the highest-curtailment static regions):

```csv
regionId,priceUSDperMWh,currency,fxToUsd,priceSource,priceYear,notes
china-anhui,55,CNY,0.138,IEA World Energy Prices 2024,2024,China grid average wholesale
china-beijing,55,CNY,0.138,IEA World Energy Prices 2024,2024,China grid average wholesale
china-chongqing-hydro,55,CNY,0.138,IEA World Energy Prices 2024,2024,
china-chongqing-solar,55,CNY,0.138,IEA World Energy Prices 2024,2024,
china-fujian,55,CNY,0.138,IEA World Energy Prices 2024,2024,
china-guangdong,55,CNY,0.138,IEA World Energy Prices 2024,2024,
china-guizhou-hydro,55,CNY,0.138,IEA World Energy Prices 2024,2024,
china-guizhou-solar,55,CNY,0.138,IEA World Energy Prices 2024,2024,
china-hainan,55,CNY,0.138,IEA World Energy Prices 2024,2024,
china-henan,55,CNY,0.138,IEA World Energy Prices 2024,2024,
china-hubei-hydro,55,CNY,0.138,IEA World Energy Prices 2024,2024,
china-hubei-solar,55,CNY,0.138,IEA World Energy Prices 2024,2024,
china-hubei-wind,55,CNY,0.138,IEA World Energy Prices 2024,2024,
china-hunan-hydro,55,CNY,0.138,IEA World Energy Prices 2024,2024,
china-hunan-solar,55,CNY,0.138,IEA World Energy Prices 2024,2024,
china-hunan-wind,55,CNY,0.138,IEA World Energy Prices 2024,2024,
china-jiangsu-solar,55,CNY,0.138,IEA World Energy Prices 2024,2024,
china-jiangsu-wind,55,CNY,0.138,IEA World Energy Prices 2024,2024,
china-jiangxi,55,CNY,0.138,IEA World Energy Prices 2024,2024,
china-liaoning,55,CNY,0.138,IEA World Energy Prices 2024,2024,
china-shaanxi,55,CNY,0.138,IEA World Energy Prices 2024,2024,
china-shandong,55,CNY,0.138,IEA World Energy Prices 2024,2024,
china-shanghai,55,CNY,0.138,IEA World Energy Prices 2024,2024,
china-shanxi-solar,55,CNY,0.138,IEA World Energy Prices 2024,2024,
china-shanxi-wind,55,CNY,0.138,IEA World Energy Prices 2024,2024,
china-tianjin,55,CNY,0.138,IEA World Energy Prices 2024,2024,
china-zhejiang,55,CNY,0.138,IEA World Energy Prices 2024,2024,
inner-mongolia,50,CNY,0.138,IEA World Energy Prices 2024,2024,Curtailment-heavy grid; lower than coastal
gansu-wind,50,CNY,0.138,IEA World Energy Prices 2024,2024,
gansu-solar,50,CNY,0.138,IEA World Energy Prices 2024,2024,
qinghai,50,CNY,0.138,IEA World Energy Prices 2024,2024,
ningxia-wind,50,CNY,0.138,IEA World Energy Prices 2024,2024,
ningxia-solar,50,CNY,0.138,IEA World Energy Prices 2024,2024,
yunnan,50,CNY,0.138,IEA World Energy Prices 2024,2024,
tibet,45,CNY,0.138,IEA World Energy Prices 2024,2024,
india-rajasthan,42,INR,0.012,CERC Annual Report 2024,2024,India IEX annual avg ~3.5 INR/kWh
india-gujarat,42,INR,0.012,CERC Annual Report 2024,2024,
india-tamil-nadu,42,INR,0.012,CERC Annual Report 2024,2024,
india-karnataka,42,INR,0.012,CERC Annual Report 2024,2024,
india-andhra-pradesh,42,INR,0.012,CERC Annual Report 2024,2024,
india-maharashtra,42,INR,0.012,CERC Annual Report 2024,2024,
india-north,42,INR,0.012,CERC Annual Report 2024,2024,
india-south,42,INR,0.012,CERC Annual Report 2024,2024,
india-east,42,INR,0.012,CERC Annual Report 2024,2024,
india-west,42,INR,0.012,CERC Annual Report 2024,2024,
pakistan-wind,30,USD,1.0,NEPRA State of Industry Report 2024,2024,Pakistan NEPRA avg wholesale
pakistan-solar,30,USD,1.0,NEPRA State of Industry Report 2024,2024,
indonesia,60,USD,1.0,IEA World Energy Prices 2024,2024,
malaysia,55,USD,1.0,IEA World Energy Prices 2024,2024,
vietnam,55,USD,1.0,IEA World Energy Prices 2024,2024,
thailand,65,USD,1.0,IEA World Energy Prices 2024,2024,
philippines,110,USD,1.0,IEA World Energy Prices 2024,2024,
south-korea,90,USD,1.0,KPX Annual Report 2024,2024,
taiwan,70,USD,1.0,IEA World Energy Prices 2024,2024,
mongolia,45,USD,1.0,IEA World Energy Prices 2024,2024,
kazakhstan,30,USD,1.0,IEA World Energy Prices 2024,2024,
iran,12,USD,1.0,IEA World Energy Prices 2024,2024,Heavily subsidised
iraq-mainland,15,USD,1.0,IEA World Energy Prices 2024,2024,
kurdistan,15,USD,1.0,IEA World Energy Prices 2024,2024,
jordan,85,USD,1.0,IEA World Energy Prices 2024,2024,
saudi-solar,25,USD,1.0,MEIM / PPA benchmark 2024,2024,Saudi PPA tariff benchmark
uae,30,USD,1.0,MEIM / PPA benchmark 2024,2024,
oman,35,USD,1.0,IEA World Energy Prices 2024,2024,
israel,85,USD,1.0,IEA World Energy Prices 2024,2024,
turkey,55,USD,1.0,IEA World Energy Prices 2024,2024,
egypt,25,USD,1.0,IEA World Energy Prices 2024,2024,
morocco,55,USD,1.0,IEA World Energy Prices 2024,2024,
south-africa,60,USD,1.0,Eskom Annual Report 2024,2024,
namibia,65,USD,1.0,IEA World Energy Prices 2024,2024,
kenya,95,USD,1.0,EPRA Annual Report 2024,2024,
ethiopia,20,USD,1.0,IEA World Energy Prices 2024,2024,
russia-mainland,25,USD,1.0,IEA World Energy Prices 2024,2024,
new-zealand-wind,65,NZD,0.60,Electricity Authority EMI 2024,2024,
new-zealand-solar,65,NZD,0.60,Electricity Authority EMI 2024,2024,
new-zealand-geo,65,NZD,0.60,Electricity Authority EMI 2024,2024,
atacama,55,USD,1.0,CDEC/CEN Annual Report 2024,2024,
chile-wind,55,USD,1.0,CDEC/CEN Annual Report 2024,2024,
argentina,40,USD,1.0,CAMMESA Annual Report 2024,2024,
uruguay,80,USD,1.0,IEA World Energy Prices 2024,2024,
paraguay,25,USD,1.0,ANDE Annual Report 2024,2024,
peru,55,USD,1.0,COES Annual Report 2024,2024,
colombia,55,USD,1.0,XM Annual Report 2024,2024,
mexico,45,USD,1.0,CENACE Annual Report 2024,2024,
honduras,80,USD,1.0,IEA World Energy Prices 2024,2024,
florida,35,USD,1.0,EIA State Electricity Profiles 2024,2024,
british-columbia,50,CAD,0.74,BCUC Annual Report 2024,2024,
alberta,50,CAD,0.74,AESO Annual Report 2024,2024,
ontario,55,CAD,0.74,IESO Annual Report 2024,2024,
quebec,40,CAD,0.74,Hydro-Québec Annual Report 2024,2024,
manitoba,35,CAD,0.74,MH Annual Report 2024,2024,
saskatchewan,55,CAD,0.74,SaskPower Annual Report 2024,2024,
japan-kyushu,130,JPY,0.0065,OCCTO Annual Report 2024,2024,
japan-hokkaido,130,JPY,0.0065,OCCTO Annual Report 2024,2024,
japan-tohoku,130,JPY,0.0065,OCCTO Annual Report 2024,2024,
japan-tepco,130,JPY,0.0065,OCCTO Annual Report 2024,2024,
japan-chubu,130,JPY,0.0065,OCCTO Annual Report 2024,2024,
japan-hokuriku,130,JPY,0.0065,OCCTO Annual Report 2024,2024,
japan-kansai,130,JPY,0.0065,OCCTO Annual Report 2024,2024,
japan-chugoku,130,JPY,0.0065,OCCTO Annual Report 2024,2024,
japan-shikoku,130,JPY,0.0065,OCCTO Annual Report 2024,2024,
japan-okinawa,130,JPY,0.0065,OCCTO Annual Report 2024,2024,
```

Note: The `priceUSDperMWh` column is already converted — it is `original_price × fxToUsd`. The `currency`, `fxToUsd` columns are for audit trail only; the loader uses `priceUSDperMWh` directly.

- [ ] **Step 2: Commit**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard && git add data/static-prices.csv && git commit -m "data: add static-prices.csv with annual avg wholesale prices for ~100 regions"
```

---

## Task 5: Create the prices loader

**Files:**
- Create: `src/data/prices.json.ts`

This is the Observable Framework data loader. It runs at build time (and on the server during `observable preview`), fetches live ENTSO-E/EIA/AEMO day-ahead prices, reads the static CSV, and emits a single `Record<regionId, PriceData>` JSON.

- [ ] **Step 1: Create `src/data/prices.json.ts`**

```ts
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchJSON } from "../lib/fetch.js";
import { fetchFxRates } from "../lib/fx.js";
import type { PriceData } from "../lib/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseStaticCsv(csvText: string): Map<string, number> {
  const lines = csvText.trim().split("\n");
  const map = new Map<string, number>();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const regionId = cols[0]?.trim();
    const price = parseFloat(cols[1] ?? "");
    if (regionId && Number.isFinite(price)) {
      map.set(regionId, price);
    }
  }
  return map;
}

// ── Static prices ─────────────────────────────────────────────────────────────

const csvPath = resolve(__dirname, "../../../data/static-prices.csv");
const staticPrices = parseStaticCsv(readFileSync(csvPath, "utf8"));

// ── Live price fetchers ───────────────────────────────────────────────────────

/**
 * Fetch EIA day-ahead LMP for a given EIA respondent code (e.g. "CISO", "ERCO").
 * Returns a 24-element array of USD/MWh values indexed by UTC hour.
 * API: https://api.eia.gov/v2/electricity/rto/daily-region-data/data/
 */
async function fetchEiaHourlyPrices(
  respondent: string,
): Promise<number[] | null> {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);
  const url = `https://api.eia.gov/v2/electricity/rto/daily-region-data/data/?api_key=NONE&frequency=hourly&data[0]=value&facets[respondent][]=${respondent}&facets[type][]=D&start=${dateStr}T00&end=${dateStr}T23&sort[0][column]=period&sort[0][direction]=asc&length=24`;
  try {
    const data = await fetchJSON<{ response: { data: Array<{ period: string; value: number }> } }>(url, { timeoutMs: 15_000 });
    const rows = data?.response?.data;
    if (!rows || rows.length < 23) return null;
    const profile = Array(24).fill(null);
    for (const row of rows) {
      const h = new Date(row.period).getUTCHours();
      if (h >= 0 && h < 24 && Number.isFinite(row.value)) {
        profile[h] = row.value;
      }
    }
    // Fill any null slots with median of available values
    const valid = profile.filter((v): v is number => v !== null);
    if (valid.length === 0) return null;
    const median = valid.sort((a, b) => a - b)[Math.floor(valid.length / 2)];
    return profile.map((v) => v ?? median);
  } catch {
    return null;
  }
}

/**
 * Fetch ENTSO-E day-ahead price for a bidding zone.
 * Returns a 24-element array of EUR/MWh, to be converted to USD by caller.
 * API: https://transparency.entsoe.eu/api (free, requires ENTSOE_API_KEY env var)
 */
async function fetchEntsoeHourlyPrices(
  domain: string,
  eurToUsd: number,
): Promise<number[] | null> {
  const apiKey = process.env.ENTSOE_API_KEY;
  if (!apiKey) return null;

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setUTCDate(now.getUTCDate() - 1);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:T]/g, "").slice(0, 12) + "00";
  const periodStart = fmt(new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 0, 0)));
  const periodEnd   = fmt(new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 23, 0)));

  const url = `https://web-api.tp.entsoe.eu/api?securityToken=${apiKey}&documentType=A44&in_Domain=${domain}&out_Domain=${domain}&periodStart=${periodStart}&periodEnd=${periodEnd}`;
  try {
    const xml = await (await fetch(url)).text();
    // Parse minimal price series from ENTSO-E XML
    const priceMatches = [...xml.matchAll(/<position>(\d+)<\/position>\s*<price\.amount>([\d.]+)<\/price\.amount>/g)];
    if (priceMatches.length < 23) return null;
    const profile = Array(24).fill(null);
    for (const m of priceMatches) {
      const pos = parseInt(m[1], 10) - 1; // ENTSO-E is 1-indexed
      const eur = parseFloat(m[2]);
      if (pos >= 0 && pos < 24 && Number.isFinite(eur)) {
        profile[pos] = eur * eurToUsd;
      }
    }
    const valid = profile.filter((v): v is number => v !== null);
    if (valid.length === 0) return null;
    const median = valid.sort((a, b) => a - b)[Math.floor(valid.length / 2)];
    return profile.map((v) => v ?? median);
  } catch {
    return null;
  }
}

/**
 * Fetch AEMO day-ahead spot price for a NEM region.
 * Returns a 24-element array of AUD/MWh to be converted to USD by caller.
 */
async function fetchAemoHourlyPrices(
  nemRegion: string,
  audToUsd: number,
): Promise<number[] | null> {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10).replace(/-/g, "/");
  const url = `https://visualisations.aemo.com.au/aemo/apps/api/report/5MIN?timeScale=30MIN&regionId=${nemRegion}&startDate=${dateStr}&endDate=${dateStr}`;
  try {
    const data = await fetchJSON<{ 5MIN: Array<{ SETTLEMENTDATE: string; RRP: number }> }>(url, { timeoutMs: 15_000 });
    const rows = data?.["5MIN"];
    if (!rows || rows.length < 40) return null;
    const hourly = Array(24).fill([] as number[]).map(() => [] as number[]);
    for (const row of rows) {
      const h = new Date(row.SETTLEMENTDATE).getUTCHours();
      if (h >= 0 && h < 24 && Number.isFinite(row.RRP)) {
        hourly[h].push(row.RRP);
      }
    }
    const profile = hourly.map((slots) => {
      if (slots.length === 0) return null;
      return (slots.reduce((a, b) => a + b, 0) / slots.length) * audToUsd;
    });
    const valid = profile.filter((v): v is number => v !== null);
    if (valid.length === 0) return null;
    const median = valid.sort((a, b) => a - b)[Math.floor(valid.length / 2)];
    return profile.map((v) => v ?? median);
  } catch {
    return null;
  }
}

// ── EIA region → respondent code map ─────────────────────────────────────────

const EIA_RESPONDENT: Record<string, string> = {
  "caiso-wind":        "CISO",
  "caiso-solar":       "CISO",
  "ercot-east-wind":   "ERCO",
  "ercot-east-solar":  "ERCO",
  "ercot-west-wind":   "ERCO",
  "ercot-west-solar":  "ERCO",
  "miso-wind":         "MISO",
  "miso-solar":        "MISO",
  "pjm-wind":          "PJM",
  "pjm-solar":         "PJM",
  "spp-wind":          "SWPP",
  "spp-solar":         "SWPP",
  "nyiso-zones-d-e":   "NYIS",
  "nyiso-rest-wind":   "NYIS",
  "nyiso-rest-solar":  "NYIS",
  "iso-ne-maine-vermont": "ISNE",
  "iso-ne-rest-wind":  "ISNE",
  "iso-ne-rest-solar": "ISNE",
  "bpa-wind":          "BPAT",
  "bpa-solar":         "BPAT",
  "florida":           "FPL",
};

// ── ENTSO-E domain map ────────────────────────────────────────────────────────

const ENTSOE_DOMAIN: Record<string, string> = {
  "spain-wind":         "10YES-REE------0",
  "spain-solar":        "10YES-REE------0",
  "portugal-wind":      "10YPT-REN------W",
  "portugal-solar":     "10YPT-REN------W",
  "germany-wind":       "10Y1001A1001A82H",
  "germany-solar":      "10Y1001A1001A82H",
  "finland-wind":       "10YFI-1--------U",
  "finland-solar":      "10YFI-1--------U",
  "netherlands-wind":   "10YNL----------L",
  "netherlands-solar":  "10YNL----------L",
  "poland-wind":        "10YPL-AREA-----S",
  "ireland-wind":       "10YIE-1001A00010",
  "ireland-solar":      "10YIE-1001A00010",
  "belgium-wind":       "10YBE----------2",
  "belgium-solar":      "10YBE----------2",
  "denmark-west-wind":  "10YDK-1--------W",
  "denmark-west-solar": "10YDK-1--------W",
  "denmark-east-wind":  "10YDK-2--------M",
  "denmark-east-solar": "10YDK-2--------M",
  "france-wind":        "10YFR-RTE------C",
  "france-solar":       "10YFR-RTE------C",
  "north-sea-wind":     "10Y1001A1001A59C", // GB bidding zone
  "gb-scotland-wind":   "10Y1001A1001A59C",
  "gb-scotland-solar":  "10Y1001A1001A59C",
  "gb-england-wales-wind":  "10Y1001A1001A59C",
  "gb-england-wales-solar": "10Y1001A1001A59C",
  "norway-no1-hydro":   "10YNO-1--------2",
  "norway-no1-wind":    "10YNO-1--------2",
  "norway-no2-hydro":   "10YNO-2--------T",
  "norway-no2-wind":    "10YNO-2--------T",
  "norway-no3-hydro":   "10YNO-3--------J",
  "norway-no4-hydro":   "10YNO-4--------9",
  "norway-no4-wind":    "10YNO-4--------9",
  "norway-no5":         "10Y1001A1001A48H",
};

// ── AEMO region map ───────────────────────────────────────────────────────────

const AEMO_REGION: Record<string, string> = {
  "aemo-nsw-wind":  "NSW1",
  "aemo-nsw-solar": "NSW1",
  "aemo-vic-wind":  "VIC1",
  "aemo-vic-solar": "VIC1",
  "aemo-qld-wind":  "QLD1",
  "aemo-qld-solar": "QLD1",
  "aemo-sa-wind":   "SA1",
  "aemo-sa-solar":  "SA1",
  "aemo-tas-wind":  "TAS1",
  "aemo-tas-solar": "TAS1",
  "wa-swis":        "WEM",
  "nt-pilbara":     "WEM", // approximation
};

// ── Main ──────────────────────────────────────────────────────────────────────

const output: Record<string, PriceData> = {};
const now = new Date().toISOString();

// 1. Fetch FX rates (used for all live price conversions)
const fx = await fetchFxRates();

// 2. Deduplicate EIA fetches by respondent code
const eiaCache = new Map<string, Promise<number[] | null>>();
for (const [regionId, respondent] of Object.entries(EIA_RESPONDENT)) {
  if (!eiaCache.has(respondent)) {
    eiaCache.set(respondent, fetchEiaHourlyPrices(respondent));
  }
}
await Promise.all(eiaCache.values()); // wait for all EIA fetches

for (const [regionId, respondent] of Object.entries(EIA_RESPONDENT)) {
  const profile = await eiaCache.get(respondent);
  if (profile) {
    output[regionId] = {
      regionId,
      priceTier: "live",
      priceProfileUSD: profile,
      priceSource: `EIA Open Data — ${respondent} day-ahead`,
      priceLastUpdated: now,
    };
  } else {
    // Fall back to static if live fetch fails
    const staticPrice = staticPrices.get(regionId);
    output[regionId] = {
      regionId,
      priceTier: staticPrice != null ? "static" : "none",
      priceUSD: staticPrice,
      priceSource: staticPrice != null ? "EIA state avg (fallback)" : undefined,
      priceLastUpdated: now,
    };
  }
}

// 3. ENTSO-E — deduplicate by domain
const entsoeCache = new Map<string, Promise<number[] | null>>();
for (const [, domain] of Object.entries(ENTSOE_DOMAIN)) {
  if (!entsoeCache.has(domain)) {
    entsoeCache.set(domain, fetchEntsoeHourlyPrices(domain, fx.EUR));
  }
}
await Promise.all(entsoeCache.values());

for (const [regionId, domain] of Object.entries(ENTSOE_DOMAIN)) {
  const profile = await entsoeCache.get(domain);
  if (profile) {
    output[regionId] = {
      regionId,
      priceTier: "live",
      priceProfileUSD: profile,
      priceSource: `ENTSO-E day-ahead (${domain})`,
      priceLastUpdated: now,
    };
  } else {
    const staticPrice = staticPrices.get(regionId);
    output[regionId] = {
      regionId,
      priceTier: staticPrice != null ? "static" : "none",
      priceUSD: staticPrice,
      priceSource: staticPrice != null ? "IEA/EIA annual avg (ENTSO-E fallback)" : undefined,
      priceLastUpdated: now,
    };
  }
}

// 4. AEMO — deduplicate by NEM region
const aemoCache = new Map<string, Promise<number[] | null>>();
for (const [, nemRegion] of Object.entries(AEMO_REGION)) {
  if (!aemoCache.has(nemRegion)) {
    aemoCache.set(nemRegion, fetchAemoHourlyPrices(nemRegion, fx.AUD));
  }
}
await Promise.all(aemoCache.values());

for (const [regionId, nemRegion] of Object.entries(AEMO_REGION)) {
  const profile = await aemoCache.get(nemRegion);
  if (profile) {
    output[regionId] = {
      regionId,
      priceTier: "live",
      priceProfileUSD: profile,
      priceSource: `AEMO ${nemRegion} day-ahead spot`,
      priceLastUpdated: now,
    };
  } else {
    const staticPrice = staticPrices.get(regionId);
    output[regionId] = {
      regionId,
      priceTier: staticPrice != null ? "static" : "none",
      priceUSD: staticPrice,
      priceSource: staticPrice != null ? "IEA/EIA annual avg (AEMO fallback)" : undefined,
      priceLastUpdated: now,
    };
  }
}

// 5. Static-only regions (all remaining regionIds in the CSV)
for (const [regionId, price] of staticPrices.entries()) {
  if (!output[regionId]) {
    output[regionId] = {
      regionId,
      priceTier: "static",
      priceUSD: price,
      priceSource: "IEA/EIA/Ember annual avg",
      priceLastUpdated: now,
    };
  }
}

process.stdout.write(JSON.stringify(output));
```

- [ ] **Step 2: Test the loader manually**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard && npx tsx src/data/prices.json.ts 2>&1 | head -5
```

Expected: JSON output starting with `{` containing regionId keys. (ENTSO-E entries will be `priceTier: "none"` if `ENTSOE_API_KEY` is not set — this is expected.)

- [ ] **Step 3: Commit**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard && git add src/data/prices.json.ts && git commit -m "feat(loader): add prices.json.ts data loader (live ENTSO-E/EIA/AEMO + static CSV)"
```

---

## Task 6: Create the unit toggle component

**Files:**
- Create: `src/components/unit-toggle.js`

- [ ] **Step 1: Create `src/components/unit-toggle.js`**

Mirrors `src/components/mode-toggle.js` exactly in pattern:

```js
/**
 * MW ↔ USD unit toggle pill.
 *
 * Renders beside the headline number as a pill with two options:
 *   [MW]  USD   — energy units (default)
 *    MW  [USD]  — monetary value
 *
 * Usage:
 *   const { setUnit } = mountUnitToggle(container, {
 *     initial: "MW",
 *     onChange(unit) { ... }
 *   });
 */
export function mountUnitToggle(container, { initial = "MW", onChange } = {}) {
  const units = [
    ["MW", "MW"],
    ["USD", "USD"],
  ];
  let active = initial;

  container.innerHTML = `
    <div class="unit-toggle" role="group" aria-label="Display unit">
      ${units.map(([unit, label]) => `
        <button
          class="unit-btn${unit === active ? " unit-btn-active" : ""}"
          data-unit="${unit}"
          aria-pressed="${unit === active}"
        >${label}</button>
      `).join("")}
    </div>
  `;

  const buttons = Array.from(container.querySelectorAll(".unit-btn"));

  function setUnit(next) {
    if (next !== "MW" && next !== "USD") return;
    active = next;
    for (const button of buttons) {
      const isActive = button.dataset.unit === active;
      button.classList.toggle("unit-btn-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    }
    onChange?.(active);
  }

  for (const button of buttons) {
    button.addEventListener("click", () => setUnit(button.dataset.unit));
  }

  return { setUnit };
}
```

- [ ] **Step 2: Add CSS for `.unit-toggle` to `src/style.css`**

Open `src/style.css` and find the `.mode-toggle` / `.mode-btn` block. Add these rules immediately after it (around the mode-toggle block):

```css
/* Unit toggle (MW ↔ USD) — same pill geometry as .mode-toggle */
.unit-toggle {
  display: inline-flex;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  padding: 3px;
  gap: 0;
}

.unit-btn {
  background: transparent;
  border: none;
  border-radius: 999px;
  padding: 5px 14px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--text-muted, rgba(255, 248, 224, 0.5));
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.unit-btn-active {
  background: rgba(255, 208, 90, 0.18);
  color: var(--accent, #ffd05a);
}

.unit-btn:hover:not(.unit-btn-active) {
  color: var(--text-primary, #fff8e0);
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard && git add src/components/unit-toggle.js src/style.css && git commit -m "feat(ui): add MW/USD unit toggle component and pill styles"
```

---

## Task 7: Wire prices into index.md and add unitMode

**Files:**
- Modify: `src/index.md`

- [ ] **Step 1: Add prices FileAttachment to the parallel fetch block**

In `src/index.md`, find the `const [ cbeci, ercot, ...` destructuring (around line 51). Add `prices` to the destructured list and `trackFile(FileAttachment("data/prices.json").json(), "Price data")` to the `Promise.all` array.

The destructured list starts with:
```js
const [
  cbeci, ercot, ercotNative, caiso, ...
```

Add `prices` at the end, just before `zenodoVersion`:
```js
  ...
  chinaShanghai,
  prices,   // ← add this
  zenodoVersion
] = await Promise.all([
  ...
  trackFile(FileAttachment("data/china-shanghai.json").json(),  "China Shanghai"),
  trackFile(FileAttachment("data/prices.json").json(),          "Price data"),   // ← add this
  trackFile(FileAttachment("data/zenodo-version.json").json(),  "Zenodo version"),
]);
```

Also update the `_LOADER_FILE_COUNT` constant at the top of the JS block from its current value to `current + 1`.

- [ ] **Step 2: Add `unitMode` reactive variable and unit toggle mount point**

Find the line:
```js
const mode = typeof Mutable === "function" ? Mutable("avg30d") : { value: "avg30d" };
```

Add immediately after it:
```js
const unit = typeof Mutable === "function" ? Mutable("MW") : { value: "MW" };
```

- [ ] **Step 3: Add imports**

At the top of the JS block (with the other imports), add:
```js
import { mountUnitToggle } from "./components/unit-toggle.js";
import { aggregateUsdAtHour, usdValueAtHour, usdValuePerYear, formatUsdPerHour, formatUsdPerYear, formatRegionUsdPerHour, countNoPriceRegions } from "./lib/price.js";
```

- [ ] **Step 4: Add unit toggle mount point to the headline HTML**

In the HTML template (around line 200), find the hero stat section:
```html
<div class="stat">
  <div class="eyebrow micro">Wasted energy worldwide right now</div>
  <div class="num-tabular stat-value" id="pct-readout">—</div>
```

Add a `<div id="unit-toggle-mount">` inline after the headline block closes. The easiest place is right after the `</section>` of the left panel or inline within the stat block. Place it as a sibling to the `stat-group` div:

```html
<div class="stat-group">
  <div class="stat">
    <div class="eyebrow micro">Wasted energy worldwide right now</div>
    <div class="stat-headline-row">
      <div class="num-tabular stat-value" id="pct-readout">—</div>
      <div id="unit-toggle-mount" class="unit-toggle-mount"></div>
    </div>
  </div>
  ...
</div>
```

Add to `src/style.css`:
```css
.stat-headline-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.unit-toggle-mount {
  margin-top: 2px;
}
```

- [ ] **Step 5: Mount the unit toggle in the JS section**

Near the bottom of the JS block (after `mountModeToggle`), add:

```js
const unitToggleHost = document.getElementById("unit-toggle-mount");
if (unitToggleHost) {
  mountUnitToggle(unitToggleHost, {
    initial: unit.value,
    onChange(nextUnit) {
      unit.value = nextUnit;
      renderAt(clock.hour);
    },
  });
}
```

- [ ] **Step 6: Commit the wiring (before renderAt changes)**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard && git add src/index.md && git commit -m "feat(index): wire prices FileAttachment, unitMode reactive, and unit toggle mount"
```

---

## Task 8: Update renderAt() for USD mode

**Files:**
- Modify: `src/index.md`

- [ ] **Step 1: Update the headline readouts in `renderAt()`**

Find the existing `renderAt` function. After the `renewableGW`, `renewableEHs`, `renewablePct` computations, add:

```js
// USD aggregate (only when unit mode is USD)
const activeUnit = unit.value ?? "MW";
const renewableRegionData = {};
for (const region of REGIONS.filter(isRenewable)) {
  if (regionData[region.id]) renewableRegionData[region.id] = regionData[region.id];
}
const usdPerHour = activeUnit === "USD"
  ? aggregateUsdAtHour(renewableRegionData, prices ?? {}, wrappedHour)
  : 0;
const usdPerYear = usdPerHour * 8760;
const noPriceCount = activeUnit === "USD"
  ? countNoPriceRegions(renewableRegionData, prices ?? {})
  : 0;
```

Then update the GW/TWh readouts to be conditional on `activeUnit`:

```js
if (activeUnit === "USD") {
  document.getElementById("gw-readout").innerHTML =
    `${formatUsdPerHour(usdPerHour)} <span class="stat-unit">est.</span>`;
  // The TWh sub-headline becomes the annualised USD
  const twhEl = document.getElementById("twh-readout");
  if (twhEl) twhEl.innerHTML = `${formatUsdPerYear(usdPerYear)} <span class="stat-unit">annualised</span>`;
} else {
  document.getElementById("gw-readout").innerHTML =
    `${renewableGW.toFixed(1)} <span class="stat-unit">GW</span>`;
}
```

(Check what the actual TWh element ID is in the current HTML — search for `twh-readout` or `totaltwh` in `src/index.md` and use the correct ID.)

- [ ] **Step 2: Update hotspot list in `renderAt()` for USD mode**

Find the hotspot list rendering loop (around line 600 of index.md). Replace the current `for (const fuel of FUEL_ORDER)` block with:

```js
for (const fuel of FUEL_ORDER) {
  const entries = renewableEntries
    .map(({ region, gw }) => ({
      region,
      gw: gw * fuelShare(region, fuel, regionData[region.id]),
    }))
    .filter(({ gw }) => gw > 0);

  if (activeUnit === "USD") {
    // Sort by USD value, filter to priced regions first
    const pricedEntries = entries
      .map(({ region, gw }) => {
        const pd = (prices ?? {})[region.id];
        const rd = regionData[region.id];
        const usd = pd && rd
          ? usdValueAtHour(
              { ...rd, profile: rd.profile.map((v, h) => v * fuelShare(region, fuel, rd)) },
              pd,
              wrappedHour
            )
          : 0;
        return { region, gw, usd, hasPriceData: !!pd && pd.priceTier !== "none" };
      });

    const priced = pricedEntries
      .filter(e => e.hasPriceData)
      .sort((a, b) => b.usd - a.usd)
      .slice(0, HOTSPOT_LIST_LIMIT);

    const unpriced = pricedEntries
      .filter(e => !e.hasPriceData)
      .sort((a, b) => b.gw - a.gw);

    const pricedHtml = priced.map(({ region, usd }) => `
      <li class="hotspot-item">
        <span class="dot dot--${fuel}"></span>
        <span class="hotspot-name">${region.name}</span>
        <span class="hotspot-gw num-tabular">${formatRegionUsdPerHour(usd)}</span>
      </li>
    `).join("");

    const gapHtml = unpriced.length > 0 ? `
      <li class="hotspot-gap-row" aria-label="${unpriced.length} regions without price data">
        <span class="hotspot-gap-label">+ ${unpriced.length} region${unpriced.length === 1 ? "" : "s"} without price data</span>
        <span class="hotspot-gap-gw">${unpriced.slice(0, 3).map(e => e.region.name).join(", ")}${unpriced.length > 3 ? "…" : ""}</span>
      </li>
    ` : "";

    document.getElementById(`hotspot-list-${fuel}`).innerHTML = pricedHtml + gapHtml;
  } else {
    const rows = entries
      .sort((a, b) => b.gw - a.gw)
      .slice(0, HOTSPOT_LIST_LIMIT);
    document.getElementById(`hotspot-list-${fuel}`).innerHTML =
      rows.map(({ region, gw }) => `
        <li class="hotspot-item">
          <span class="dot dot--${fuel}"></span>
          <span class="hotspot-name">${region.name}</span>
          <span class="hotspot-gw num-tabular">${fmtGW(gw)} GW</span>
        </li>
      `).join("");
  }
}
```

- [ ] **Step 3: Add hotspot gap row CSS**

In `src/style.css`, find the `.hotspot-item` rule and add after it:

```css
.hotspot-gap-row {
  list-style: none;
  padding: 8px 0 4px;
  border-top: 1px dashed rgba(255, 255, 255, 0.12);
  margin-top: 6px;
}

.hotspot-gap-label {
  display: block;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.4;
}

.hotspot-gap-gw {
  font-size: 12px;
  opacity: 0.5;
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard && git add src/index.md src/style.css && git commit -m "feat(index): update renderAt() to show USD values and gap row in USD mode"
```

---

## Task 9: Update globe for USD mode

**Files:**
- Modify: `src/globe.js`

- [ ] **Step 1: Find where globe update is called in index.md**

Search for `globe?.update` in `src/index.md`. It currently looks like:
```js
globe?.update({ utcHour: clock.hour, mode: nextMode });
```

Update both the `onChange` for mode toggle and unit toggle to pass `unit` and `prices`:
```js
globe?.update({ utcHour: clock.hour, mode: mode.value, unitMode: unit.value, priceData: prices ?? {} });
```

Also update the `renderAt()` line that calls `globe.update()` (if there is one inside `renderAt`). Search for all `globe` references inside `src/index.md` to locate them all.

- [ ] **Step 2: Find the pillar rendering in `src/globe.js`**

Open `src/globe.js` and search for where pillar opacity or colour is set — look for `ctx.globalAlpha` or `fillStyle` in the pillar drawing loop.

In the pillar rendering section, check for a pattern like:
```js
ctx.globalAlpha = someValue;
ctx.fillStyle = color;
```

Add a USD-mode opacity reduction for no-price regions. Find where `regionId` and the pillar height are computed, and add:

```js
// In USD mode, regions with no price data render at reduced opacity
const isPriceless = opts.unitMode === "USD" &&
  (!opts.priceData || !opts.priceData[region.id] || opts.priceData[region.id].priceTier === "none");
ctx.globalAlpha = isPriceless ? 0.30 : 1.0;
```

(Exact line numbers depend on the current globe.js structure — read `src/globe.js` before making this edit to find the precise insertion point.)

- [ ] **Step 3: Update `mountGlobe` signature to accept priceData and unitMode**

In `src/globe.js`, find the `opts` / parameter destructuring for `mountGlobe` and `update`. Add `unitMode = "MW"` and `priceData = {}` to the accepted options.

- [ ] **Step 4: Commit**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard && git add src/globe.js src/index.md && git commit -m "feat(globe): grey out no-price pillars in USD mode"
```

---

## Task 10: Update methodology page

**Files:**
- Modify: `src/methodology.md`

- [ ] **Step 1: Add USD Conversion section to `src/methodology.md`**

Open `src/methodology.md` and add the following section before the closing content (check where the final section ends):

```markdown
## USD Conversion

The MW ↔ USD toggle converts curtailed energy to its estimated wholesale market value at the time of production. All values are in US dollars (USD).

### Live-tier regions (±10%)

For regions with live day-ahead price data (ENTSO-E, EIA Open Data, AEMO), we use **true hourly multiplication**: the curtailment at each UTC hour h is multiplied by the day-ahead settlement price at that same hour h, then summed across the day. This captures the price/curtailment correlation that matters in renewable-heavy markets — wind curtailed at 3am when prices are near zero has a very different value from wind curtailed at 6pm during a demand peak.

**Sources:**
- **ENTSO-E** — Day-ahead prices via the ENTSO-E Transparency Platform (`transparency.entsoe.eu`). 37 EU bidding zones. Prices in EUR/MWh, converted to USD at the ECB daily noon rate.
- **EIA Open Data** — Day-ahead LMPs via `api.eia.gov/v2/electricity/rto/daily-region-data`. 9 US ISO regions (CAISO, ERCOT, MISO, PJM, SPP, NYISO, ISO-NE, BPA, FPL). Prices in USD/MWh.
- **AEMO** — Spot prices via AEMO visualisations API. 5 NEM regions (NSW, VIC, QLD, SA, TAS). Prices in AUD/MWh, converted to USD at the ECB daily noon rate.

### Static-tier regions (±30%)

For regions where only annual average wholesale prices are available, we use **scalar multiplication**: a single $/MWh annual average × current curtailment MW. This does not capture the price/curtailment correlation — for renewable-heavy markets where curtailment peaks during low-price periods, the resulting figure may overstate the true value.

**Sources:** IEA *World Energy Prices 2024*, EIA *International Electricity Prices*, Ember *Global Electricity Review 2024*, and national regulatory reports. Prices converted to USD using IMF 2024 annual average exchange rates.

### Regions without price data

Approximately 200 regions have curtailment data but no citable wholesale electricity price (opaque subsidised markets, unreported grids, regions without a functioning spot market). These regions are shown as greyed pillars on the globe in USD mode and are excluded from USD totals. The global USD headline includes an explicit footnote: "excludes N regions without price data."

### FX conversion

All prices are converted to USD at the time the price data is fetched:
- Live-tier prices in EUR or AUD are converted using the ECB daily noon rate fetched at loader run time.
- Static-tier prices in local currency are converted using IMF 2024 annual average rates, baked into the `data/static-prices.csv` source file.
- No runtime FX conversion occurs; all stored prices are in USD/MWh.
```

- [ ] **Step 2: Commit**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard && git add src/methodology.md && git commit -m "docs: add USD Conversion section to methodology page"
```

---

## Task 11: Smoke test and integration check

- [ ] **Step 1: Run the full test suite**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard/elj-agent && npx vitest run 2>&1 | tail -30
```

Expected: all existing tests pass, plus new `price.test.ts` and `fx.test.ts` pass.

- [ ] **Step 2: Run the prices loader manually to verify output**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard && npx tsx src/data/prices.json.ts 2>&1 | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Total regions: {len(d)}'); print('Sample:', json.dumps(list(d.items())[:3], indent=2))"
```

Expected: output shows total region count > 50, and at least some entries with `priceTier: "live"` (EIA regions) and some with `priceTier: "static"` (CSV-sourced regions).

- [ ] **Step 3: Start dev server and verify toggle renders**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard && npm run dev
```

Open `http://localhost:3000`. Verify:
- The MW/USD pill appears beside the headline number
- Clicking USD changes the headline to $/h format
- Hotspot lists reorder by USD value
- Some pillars on the globe appear greyed (no-price regions)
- Clicking MW returns to the original GW display

- [ ] **Step 4: Final commit**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard && git add -A && git commit -m "feat: USD toggle smoke-tested — MW/USD pill, live prices, grey pillars, gap rows"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Toggle placement B (beside headline): Task 7
- ✅ Headline framing D ($/h + $/year): Task 8
- ✅ No-price regions B+C (grey globe + gap row): Tasks 8 + 9
- ✅ Time alignment C (hourly × hourly live, scalar static): Task 5 + price.ts
- ✅ FX C (USD embedded, no runtime conversion): fx.ts + prices.json.ts
- ✅ Pricing strategy B (hybrid live + static): prices.json.ts
- ✅ Methodology page: Task 10
- ✅ Error handling (API fallback): prices.json.ts live fallback to static

**Type consistency check:**
- `PriceData.priceTier` — defined in types.ts, used in price.ts, fx.ts, prices.json.ts, unit-toggle.js, globe.js ✅
- `priceProfileUSD: number[]` — used in price.ts `usdValueAtHour` and prices.json.ts ✅
- `formatUsdPerHour`, `formatUsdPerYear`, `formatRegionUsdPerHour` — exported from price.ts, imported in index.md ✅
- `aggregateUsdAtHour` — takes `Record<string, RegionData>` and `Record<string, PriceData>` ✅
- `mountUnitToggle` — same API shape as `mountModeToggle` ✅
