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

// Published NEA 2024 curtailment rate (fraction) per province+fuel.
//
// HONESTY: only values that are TRANSCRIBED from a published utilisation figure
// in the corresponding loader's `source` note are included here. Everything else
// is omitted on purpose — if a province has no published curtailment rate, the
// `rate === undefined -> continue` path below simply skips it (no anchor, no
// invented number attributed to NEA in a committed data file). Do NOT add a rate
// here unless you can cite the published utilisation percentage it derives from.
// Keyed by Ember province name (matches chinaParse PROVINCE_TO_REGION).
//
// Transcribed (utilisation U% -> rate = 1 - U/100) from the 全国新能源消纳监测预警中心
// (NEA Renewable Energy Curtailment Monitoring Center) 2024 full-year / 2024M1-11
// provincial new-energy grid-integration utilisation bulletin, published 2025-02-06
// (reported by 中国能源新闻网: https://www.cpnn.com.cn/news/xny/202502/t20250219_1773747.html).
// These are the SAME authoritative source the original 5 rates use. Inner Mongolia
// here = 蒙西 (West Inner Mongolia grid), which is the curtailing grid the dashboard's
// inner-mongolia regions represent. NOTE: the rate is 蒙西-scoped but the generation
// multiplier is Ember's whole-Inner-Mongolia row (includes 蒙东), so the anchor is an
// upper bound for the 蒙西 curtailing grid.
//   Xinjiang  wind 93.4% -> 6.6%   solar 92.2% -> 7.8%
//   Qinghai   wind 92.8% -> 7.2%   solar 90.3% -> 9.7%
//   Yunnan    wind 99.1% -> 0.9%   solar 96.7% -> 3.3%
//   Tibet     wind 83.0% -> 17.0%  solar 68.6% -> 31.4%
//   Shandong  wind 96.4% -> 3.6%   solar 96.3% -> 3.7%
//   Gansu     wind 93.9% -> 6.1%   solar 91.6% -> 8.4%
//   Inner Mongolia (蒙西) wind 95.4% -> 4.6%   solar 94.7% -> 5.3%
//   Ningxia   wind 97.5% -> 2.5%   solar 95.4% -> 4.6%
//   Hebei     wind 94.0% -> 6.0%   solar 96.5% -> 3.5%
//   Shaanxi   wind 94.3% -> 5.7%   solar 95.1% -> 4.9%
//   Henan     wind 96.3% -> 3.7%   solar 98.1% -> 1.9%
//   Hubei     wind 98.1% -> 1.9%   solar 97.5% -> 2.5%
//   Hunan     wind 97.0% -> 3.0%   solar 99.4% -> 0.6%
//   Shanxi    wind 99.0% -> 1.0%   solar 99.0% -> 1.0%
//   Liaoning  wind 95.0% -> 5.0%   solar 97.1% -> 2.9%
//   Jilin     wind 93.5% -> 6.5%   solar 97.6% -> 2.4%
//   Heilongjiang wind 95.0% -> 5.0%  solar 96.6% -> 3.4%
//   Jiangsu   wind 99.7% -> 0.3%   solar 99.9% -> 0.1%
//   Anhui     wind 99.9% -> 0.1%   solar 99.9% -> 0.1%
const PROVINCE_FUEL_CURTAILMENT_RATE: Record<string, Partial<Record<Fuel, number>>> = {
  Xinjiang: { wind: 0.066, solar: 0.078 }, // util 93.4% / 92.2%
  Qinghai: { wind: 0.072, solar: 0.097 }, // util 92.8% / 90.3%
  Yunnan: { wind: 0.009, solar: 0.033 }, // util 99.1% / 96.7%
  Tibet: { wind: 0.17, solar: 0.314 }, // util 83.0% / 68.6%
  Shandong: { wind: 0.036, solar: 0.037 }, // util 96.4% / 96.3% (wind rate was previously omitted as "not published" — that was a transcription gap; the 2024 bulletin lists 96.4%)
  Gansu: { wind: 0.061, solar: 0.084 }, // util 93.9% / 91.6%
  "Inner Mongolia": { wind: 0.046, solar: 0.053 }, // 蒙西 util 95.4% / 94.7%
  Ningxia: { wind: 0.025, solar: 0.046 }, // util 97.5% / 95.4%
  Hebei: { wind: 0.06, solar: 0.035 }, // util 94.0% / 96.5%
  Shaanxi: { wind: 0.057, solar: 0.049 }, // util 94.3% / 95.1%
  Henan: { wind: 0.037, solar: 0.019 }, // util 96.3% / 98.1%
  Hubei: { wind: 0.019, solar: 0.025 }, // util 98.1% / 97.5%
  Hunan: { wind: 0.03, solar: 0.006 }, // util 97.0% / 99.4%
  Shanxi: { wind: 0.01, solar: 0.01 }, // util 99.0% / 99.0%
  Liaoning: { wind: 0.05, solar: 0.029 }, // util 95.0% / 97.1%
  Jilin: { wind: 0.065, solar: 0.024 }, // util 93.5% / 97.6%
  Heilongjiang: { wind: 0.05, solar: 0.034 }, // util 95.0% / 96.6%
  Jiangsu: { wind: 0.003, solar: 0.001 }, // util 99.7% / 99.9%
  Anhui: { wind: 0.001, solar: 0.001 }, // util 99.9% / 99.9%
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
      source: `Ember China subnational generation ${window[0].date} (trailing 12mo) × NEA 2024 curtailment rate ${(rate * 100).toFixed(1)}% (transcribed from published utilisation)`,
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
