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
// The anchor is the curtailed energy that goes with Ember's trailing-12mo
// generation at that rate: annualTWh = generation × rate / (1 − rate). Because
// rate is curtailed / (generation + curtailed), this is exact; the older
// generation × rate understated curtailment by a factor of (1 − rate)
// (changed 2026-11-19, signed off by Simon). Special-cause limits sit in the
// bulletin's numerator and cannot be separated, so the result is still a floor.
//
// HONESTY: no rate is invented. A province gets an anchor only if it is in
// WIRED_PROVINCES (the provinces whose loaders already consume the store) AND
// has the three bulletin windows. Inner Mongolia is reported as two grids,
// 蒙西 (Mengxi) and 蒙东 (Mengdong), while Ember has one provincial row. No
// published by-fuel generation split exists for a trailing year, and it is not
// settled whether the centre's 蒙西 covers the Inner Mongolia Power Group dispatch
// area or all of geographic western Inner Mongolia (see
// docs/research/2026-11-18-inner-mongolia-mengxi-mengdong-split.md). So the 蒙西
// rate is applied to whole-province generation, and RATE_SCOPE_NOTE says so.
// Splitting would give 16.8 TWh/yr (IMPG-area shares) to 18.6 (geographic) for
// wind against 20.5 unsplit (2026-11-19 figures).
// ---------------------------------------------------------------------------

const BULLETIN_PATH = join(process.cwd(), "data", "china-curtailment-bulletins.csv");

/**
 * Ember province name -> bulletin province label (province_zh column), for exactly
 * the provinces whose loaders consume data/china-anchors.json. buildAnchors throws
 * if any of these does not get a wind AND a solar anchor, so a region can never
 * silently lose its anchor and fall back to its hardcoded estimate.
 */
export const WIRED_PROVINCES: Record<string, string> = {
  Xinjiang: "新疆",
  Qinghai: "青海",
  Yunnan: "云南",
  Shandong: "山东",
  Guangdong: "广东",
  Fujian: "福建",
  Zhejiang: "浙江",
  Jiangxi: "江西",
  Gansu: "甘肃",
  "Inner Mongolia": "蒙西", // Mengxi rate on whole-province generation: see RATE_SCOPE_NOTE
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
 * Appended to the anchor's served source note where the bulletin rate covers only
 * part of the province that Ember's generation row covers.
 */
export const RATE_SCOPE_NOTE: Record<string, string> = {
  "Inner Mongolia": "; the rate is 蒙西 (Mengxi)-only and the generation is whole-province, including Mengdong",
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

function parseUtilisation(raw: string, where: string): number | null {
  if (raw === "") return null; // illegible / not published: explicit gap
  if (!/^\d{1,3}(\.\d+)?$/.test(raw)) throw new Error(`bulletin CSV ${where}: utilisation "${raw}" is not a plain percentage (use digits only, or leave blank)`);
  const v = Number(raw);
  if (!(v > 0 && v <= 100)) throw new Error(`bulletin CSV ${where}: utilisation ${v} is outside (0, 100]`);
  return v;
}

/** Parse the committed bulletin CSV. Throws on any malformed row rather than letting NaN through. */
export function parseBulletinCsv(text: string): BulletinRow[] {
  const seen = new Map<string, number>();
  return parseDelimitedRows(text).map((r, i) => {
    const where = `row ${i + 2} (${r.province_zh} ${r.period} ${r.basis})`;
    if (!r.province_zh) throw new Error(`bulletin CSV ${where}: missing province_zh`);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(r.period ?? "")) throw new Error(`bulletin CSV ${where}: period must be YYYY-MM`);
    if (r.basis !== "monthly" && r.basis !== "ytd") throw new Error(`bulletin CSV ${where}: basis must be "monthly" or "ytd"`);
    const key = `${r.province_zh}|${r.period}|${r.basis}`;
    if (seen.has(key)) throw new Error(`bulletin CSV ${where}: duplicates row ${seen.get(key)} (edit the existing row instead of appending a correction)`);
    seen.set(key, i + 2);
    return {
      provinceZh: r.province_zh,
      period: r.period,
      basis: r.basis,
      wind: parseUtilisation(r.wind_utilisation_pct ?? "", `${where} wind`),
      solar: parseUtilisation(r.solar_utilisation_pct ?? "", `${where} solar`),
    };
  });
}

/**
 * The window end for every rate: the latest period that has a year-to-date
 * table. All provinces and fuels share it, so a gap in one series can never move
 * that series onto a different window from the rest.
 */
export function latestYtdPeriod(bulletins: BulletinRow[]): string {
  const periods = bulletins.filter((b) => b.basis === "ytd").map((b) => b.period).sort();
  if (periods.length === 0) throw new Error("bulletin CSV has no year-to-date rows");
  return periods.at(-1)!;
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

export type TtmResult = ({ ok: true } & TtmRate) | { ok: false; reason: string };

/**
 * Trailing-12-month curtailment rate for one province+fuel, ending at `latest`
 * (the shared window end from latestYtdPeriod), weighted by Ember monthly
 * generation. Never falls back to another window: if a needed table cell or
 * generation month is missing it returns { ok: false, reason }.
 */
export function ttmRate(
  bulletins: BulletinRow[],
  provinceZh: string,
  fuel: "wind" | "solar",
  emberMonthly: Map<string, number>,
  latest: string,
): TtmResult {
  const [ly, lm] = latest.split("-");
  const util = (period: string): number | null =>
    bulletins.find((b) => b.provinceZh === provinceZh && b.basis === "ytd" && b.period === period)?.[fuel] ?? null;
  const curtailed = (u: number, g: number) => (g * (100 - u)) / u;
  const need = (period: string): number | { ok: false; reason: string } => {
    const u = util(period);
    return u === null ? { ok: false, reason: `${provinceZh} ${fuel}: no year-to-date utilisation for ${period}` } : u;
  };
  const gen = (from: string, to: string): number | { ok: false; reason: string } => {
    const g = genOver(emberMonthly, from, to);
    return g === null ? { ok: false, reason: `${provinceZh} ${fuel}: Ember generation missing in ${from}..${to}` } : g;
  };

  const uLatest = need(latest);
  if (typeof uLatest !== "number") return uLatest;
  const gLatest = gen(`${ly}-01`, latest);
  if (typeof gLatest !== "number") return gLatest;

  if (lm === "12") {
    return { ok: true, rate: 1 - uLatest / 100, windowStart: `${ly}-01`, windowEnd: latest, monthsCovered: 12, tables: [latest] };
  }
  const prevYear = String(Number(ly) - 1);
  const fullYear = `${prevYear}-12`;
  const priorSame = `${prevYear}-${lm}`;
  const uFull = need(fullYear);
  if (typeof uFull !== "number") return uFull;
  const uPrior = need(priorSame);
  if (typeof uPrior !== "number") return uPrior;
  const gFull = gen(`${prevYear}-01`, fullYear);
  if (typeof gFull !== "number") return gFull;
  const gPrior = gen(`${prevYear}-01`, priorSame);
  if (typeof gPrior !== "number") return gPrior;

  const G = gFull + gLatest - gPrior;
  if (G <= 0) return { ok: false, reason: `${provinceZh} ${fuel}: non-positive generation over the window` };
  const C = Math.max(0, curtailed(uFull, gFull) + curtailed(uLatest, gLatest) - curtailed(uPrior, gPrior));
  return {
    ok: true,
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
  annualTWh: number; // generation × rate / (1 − rate): curtailed energy
  latestMonth: string;
  rateWindow: string; // YYYY-MM..YYYY-MM of the bulletin window behind the rate
  rateMonthsCovered: number;
  source: string;
}

export function buildAnchors(
  csvText: string,
  bulletinText: string,
  wired: Record<string, string> = WIRED_PROVINCES,
): AnchorRow[] {
  const rows = parseEmberMonthlyCsv(csvText);
  const bulletins = parseBulletinCsv(bulletinText);
  const latest = latestYtdPeriod(bulletins);
  const failures: string[] = [];
  const failedRegions = new Set<string>();
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
    const provinceZh = wired[province];
    if (!provinceZh) continue; // loader does not consume the store -> no anchor
    const monthly = new Map(list.map((r) => [r.date, r.generationTWh]));
    const ttm = ttmRate(bulletins, provinceZh, fuel, monthly, latest);
    if (!ttm.ok) {
      failures.push(ttm.reason); // never invent, never fall back to another window
      failedRegions.add(`${province}|${fuel}`);
      continue;
    }
    const floored = ttm.rate < RATE_FLOOR;
    const rate = Math.round(Math.max(ttm.rate, RATE_FLOOR) * 10000) / 10000;
    list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const window = list.slice(0, 12);
    const annualGen = window.reduce((s, r) => s + r.generationTWh, 0);
    const regionId = regionIdFor(province, fuel); // wired provinces are always mapped; throws loudly otherwise
    const rateText = floored
      ? `${(RATE_FLOOR * 100).toFixed(2)}% floor (published utilisation ~100%)`
      : `${(rate * 100).toFixed(1)}%`;
    out.push({
      regionId,
      fuel,
      annualGenerationTWh: Math.round(annualGen * 1000) / 1000,
      curtailmentRate: rate,
      annualTWh: Math.round(((annualGen * rate) / (1 - rate)) * 1000) / 1000,
      latestMonth: window[0].date,
      rateWindow: `${ttm.windowStart}..${ttm.windowEnd}`,
      rateMonthsCovered: ttm.monthsCovered,
      source: `Ember China subnational generation ${window[0].date} (trailing 12mo) at monitoring-centre curtailment rate ${rateText} (${provinceZh} ${fuel}, trailing 12 months ${ttm.windowStart}..${ttm.windowEnd} from published utilisation; system-caused limits only, 国能发电力〔2024〕44号); curtailed = generation × rate / (1 − rate)${RATE_SCOPE_NOTE[province] ?? ""}`,
    });
  }
  // Every wired province must get both anchors; otherwise its loader would
  // silently serve the hardcoded fallback. Fail the refresh instead (no write).
  for (const [province, zh] of Object.entries(wired)) {
    for (const fuel of ["wind", "solar"] as const) {
      const id = regionIdFor(province, fuel);
      if (!out.some((a) => a.regionId === id) && !failedRegions.has(`${province}|${fuel}`)) {
        failures.push(`${zh} ${fuel}: no Ember generation rows for ${province}`);
      }
    }
  }
  if (failures.length > 0) {
    throw new Error(`refresh-china: ${failures.length} wired anchor(s) could not be computed for the ${latest} window:\n  ${failures.join("\n  ")}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Keeping src/lib/regions.ts (and the generated validation pages) in step with
// the store. The rate and window quoted in each China region's `source:` string
// are derived from data/china-anchors.json here, never typed by hand; main()
// rewrites them after every refresh and tests/refresh-china.test.ts fails if
// they drift.
// ---------------------------------------------------------------------------

export const REGIONS_PATH = join(process.cwd(), "src", "lib", "regions.ts");
export const VALIDATION_DOCS_DIR = join(process.cwd(), "docs", "validation");

/** Region ids whose anchor lives under a different store key. */
export const REGION_ANCHOR_ALIAS: Record<string, string> = { "china-jiangxi": "china-jiangxi-solar" };

interface StoreAnchor {
  regionId: string;
  curtailmentRate: number;
  rateWindow: string;
}

/** The canonical source-string fragment for one anchored region. */
export function rateFragment(a: StoreAnchor): string {
  const pct = a.curtailmentRate <= RATE_FLOOR ? `${(RATE_FLOOR * 100).toFixed(2)}% floor` : `${(a.curtailmentRate * 100).toFixed(1)}%`;
  const split = a.regionId.startsWith("inner-mongolia-") ? ", 蒙西 Mengxi-only rate on whole-province generation" : "";
  return `monitoring-centre curtailment rate ${pct} (trailing 12 months ${a.rateWindow}${split}, system-caused limits only)`;
}

const RATE_RE = /monitoring-centre curtailment rate [^()]*\(trailing 12 months [^)]*\)/;
const WINDOW_RE = /monitoring-centre trailing-12-month curtailment rate \(\d{4}-\d{2}\.\.\d{4}-\d{2}, system-caused limits only\)/;

/**
 * Rewrite the rate/window fragments of every China region in regions.ts from the
 * store. Per-fuel and single-fuel regions get rate + window; mixed regions
 * (no single rate) get the window only. Returns the new text and the ids touched.
 */
export function syncRegionsText(text: string, anchors: StoreAnchor[]): { text: string; touched: string[] } {
  const byId = new Map(anchors.map((a) => [a.regionId, a]));
  const anyWindow = anchors[0]?.rateWindow;
  const touched: string[] = [];
  const lines = text.split("\n").map((line) => {
    const m = line.match(/\{ id: "([a-z-]+)"/);
    if (!m) return line;
    const id = m[1];
    const a = byId.get(REGION_ANCHOR_ALIAS[id] ?? id);
    if (a && RATE_RE.test(line)) {
      touched.push(id);
      const fragment = rateFragment(a);
      return line.replace(RATE_RE, () => fragment); // function: no $-pattern expansion
    }
    if (anyWindow && WINDOW_RE.test(line) && byId.has(`${id}-wind`) && byId.has(`${id}-solar`)) {
      touched.push(id);
      const fragment = `monitoring-centre trailing-12-month curtailment rate (${anyWindow}, system-caused limits only)`;
      return line.replace(WINDOW_RE, () => fragment);
    }
    return line;
  });
  return { text: lines.join("\n"), touched };
}

/** The `source:` string of a region in regions.ts text, or null. */
export function regionSourceFromText(text: string, id: string): string | null {
  const line = text.split("\n").find((l) => l.includes(`{ id: "${id}"`));
  const m = line?.match(/source: "((?:[^"\\]|\\.)*)"/);
  return m ? m[1] : null;
}

/** Rewrite the "- **Source:**" line of a validation page to `source`. */
export function syncValidationDoc(doc: string, source: string): string {
  return doc.replace(/^- \*\*Source:\*\* .*$/m, () => `- **Source:** ${source}`);
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

  // Keep regions.ts and the generated validation pages in step with the store,
  // but only when the committed store itself was written (not an --out preview).
  if (outPath !== OUT_PATH) {
    console.log(`Preview store written to ${outPath}; src/lib/regions.ts and docs/validation left untouched`);
    return;
  }
  const regionsText = readFileSync(REGIONS_PATH, "utf-8");
  const { text, touched } = syncRegionsText(regionsText, anchors);
  if (text !== regionsText) writeFileSync(REGIONS_PATH, text);
  for (const id of touched) {
    const docPath = join(VALIDATION_DOCS_DIR, `${id}.md`);
    const source = regionSourceFromText(text, id);
    if (!source || !existsSync(docPath)) continue;
    const doc = readFileSync(docPath, "utf-8");
    const synced = syncValidationDoc(doc, source);
    if (synced !== doc) writeFileSync(docPath, synced);
  }
  console.log(`Synced ${touched.length} China source strings in src/lib/regions.ts and docs/validation`);
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
