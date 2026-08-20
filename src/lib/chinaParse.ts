// chinaParse.ts — parse Ember's China subnational generation monthly CSV into
// per-province / per-fuel annual-generation anchors for the dashboard's China
// regions.
//
// Source: https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/generation/outputs/release_chn_subnational_generation_monthly.csv
// (Ember "China Electricity Data", English, structured, machine-readable.)
//
// HONESTY NOTE: this CSV carries *generation*, not *curtailment*. It lets us
// refresh the China regions' annual energy anchor from a live-monthly source
// (replacing the hardcoded annual NEA anchor). The curtailment RATE
// (弃风率/弃光率) is still taken from the published NEA figure — it is NOT in
// this file. CRITICAL: refreshing the anchor does NOT promote the region. The
// region stays T3-modelled (typical shape scaled to a published anchor) with
// sourceProvenance "modelled-fallback" and sourceStatus "cached" — it is NOT
// "live" or "live-domestic-anchored", because no public live hourly Chinese
// curtailment feed exists (see docs/methodology/tier-classification-guide.md §5
// and PR #812's honesty contract). We do NOT claim live (T1a/T1b) curtailment.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { RegionData } from "./types.js";
import {
  buildTypicalWindRegion,
  buildTypicalSolarRegion,
  buildTypicalHydroRegion,
  buildTypicalMixedRegion,
} from "./typical-profiles.js";
import { applyUncertainty } from "./uncertainty.js";

export type Fuel = "wind" | "solar" | "hydro";

export interface ProvinceFuelAnnual {
  province: string;
  fuel: Fuel;
  /** Sum of the last `months` months of Generation (TWh), annualised. */
  annualTWh: number;
  /** The most recent month present in the data (YYYY-MM). */
  latestMonth: string;
  /** Number of monthly rows summed. */
  monthsCovered: number;
}

// Ember province name -> dashboard region id (the per-fuel suffix is appended).
// Mirrors the ids in src/lib/regions.ts (china-<province>-<fuel>).
export const PROVINCE_TO_REGION: Record<string, string> = {
  Anhui: "china-anhui",
  Beijing: "china-beijing",
  Chongqing: "china-chongqing",
  Fujian: "china-fujian",
  Gansu: "gansu",
  Guangdong: "china-guangdong",
  Guizhou: "china-guizhou",
  Hainan: "china-hainan",
  Hebei: "china-hebei",
  Heilongjiang: "china-heilongjiang",
  Henan: "china-henan",
  Hubei: "china-hubei",
  Hunan: "china-hunan",
  Jiangsu: "china-jiangsu",
  Jiangxi: "china-jiangxi",
  Jilin: "china-jilin",
  Liaoning: "china-liaoning",
  Shaanxi: "china-shaanxi",
  Shandong: "china-shandong",
  Shanghai: "china-shanghai",
  Shanxi: "china-shanxi",
  Tianjin: "china-tianjin",
  Zhejiang: "china-zhejiang",
  // Separate loader files (not china-<x>) — mapped so refresh can find them:
  Qinghai: "qinghai",
  Xinjiang: "xinjiang",
  "Inner Mongolia": "inner-mongolia",
  Ningxia: "ningxia",
  Sichuan: "sichuan",
  Yunnan: "yunnan",
  Guangxi: "guangxi",
  Tibet: "tibet",
};

const FUEL_MAP: Record<string, Fuel> = {
  Wind: "wind",
  Solar: "solar",
  Hydro: "hydro",
};

export function regionIdFor(province: string, fuel: Fuel): string {
  const base = PROVINCE_TO_REGION[province];
  if (!base) throw new Error(`Unknown Ember province: ${province}`);
  return `${base}-${fuel}`;
}

/** Parse the Ember monthly CSV text into rows (cheap, no external deps). */
export function parseEmberMonthlyCsv(text: string): Array<{
  province: string;
  fuel: Fuel;
  date: string; // YYYY-MM-01
  generationTWh: number;
}> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = lines[0].split(",");
  const idx = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`Ember CSV missing column: ${name}`);
    return i;
  };
  const pI = idx("Province");
  const fI = idx("Electricity source");
  const dI = idx("Date");
  const gI = idx("Generation (TWh)");
  const out: Array<{ province: string; fuel: Fuel; date: string; generationTWh: number }> = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const fuel = FUEL_MAP[cols[fI]];
    if (!fuel) continue; // skip aggregated/other sources
    const gen = Number(cols[gI]);
    if (!Number.isFinite(gen)) continue;
    out.push({ province: cols[pI], fuel, date: cols[dI].slice(0, 7), generationTWh: gen });
  }
  return out;
}

/**
 * Sum the most recent `months` of generation for a province+fuel and annualise
 * to a trailing-12-month total. Returns null if no rows match.
 */
export function latestAnnualGeneration(
  text: string,
  province: string,
  fuel: Fuel,
  months = 12,
): ProvinceFuelAnnual | null {
  const rows = parseEmberMonthlyCsv(text).filter(
    (r) => r.province === province && r.fuel === fuel,
  );
  if (rows.length === 0) return null;
  // Sort descending by date, take the most recent `months`.
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const window = rows.slice(0, months);
  const annualTWh = window.reduce((s, r) => s + r.generationTWh, 0);
  return {
    province,
    fuel,
    annualTWh: Math.round(annualTWh * 1000) / 1000,
    latestMonth: window[0].date,
    monthsCovered: window.length,
  };
}

/** Convenience: read + parse from a file path (used by the refresh script). */
export function latestAnnualGenerationFromFile(
  path: string,
  province: string,
  fuel: Fuel,
  months = 12,
): ProvinceFuelAnnual | null {
  return latestAnnualGeneration(readFileSync(path, "utf-8"), province, fuel, months);
}

/**
 * Read a curtailment anchor for a region id from the refreshed store
 * (data/china-anchors.json). Returns null if the store is absent or the region
 * is not present — callers should fall back to their hardcoded anchor so loader
 * behavior is unchanged when the store hasn't been generated yet.
 */
export function chinaAnchor(
  regionId: string,
  storePath = join(process.cwd(), "data", "china-anchors.json"),
): { annualTWh: number; latestMonth: string; source: string } | null {
  if (!existsSync(storePath)) return null;
  try {
    const store = JSON.parse(readFileSync(storePath, "utf-8")) as {
      anchors: Array<{ regionId: string; annualTWh: number; latestMonth: string; source: string }>;
    };
    const row = store.anchors.find((a) => a.regionId === regionId);
    return row ? { annualTWh: row.annualTWh, latestMonth: row.latestMonth, source: row.source } : null;
  } catch {
    return null;
  }
}

/**
 * Build a China RegionData that consumes the refreshed anchor store when
 * present, otherwise falls back to the loader's hardcoded (estimated) anchor.
 *
 * IMPORTANT — honesty contract (see docs/methodology/tier-classification-guide.md §5):
 * the anchor (data/china-anchors.json, produced by scripts/refresh-china.ts from
 * Ember's monthly generation × a published NEA curtailment rate) is a *published
 * annual* figure. The region still emits a modelled typical-shape profile, so it
 * stays T3-modelled with sourceProvenance "modelled-fallback" — it is NOT
 * promoted to live-domestic-anchored, and sourceStatus is "cached" (the anchor
 * is a committed, periodically-refreshed file, not a live fetch this build).
 * lastSuccessAt is derived from the anchor's latestMonth, never Date.now().
 * When the store is absent the loader's own hardcoded (estimated) anchor is used
 * unchanged.
 *
 * The only thing the store improves is the *freshness of the annual anchor*
 * (2026 trailing-12mo generation instead of the 2024 NEA press release) — a
 * genuine data-quality gain, but not a tier promotion.
 */
export function buildChinaRegionFromAnchor(
  regionId: string,
  fuel: "wind" | "solar" | "hydro",
  peakHourUtc: number,
  fallbackAnnualTWh: number,
  fallbackNote: string,
  storePath?: string,
): RegionData {
  const fallback = buildTypicalRegionByFuel(regionId, fuel, peakHourUtc, fallbackAnnualTWh, fallbackNote);
  const anchor = chinaAnchor(regionId, storePath);
  if (!anchor) return fallback;
  // Fresher anchor present -> rebuild with the refreshed annualTWh, but keep the
  // region honestly T3-modelled (typical shape, published anchor). The envelope is
  // recomputed by applyUncertainty so peakGW stays within [low, high].
  const annualTWh = anchor.annualTWh;
  const refreshed = buildTypicalRegionByFuel(regionId, fuel, peakHourUtc, annualTWh, anchor.source);
  const enriched: RegionData = {
    ...refreshed,
    regionId,
    latestProfile: null,
    totalTWh: (annualTWh * 30) / 365,
    peakGW: Math.max(...refreshed.profile),
    lastUpdated: anchor.latestMonth,
    lastSuccessAt: new Date(`${anchor.latestMonth}-01T00:00:00.000Z`).toISOString(),
    sourceProvenance: "modelled-fallback",
    sourceStatus: "cached",
    sourceNote: anchor.source,
  };
  return applyUncertainty(enriched, { regionTier: "estimated", profileKind: fuel === "hydro" ? "hydro-seasonal" : fuel });
}

function buildTypicalRegionByFuel(
  regionId: string,
  fuel: "wind" | "solar" | "hydro",
  peakHourUtc: number,
  annualTWh: number,
  note: string,
): RegionData {
  if (fuel === "wind") return buildTypicalWindRegion(regionId, peakHourUtc, annualTWh, note);
  if (fuel === "solar") return buildTypicalSolarRegion(regionId, peakHourUtc, annualTWh, note);
  return buildTypicalHydroRegion(regionId, annualTWh, note);
}

/**
 * Build a China *mixed* (wind+solar combined) RegionData that consumes the
 * refreshed anchor store when present, otherwise falls back to the loader's
 * hardcoded typical-shape mixed anchor. Mirrors buildChinaRegionFromAnchor but
 * combines the per-fuel wind + solar anchors into a single profile so it can
 * back a `kind: "mixed"` region.
 *
 * Honesty contract: identical to buildChinaRegionFromAnchor — T3-modelled,
 * sourceStatus "cached", sourceProvenance "modelled-fallback". No live
 * promotion. When either per-fuel anchor is missing, the loader's hardcoded
 * (estimated) mixed anchor is used unchanged.
 */
export function buildChinaMixedRegionFromAnchors(
  regionId: string,
  fuelShare: { wind: number; solar: number },
  fallbackAnnualTWh: number,
  fallbackNote: string,
  solarPeakHourUtc = 7,
  windPeakHourUtc = 15,
  storePath?: string,
): RegionData {
  const fallback = buildTypicalMixedRegion(
    regionId, fallbackAnnualTWh, fuelShare, fallbackNote, "2024", solarPeakHourUtc, windPeakHourUtc,
  );
  const windAnchor = chinaAnchor(`${regionId}-wind`, storePath);
  const solarAnchor = chinaAnchor(`${regionId}-solar`, storePath);
  if (!windAnchor || !solarAnchor) return fallback;

  const wind = buildChinaRegionFromAnchor(`${regionId}-wind`, "wind", windPeakHourUtc, fallbackAnnualTWh * (fuelShare.wind ?? 0), fallbackNote, storePath);
  const solar = buildChinaRegionFromAnchor(`${regionId}-solar`, "solar", solarPeakHourUtc, fallbackAnnualTWh * (fuelShare.solar ?? 0), fallbackNote, storePath);
  const profile = wind.profile.map((v, h) => v + solar.profile[h]);
  const latestMonth = windAnchor.latestMonth >= solarAnchor.latestMonth ? windAnchor.latestMonth : solarAnchor.latestMonth;
  const source = `Ember China subnational generation (trailing 12mo) × NEA 2024 curtailment rate — combined wind+solar anchor`;
  const base: RegionData = {
    regionId,
    profile,
    latestProfile: null,
    totalTWh: wind.totalTWh + solar.totalTWh,
    peakGW: Math.max(...profile),
    lastUpdated: latestMonth,
    lastSuccessAt: new Date(`${latestMonth}-01T00:00:00.000Z`).toISOString(),
    sourceProvenance: "modelled-fallback",
    sourceStatus: "cached",
    sourceNote: `${source}; combined ${wind.totalTWh.toFixed(4)} (wind) + ${solar.totalTWh.toFixed(4)} (solar) TWh/30d`,
    fuelShare,
  };
  return applyUncertainty(base, { regionTier: "estimated", profileKind: "mixed" });
}
