// refresh-china.ts — ingest Ember's China subnational monthly generation CSV and
// write a refreshed per-region curtailment anchor store (china-anchors.json).
//
// This is the "scraper that updates the database" the user asked for. It does
// NOT touch the 27 per-province loaders directly; it produces china-anchors.json,
// which the loaders can consume via chinaAnchor() (see src/lib/chinaParse.ts).
//
// HONESTY: Ember CSV = generation, not curtailment. We annualise the trailing
// 12 months of generation per province+fuel, then apply the PUBLISHED NEA
// curtailment rate (弃风率/弃光率) — ONLY rates transcribed from a loader's own
// source note, never invented (see PROVINCE_FUEL_CURTAILMENT_RATE). The store
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

const DEFAULT_CSV_URL =
  "https://storage.googleapis.com/emb-prod-bkt-publicdata/public-downloads/generation/outputs/release_chn_subnational_generation_monthly.csv";
const OUT_PATH = join(process.cwd(), "data", "china-anchors.json");

// Published full-year curtailment rate (fraction) per province+fuel, for RATE_YEAR.
//
// HONESTY: only values TRANSCRIBED from a published utilisation figure are included.
// A province with no published rate is skipped by the `rate === undefined -> continue`
// path below (no anchor, no invented number attributed to NEA in a committed data file).
// Do NOT add a rate unless you can cite the published utilisation percentage.
// Keyed by Ember province name (matches chinaParse PROVINCE_TO_REGION).
//
// Source: "2025年各省级区域新能源并网消纳情况", released 2026-02-06 by the
// 电力行业规划研究与监测预警中心 (formerly 全国新能源消纳监测预警中心, the NEA-backed
// monitoring centre). Read on 2026-11-19 from the centre's own table image (watermark
// "公众号 · 电力行业规划研究与监测预警中心"), reprinted at solarpwr.cn/m.php?fid=52&id=81474
// and, byte-identical, at http://www.cnygnyw.com/listshow.php?cid=13&id=8073. Period header
// "12月 | 2025年": the 2025年 column is full-year 2025, not Jan–Nov.
// Rate = 1 − U/100. A published 100.0% uses a 0.05% floor (99.95%) so the profile is not
// zero-area. 冀北 is not listed; the 河北 row is used for Hebei.
// Inner Mongolia = the 蒙西 (Mengxi) row, applied to Ember's whole-province generation
// (which includes 蒙东), so that anchor is an upper bound for the Mengxi grid.
// (*) The table's watermark crosses these 2025 cells. They were read at 3x zoom and are
// legible, but should be re-checked against a cleaner copy if one turns up.
//
// History: until 2026-11-19 these were 2024 rates transcribed from cpnn.com.cn
// t20250219_1773747, several of them wrongly (e.g. Hebei wind 94.0% vs the table's 92.6%,
// Shandong solar 96.3% vs 98.5%) and Inner Mongolia's from the Jan–Nov release. The
// full-year 2024 table (m.solarzoom.com/article-190789-1.html) is kept below for reference.
//
//   province        2024 wind / solar    2025 wind / solar  (utilisation %)
//   Xinjiang 新疆      93.4 /  92.2         91.0 /  86.3
//   Qinghai 青海       92.8 /  90.3         92.8 /  83.4
//   Yunnan 云南        99.1 /  96.7         97.2 /  93.1
//   Tibet 西藏         83.0 /  68.6         68.6 /  64.9
//   Shandong 山东      96.4 /  98.5         95.7 /  96.9
//   Guangdong 广东     99.5 /  99.9         98.6 /  99.6
//   Fujian 福建       100.0 / 100.0        100.0 / 100.0
//   Zhejiang 浙江     100.0 / 100.0         99.5*/ 100.0
//   Jiangxi 江西       99.5 /  99.0         99.6*/  98.9
//   Gansu 甘肃         94.0 /  91.3         93.7 /  89.6
//   Inner Mongolia 蒙西 93.7 /  93.7         91.8 /  90.5
//   Ningxia 宁夏       97.6 /  95.3         95.6 /  93.9
//   Hebei 河北         92.6 /  96.1         92.0 /  94.3
//   Shaanxi 陕西       94.4 /  94.5         95.3 /  91.0
//   Henan 河南         96.4 /  98.1         95.3 /  98.4
//   Hubei 湖北         98.3 /  97.6         98.1*/  97.0
//   Hunan 湖南         97.2 /  99.4         93.4 /  98.0
//   Shanxi 山西        98.7 /  98.2         94.4 /  97.8
//   Liaoning 辽宁      95.3 /  97.2         93.0 /  96.5
//   Jilin 吉林         93.6 /  97.5         91.8 /  96.6
//   Heilongjiang 黑龙江 95.2 /  96.7         93.8 /  95.1
//   Jiangsu 江苏       99.7 /  99.9         98.3 /  99.4
//   Anhui 安徽        100.0 /  99.9         99.0*/  98.5

export const RATE_YEAR = 2025;

// Appended to the anchor's served source note where the transcribed rate covers only
// part of the province that Ember's generation row covers.
const RATE_SCOPE_NOTE: Record<string, string> = {
  "Inner Mongolia": "; the rate is 蒙西 (Mengxi)-only and the generation is whole-province, including Mengdong",
};

const PROVINCE_FUEL_CURTAILMENT_RATE: Record<string, Partial<Record<Fuel, number>>> = {
  Xinjiang: { wind: 0.09, solar: 0.137 }, // 2025 util 91.0% / 86.3%
  Qinghai: { wind: 0.072, solar: 0.166 }, // 2025 util 92.8% / 83.4%
  Yunnan: { wind: 0.028, solar: 0.069 }, // 2025 util 97.2% / 93.1%
  Tibet: { wind: 0.314, solar: 0.351 }, // 2025 util 68.6% / 64.9%
  Shandong: { wind: 0.043, solar: 0.031 }, // 2025 util 95.7% / 96.9%
  Guangdong: { wind: 0.014, solar: 0.004 }, // 2025 util 98.6% / 99.6%
  Fujian: { wind: 0.0005, solar: 0.0005 }, // 2025 util 100.0% / 100.0%
  Zhejiang: { wind: 0.005, solar: 0.0005 }, // 2025 util 99.5% / 100.0% (*wind)
  Jiangxi: { wind: 0.004, solar: 0.011 }, // 2025 util 99.6% / 98.9% (*wind)
  Gansu: { wind: 0.063, solar: 0.104 }, // 2025 util 93.7% / 89.6%
  "Inner Mongolia": { wind: 0.082, solar: 0.095 }, // 2025 util 91.8% / 90.5%
  Ningxia: { wind: 0.044, solar: 0.061 }, // 2025 util 95.6% / 93.9%
  Hebei: { wind: 0.08, solar: 0.057 }, // 2025 util 92.0% / 94.3%
  Shaanxi: { wind: 0.047, solar: 0.09 }, // 2025 util 95.3% / 91.0%
  Henan: { wind: 0.047, solar: 0.016 }, // 2025 util 95.3% / 98.4%
  Hubei: { wind: 0.019, solar: 0.03 }, // 2025 util 98.1% / 97.0% (*wind)
  Hunan: { wind: 0.066, solar: 0.02 }, // 2025 util 93.4% / 98.0%
  Shanxi: { wind: 0.056, solar: 0.022 }, // 2025 util 94.4% / 97.8%
  Liaoning: { wind: 0.07, solar: 0.035 }, // 2025 util 93.0% / 96.5%
  Jilin: { wind: 0.082, solar: 0.034 }, // 2025 util 91.8% / 96.6%
  Heilongjiang: { wind: 0.062, solar: 0.049 }, // 2025 util 93.8% / 95.1%
  Jiangsu: { wind: 0.017, solar: 0.006 }, // 2025 util 98.3% / 99.4%
  Anhui: { wind: 0.01, solar: 0.015 }, // 2025 util 99.0% / 98.5% (*wind)
};

interface AnchorRow {
  regionId: string;
  fuel: Fuel;
  annualGenerationTWh: number;
  curtailmentRate: number;
  annualTWh: number; // generation * rate
  latestMonth: string;
  source: string;
}

export function buildAnchors(csvText: string): AnchorRow[] {
  const rows = parseEmberMonthlyCsv(csvText);
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
    const rate = PROVINCE_FUEL_CURTAILMENT_RATE[province]?.[fuel];
    if (rate === undefined) continue; // no published curtailment rate -> skip
    list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const window = list.slice(0, 12);
    const annualGen = window.reduce((s, r) => s + r.generationTWh, 0);
    let regionId: string;
    try {
      regionId = regionIdFor(province, fuel);
    } catch {
      continue;
    }
    out.push({
      regionId,
      fuel,
      annualGenerationTWh: Math.round(annualGen * 1000) / 1000,
      curtailmentRate: rate,
      annualTWh: Math.round(annualGen * rate * 1000) / 1000,
      latestMonth: window[0].date,
      source: `Ember China subnational generation ${window[0].date} (trailing 12mo) × NEA monitoring-centre full-year ${RATE_YEAR} curtailment rate ${(rate * 100).toFixed(rate < 0.001 ? 2 : 1)}% (transcribed from published utilisation)${RATE_SCOPE_NOTE[province] ?? ""}`,
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

  const anchors = buildAnchors(csvText);
  const payload = {
    generatedAt: new Date().toISOString(),
    source: DEFAULT_CSV_URL,
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
