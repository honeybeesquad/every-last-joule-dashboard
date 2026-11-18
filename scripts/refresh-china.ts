// refresh-china.ts — ingest Ember's China subnational monthly generation CSV and
// write a refreshed per-region curtailment anchor store (china-anchors.json).
//
// This is the "scraper that updates the database" the user asked for. It does
// NOT touch the 27 per-province loaders directly; it produces china-anchors.json,
// which the loaders can consume via chinaAnchor() (see src/lib/chinaParse.ts).
//
// HONESTY: Ember CSV = generation, not curtailment. We annualise the trailing
// 12 months of generation per province+fuel, then apply a trailing-12-month
// curtailment rate computed from the monitoring centre's published provincial
// utilisation bulletins (data/china-curtailment-bulletins.csv) — never an
// invented rate (see ttmRate below). The store
// (china-anchors.json) refreshes the regions' ANNUAL ANCHOR only. It does NOT
// promote them: a region that consumes an anchor stays T3-modelled with
// sourceProvenance "modelled-fallback" and sourceStatus "cached" (see
// src/lib/chinaParse.ts + tier-classification-guide.md §5). No "live" / T1b
// claim is made — no public live hourly Chinese curtailment feed exists.

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  parseEmberMonthlyCsv,
  regionIdFor,
  type Fuel,
} from "../src/lib/chinaParse.js";
import { parseDelimitedRows } from "../src/lib/csv.js";

const DEFAULT_CSV_URL =
  "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/generation/outputs/release_chn_subnational_generation_monthly.csv";
const OUT_PATH = join(process.cwd(), "data", "china-anchors.json");

// ---------------------------------------------------------------------------
// Curtailment rates: trailing 12 months from the national monitoring centre's
// monthly bulletins (各省级区域新能源并网消纳情况).
//
// Source: 全国新能源消纳监测预警中心, published since late 2025 as 电力行业规划研究与
// 监测预警中心. Every bulletin used here is transcribed, with its repost URL and
// table-image URL, in data/china-curtailment-bulletins.csv (see STATUS.md). Each bulletin gives wind and solar
// UTILISATION (利用率) by province for the month and year to date; the 2026
// bulletins give year to date only.
//
// DEFINITION: since 国能发电力〔2024〕44号 the bulletin counts only system-caused
// limits: U = (gen + special-cause limited) / (gen + special-cause limited +
// system-cause limited). Curtailment for other reasons is excluded, so these
// rates are a floor on total curtailment, not total curtailment.
//
// METHOD (trailing 12 months, TTM): the latest YTD table (2026-01..03) plus the
// prior full year (2025) minus the prior year's same-month YTD (2025-01..03)
// covers exactly the 12 months to the latest bulletin. Utilisation is not
// additive, so each window is converted to curtailed energy using Ember's
// monthly generation for that province+fuel and window:
//   C_w = G_w × (1 − U_w) / U_w
//   C = C_fullYear + C_latestYtd − C_priorSameYtd   (same for G)
//   rate = C / (G + C)          (share of potential output curtailed)
// The anchor stays annualTWh = Ember trailing-12mo generation × rate, the same
// formula as before; only the rate source changes. Note gen × rate slightly
// understates C (C = gen × rate / (1 − rate)); that is unchanged from the 2024
// method and recorded as a follow-up, not silently fixed here.
//
// HONESTY: no rate is invented. A province gets an anchor only if it is in
// WIRED_PROVINCES (the provinces whose loaders already consume the store) AND
// has the three bulletin windows. 蒙西 (Mengxi) is the curtailing grid the
// inner-mongolia regions represent; Ember's generation row is all of Inner
// Mongolia (incl. 蒙东), so that anchor is an upper bound, as before.
// ---------------------------------------------------------------------------

const BULLETIN_PATH = join(process.cwd(), "data", "china-curtailment-bulletins.csv");

/** Ember province name -> bulletin province label (province_zh column). */
export const WIRED_PROVINCES: Record<string, string> = {
  Xinjiang: "新疆",
  Qinghai: "青海",
  Yunnan: "云南",
  Tibet: "西藏", // rate published; Ember has no Tibet row, so no anchor is produced
  Shandong: "山东",
  Guangdong: "广东",
  Fujian: "福建",
  Zhejiang: "浙江",
  Jiangxi: "江西",
  Gansu: "甘肃",
  "Inner Mongolia": "蒙西",
  Ningxia: "宁夏",
  Hebei: "河北",
  Shaanxi: "陕西",
  Henan: "河南",
  Hubei: "湖北",
  Hunan: "湖南",
  Shanxi: "山西",
  Liaoning: "辽宁",
  Jilin: "吉林",
  Heilongjiang: "黑龙江",
  Jiangsu: "江苏",
  Anhui: "安徽",
};

/**
 * Floor for provinces whose published utilisation is 100.0% over the window.
 * Kept from the 2024 method (0.05%) so the typical-shape profile is not zero-area;
 * it is applied only when the computed rate is below it, and the source string
 * says so.
 */
export const RATE_FLOOR = 0.0005;

export interface BulletinRow {
  provinceZh: string;
  period: string; // YYYY-MM of the bulletin
  basis: "monthly" | "ytd";
  wind: number | null; // utilisation, percent
  solar: number | null;
}

export function parseBulletinCsv(text: string): BulletinRow[] {
  return parseDelimitedRows(text).map((r) => ({
    provinceZh: r.province_zh,
    period: r.period,
    basis: r.basis as "monthly" | "ytd",
    wind: r.wind_utilisation_pct === "" ? null : Number(r.wind_utilisation_pct),
    solar: r.solar_utilisation_pct === "" ? null : Number(r.solar_utilisation_pct),
  }));
}

export interface TtmRate {
  rate: number; // fraction of potential output curtailed, before any floor
  windowStart: string; // YYYY-MM
  windowEnd: string; // YYYY-MM
  monthsCovered: number;
  /** YYYY-MM periods of the bulletin tables used. */
  tables: string[];
}

function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

/** Ember generation summed over [from, to] inclusive (YYYY-MM); null if any month is missing. */
function genOver(monthly: Map<string, number>, from: string, to: string): number | null {
  let sum = 0;
  for (let ym = from; ym <= to; ym = addMonths(ym, 1)) {
    const g = monthly.get(ym);
    if (g === undefined) return null;
    sum += g;
  }
  return sum;
}

/**
 * Trailing-12-month curtailment rate for one province+fuel from the bulletins,
 * weighted by Ember monthly generation. Returns null when a needed table or
 * generation month is missing.
 */
export function ttmRate(
  bulletins: BulletinRow[],
  provinceZh: string,
  fuel: "wind" | "solar",
  emberMonthly: Map<string, number>,
): TtmRate | null {
  const ytd = bulletins.filter((b) => b.provinceZh === provinceZh && b.basis === "ytd" && b[fuel] !== null);
  if (ytd.length === 0) return null;
  const latest = ytd.map((b) => b.period).sort().at(-1)!;
  const [ly, lm] = latest.split("-");
  const util = (period: string) => ytd.find((b) => b.period === period)?.[fuel] ?? null;
  const curtailed = (u: number, g: number) => (g * (100 - u)) / u;

  const uLatest = util(latest);
  const gLatest = genOver(emberMonthly, `${ly}-01`, latest);
  if (uLatest === null || gLatest === null) return null;

  if (lm === "12") {
    return { rate: 1 - uLatest / 100, windowStart: `${ly}-01`, windowEnd: latest, monthsCovered: 12, tables: [latest] };
  }
  const prevYear = String(Number(ly) - 1);
  const fullYear = `${prevYear}-12`;
  const priorSame = `${prevYear}-${lm}`;
  const uFull = util(fullYear);
  const uPrior = util(priorSame);
  const gFull = genOver(emberMonthly, `${prevYear}-01`, fullYear);
  const gPrior = genOver(emberMonthly, `${prevYear}-01`, priorSame);
  if (uFull === null || uPrior === null || gFull === null || gPrior === null) return null;

  const G = gFull + gLatest - gPrior;
  const C = Math.max(0, curtailed(uFull, gFull) + curtailed(uLatest, gLatest) - curtailed(uPrior, gPrior));
  if (G <= 0) return null;
  return {
    rate: C / (G + C),
    windowStart: addMonths(priorSame, 1),
    windowEnd: latest,
    monthsCovered: 12,
    tables: [priorSame, fullYear, latest],
  };
}

interface AnchorRow {
  regionId: string;
  fuel: Fuel;
  annualGenerationTWh: number;
  curtailmentRate: number;
  annualTWh: number; // generation * rate
  latestMonth: string;
  rateWindow: string; // YYYY-MM..YYYY-MM of the bulletin window behind the rate
  rateMonthsCovered: number;
  source: string;
}

export function buildAnchors(csvText: string, bulletinText: string): AnchorRow[] {
  const rows = parseEmberMonthlyCsv(csvText);
  const bulletins = parseBulletinCsv(bulletinText);
  // group by province+fuel, sort desc, take trailing 12 months
  const byKey = new Map<string, ReturnType<typeof parseEmberMonthlyCsv>>();
  for (const r of rows) {
    const k = `${r.province}|${r.fuel}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(r);
  }
  const out: AnchorRow[] = [];
  for (const [k, list] of byKey) {
    const [province, fuel] = k.split("|") as [string, Fuel];
    if (fuel === "hydro") continue;
    const provinceZh = WIRED_PROVINCES[province];
    if (!provinceZh) continue; // loader does not consume the store -> no anchor
    const monthly = new Map(list.map((r) => [r.date, r.generationTWh]));
    const ttm = ttmRate(bulletins, provinceZh, fuel, monthly);
    if (!ttm) continue; // no bulletin rate for this window -> skip, never invent
    const floored = ttm.rate < RATE_FLOOR;
    const rate = Math.round(Math.max(ttm.rate, RATE_FLOOR) * 10000) / 10000;
    list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const window = list.slice(0, 12);
    const annualGen = window.reduce((s, r) => s + r.generationTWh, 0);
    let regionId: string;
    try {
      regionId = regionIdFor(province, fuel);
    } catch {
      continue;
    }
    const rateText = floored
      ? `${(RATE_FLOOR * 100).toFixed(2)}% floor (published utilisation ~100%)`
      : `${(rate * 100).toFixed(1)}%`;
    out.push({
      regionId,
      fuel,
      annualGenerationTWh: Math.round(annualGen * 1000) / 1000,
      curtailmentRate: rate,
      annualTWh: Math.round(annualGen * rate * 1000) / 1000,
      latestMonth: window[0].date,
      rateWindow: `${ttm.windowStart}..${ttm.windowEnd}`,
      rateMonthsCovered: ttm.monthsCovered,
      source: `Ember China subnational generation ${window[0].date} (trailing 12mo) × monitoring-centre curtailment rate ${rateText} (${provinceZh} ${fuel}, trailing 12 months ${ttm.windowStart}..${ttm.windowEnd} from published utilisation; system-caused limits only, 国能发电力〔2024〕44号)`,
    });
  }
  return out;
}

async function fetchCsv(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  return res.text();
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const csvArg = args.find((a) => a.startsWith("--csv="));
  const outArg = args.find((a) => a.startsWith("--out="));
  const outPath = outArg ? outArg.split("=")[1] : OUT_PATH;

  const csvText = csvArg
    ? readFileSync(csvArg.replace("--csv=", ""), "utf-8")
    : await fetchCsv(DEFAULT_CSV_URL);

  const bulletinArg = args.find((a) => a.startsWith("--bulletins="));
  const bulletinText = readFileSync(bulletinArg ? bulletinArg.replace("--bulletins=", "") : BULLETIN_PATH, "utf-8");
  const anchors = buildAnchors(csvText, bulletinText);
  const payload = {
    generatedAt: new Date().toISOString(),
    source: DEFAULT_CSV_URL,
    rateSource: "data/china-curtailment-bulletins.csv",
    anchors,
  };

  if (dryRun) {
    const prev = existsSync(outPath)
      ? (JSON.parse(readFileSync(outPath, "utf-8")).anchors as AnchorRow[])
      : [];
    const prevMap = new Map(prev.map((a) => [a.regionId, a.annualTWh]));
    console.log(`DRY-RUN: ${anchors.length} region anchors computed.`);
    for (const a of anchors) {
      const before = prevMap.get(a.regionId);
      const delta = before === undefined ? "NEW" : `${(a.annualTWh - before >= 0 ? "+" : "")}${(a.annualTWh - before).toFixed(3)}`;
      console.log(`  ${a.regionId.padEnd(28)} ${a.annualTWh.toFixed(3)} TWh  (${delta})  ${a.latestMonth}`);
    }
    return;
  }

  writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n");
  console.log(`Wrote ${anchors.length} region anchors to ${outPath}`);
}


// Guard: only run main() when invoked directly (not when imported by a test).
// Without this, importing buildAnchors in a test would trigger a live fetch +
// writeFileSync of the tracked data/china-anchors.json at import time.
import { pathToFileURL } from "url";
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error("refresh-china failed:", err);
    process.exit(1);
  });
}
