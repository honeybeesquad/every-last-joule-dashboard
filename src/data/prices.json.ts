import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchJSON } from "../lib/fetch.js";
import { fetchFxRates } from "../lib/fx.js";
import type { PriceData } from "../lib/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Static CSV parser ─────────────────────────────────────────────────────────

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

const csvPath = resolve(__dirname, "../../data/static-prices.csv");
const staticPrices = parseStaticCsv(readFileSync(csvPath, "utf8"));

// ── EIA Open Data ─────────────────────────────────────────────────────────────

async function fetchEiaHourlyPrices(respondent: string): Promise<number[] | null> {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);
  const url =
    `https://api.eia.gov/v2/electricity/rto/daily-region-data/data/` +
    `?frequency=hourly&data[0]=value` +
    `&facets[respondent][]=${respondent}&facets[type][]=D` +
    `&start=${dateStr}T00&end=${dateStr}T23` +
    `&sort[0][column]=period&sort[0][direction]=asc&length=24`;
  try {
    const data = await fetchJSON<{
      response: { data: Array<{ period: string; value: number }> };
    }>(url, { timeoutMs: 15_000 });
    const rows = data?.response?.data;
    if (!rows || rows.length < 20) return null;
    const profile: (number | null)[] = Array(24).fill(null);
    for (const row of rows) {
      const h = new Date(row.period).getUTCHours();
      if (h >= 0 && h < 24 && Number.isFinite(row.value)) {
        profile[h] = row.value;
      }
    }
    const valid = profile.filter((v): v is number => v !== null);
    if (valid.length < 20) return null;
    const sorted = [...valid].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return profile.map((v) => (v !== null && v > 0 ? v : median));
  } catch {
    return null;
  }
}

// ── ENTSO-E Day-Ahead Prices ──────────────────────────────────────────────────

async function fetchEntsoeHourlyPrices(domain: string, eurToUsd: number): Promise<number[] | null> {
  const apiKey = process.env.ENTSOE_API_KEY;
  if (!apiKey) return null;
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setUTCDate(now.getUTCDate() - 1);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:T]/g, "").slice(0, 12) + "00";
  const periodStart = fmt(
    new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 0, 0)),
  );
  const periodEnd = fmt(
    new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 23, 0)),
  );
  const url = `https://web-api.tp.entsoe.eu/api?securityToken=${apiKey}&documentType=A44&in_Domain=${domain}&out_Domain=${domain}&periodStart=${periodStart}&periodEnd=${periodEnd}`;
  try {
    const xml = await (await fetch(url, { signal: AbortSignal.timeout(15_000) })).text();
    const priceMatches = [
      ...xml.matchAll(/<position>(\d+)<\/position>\s*<price\.amount>(-?[\d.]+)<\/price\.amount>/g),
    ];
    if (priceMatches.length < 20) return null;
    const profile: (number | null)[] = Array(24).fill(null);
    for (const m of priceMatches) {
      const pos = parseInt(m[1], 10) - 1; // ENTSO-E is 1-indexed
      const eur = parseFloat(m[2]);
      if (pos >= 0 && pos < 24 && Number.isFinite(eur)) {
        profile[pos] = eur * eurToUsd;
      }
    }
    const valid = profile.filter((v): v is number => v !== null);
    if (valid.length < 20) return null;
    const sorted = [...valid].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return profile.map((v) => (v !== null ? v : median));
  } catch {
    return null;
  }
}

// ── AEMO Spot Prices ──────────────────────────────────────────────────────────

async function fetchAemoHourlyPrices(nemRegion: string, audToUsd: number): Promise<number[] | null> {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10).replace(/-/g, "/");
  const url = `https://visualisations.aemo.com.au/aemo/apps/api/report/5MIN?timeScale=30MIN&regionId=${nemRegion}&startDate=${dateStr}&endDate=${dateStr}`;
  try {
    const data = await fetchJSON<{
      "5MIN": Array<{ SETTLEMENTDATE: string; RRP: number }>;
    }>(url, { timeoutMs: 15_000 });
    const rows = data?.["5MIN"];
    if (!rows || rows.length < 40) return null;
    const hourly: number[][] = Array.from({ length: 24 }, () => []);
    for (const row of rows) {
      const h = new Date(row.SETTLEMENTDATE).getUTCHours();
      if (h >= 0 && h < 24 && Number.isFinite(row.RRP)) {
        hourly[h].push(row.RRP);
      }
    }
    const profile: (number | null)[] = hourly.map((slots) => {
      if (slots.length === 0) return null;
      return (slots.reduce((a, b) => a + b, 0) / slots.length) * audToUsd;
    });
    const valid = profile.filter((v): v is number => v !== null);
    if (valid.length < 20) return null;
    const sorted = [...valid].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return profile.map((v) => (v !== null && v >= 0 ? v : median));
  } catch {
    return null;
  }
}

// ── Region → market mappings ──────────────────────────────────────────────────

const EIA_RESPONDENT: Record<string, string> = {
  "caiso-wind":             "CISO",
  "caiso-solar":            "CISO",
  "ercot-east-wind":        "ERCO",
  "ercot-east-solar":       "ERCO",
  "ercot-west-wind":        "ERCO",
  "ercot-west-solar":       "ERCO",
  "miso-wind":              "MISO",
  "miso-solar":             "MISO",
  "pjm-wind":               "PJM",
  "pjm-solar":              "PJM",
  "spp-wind":               "SWPP",
  "spp-solar":              "SWPP",
  "nyiso-zones-d-e":        "NYIS",
  "nyiso-rest-wind":        "NYIS",
  "nyiso-rest-solar":       "NYIS",
  "iso-ne-maine-vermont":   "ISNE",
  "iso-ne-rest-wind":       "ISNE",
  "iso-ne-rest-solar":      "ISNE",
  "bpa-wind":               "BPAT",
  "bpa-solar":              "BPAT",
  "florida":                "FPL",
};

const ENTSOE_DOMAIN: Record<string, string> = {
  "spain-wind":             "10YES-REE------0",
  "spain-solar":            "10YES-REE------0",
  "portugal-wind":          "10YPT-REN------W",
  "portugal-solar":         "10YPT-REN------W",
  "germany-wind":           "10Y1001A1001A82H",
  "germany-solar":          "10Y1001A1001A82H",
  "finland-wind":           "10YFI-1--------U",
  "finland-solar":          "10YFI-1--------U",
  "netherlands-wind":       "10YNL----------L",
  "netherlands-solar":      "10YNL----------L",
  "ireland-wind":           "10YIE-1001A00010",
  "ireland-solar":          "10YIE-1001A00010",
  "belgium-wind":           "10YBE----------2",
  "belgium-solar":          "10YBE----------2",
  "denmark-west-wind":      "10YDK-1--------W",
  "denmark-west-solar":     "10YDK-1--------W",
  "denmark-east-wind":      "10YDK-2--------M",
  "denmark-east-solar":     "10YDK-2--------M",
  "france-wind":            "10YFR-RTE------C",
  "france-solar":           "10YFR-RTE------C",
  "gb-scotland-wind":       "10YGB----------A",
  "gb-scotland-solar":      "10YGB----------A",
  "gb-england-wales-wind":  "10YGB----------A",
  "gb-england-wales-solar": "10YGB----------A",
  "north-sea-wind":         "10YGB----------A",
  "norway-no1-hydro":       "10YNO-1--------2",
  "norway-no1-wind":        "10YNO-1--------2",
  "norway-no2-hydro":       "10YNO-2--------T",
  "norway-no2-wind":        "10YNO-2--------T",
  "norway-no3-hydro":       "10YNO-3--------J",
  "norway-no4-hydro":       "10YNO-4--------9",
  "norway-no4-wind":        "10YNO-4--------9",
  "norway-no5":             "10Y1001A1001A48H",
  "poland-wind":            "10YPL-AREA-----S",
};

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
};

// ── Helper: make PriceData with fallback ──────────────────────────────────────

function makePriceData(
  regionId: string,
  liveProfile: number[] | null,
  liveSource: string,
  now: string,
): PriceData {
  if (liveProfile) {
    return {
      regionId,
      priceTier: "live",
      priceProfileUSD: liveProfile,
      priceSource: liveSource,
      priceLastUpdated: now,
    };
  }
  const staticPrice = staticPrices.get(regionId);
  return {
    regionId,
    priceTier: staticPrice != null ? "static" : "none",
    priceUSD: staticPrice,
    priceSource: staticPrice != null ? `${liveSource} (unavailable — static fallback)` : undefined,
    priceLastUpdated: now,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const output: Record<string, PriceData> = {};
const now = new Date().toISOString();

// Fetch FX rates first
const fx = await fetchFxRates();

// EIA — deduplicate by respondent code
const eiaCache = new Map<string, Promise<number[] | null>>();
for (const respondent of new Set(Object.values(EIA_RESPONDENT))) {
  eiaCache.set(respondent, fetchEiaHourlyPrices(respondent));
}
await Promise.all(eiaCache.values());
for (const [regionId, respondent] of Object.entries(EIA_RESPONDENT)) {
  const profile = await eiaCache.get(respondent)!;
  output[regionId] = makePriceData(regionId, profile, `EIA — ${respondent}`, now);
}

// ENTSO-E — deduplicate by domain
const entsoeCache = new Map<string, Promise<number[] | null>>();
for (const domain of new Set(Object.values(ENTSOE_DOMAIN))) {
  entsoeCache.set(domain, fetchEntsoeHourlyPrices(domain, fx.EUR));
}
await Promise.all(entsoeCache.values());
for (const [regionId, domain] of Object.entries(ENTSOE_DOMAIN)) {
  const profile = await entsoeCache.get(domain)!;
  output[regionId] = makePriceData(regionId, profile, `ENTSO-E (${domain})`, now);
}

// AEMO — deduplicate by NEM region
const aemoCache = new Map<string, Promise<number[] | null>>();
for (const nemRegion of new Set(Object.values(AEMO_REGION))) {
  aemoCache.set(nemRegion, fetchAemoHourlyPrices(nemRegion, fx.AUD));
}
await Promise.all(aemoCache.values());
for (const [regionId, nemRegion] of Object.entries(AEMO_REGION)) {
  const profile = await aemoCache.get(nemRegion)!;
  output[regionId] = makePriceData(regionId, profile, `AEMO ${nemRegion}`, now);
}

// Static-only regions not covered by any live API
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
