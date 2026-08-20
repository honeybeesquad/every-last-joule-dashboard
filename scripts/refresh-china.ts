// refresh-china.ts — ingest Ember's China subnational monthly generation CSV and
// write a refreshed per-region curtailment anchor store (china-anchors.json).
//
// This is the "scraper that updates the database" the user asked for. It does
// NOT touch the 27 per-province loaders directly; it produces china-anchors.json,
// which the loaders can consume via chinaAnchor() (see src/lib/chinaParse.ts).
//
// HONESTY: Ember CSV = generation, not curtailment. We annualise the trailing
// 12 months of generation per province+fuel, then apply the PUBLISHED NEA
// curtailment rate (弃风率/弃光率) to get the curtailment anchor. The rate is
// NOT invented here — it is the repo's own cited NEA 2024 figure (see the
// PROVINCE_FUEL_CURTAILMENT_RATE table, each entry cites its loader source note).
// Resulting tier is live-domestic-anchored (T1b), never live (T1a).

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
// Each value is transcribed from the corresponding loader's `source` note in
// src/data/*.json.ts so the anchor stays consistent with the repo's curation.
// Keyed by Ember province name (matches chinaParse PROVINCE_TO_REGION).
const PROVINCE_FUEL_CURTAILMENT_RATE: Record<string, Partial<Record<Fuel, number>>> = {
  Xinjiang: { wind: 0.066, solar: 0.078 }, // util 93.4% / 92.2%
  Gansu: { wind: 0.03, solar: 0.04 },
  Qinghai: { wind: 0.072, solar: 0.097 }, // util 92.8% / 90.3%
  "Inner Mongolia": { wind: 0.05, solar: 0.06 },
  Ningxia: { wind: 0.05, solar: 0.06 },
  Sichuan: { wind: 0.02, solar: 0.03 },
  Yunnan: { wind: 0.009, solar: 0.033 }, // util 99.1% / 96.7%
  Tibet: { wind: 0.17, solar: 0.314 }, // util 83.0% / 68.6%
  Shandong: { wind: 0.05, solar: 0.037 }, // ~2.5 / ~4.5 TWh of ~7 TWh
  Shanxi: { wind: 0.04, solar: 0.03 },
  Shaanxi: { wind: 0.04, solar: 0.037 },
  Hebei: { wind: 0.03, solar: 0.015 },
  Liaoning: { wind: 0.03, solar: 0.01 },
  Heilongjiang: { wind: 0.03, solar: 0.008 },
  Jilin: { wind: 0.03, solar: 0.005 },
  Henan: { wind: 0.01, solar: 0.012 },
  Anhui: { wind: 0.01, solar: 0.02 },
  Hubei: { wind: 0.013, solar: 0.02 },
  Hunan: { wind: 0.013, solar: 0.008 },
  Jiangsu: { wind: 0.025, solar: 0.025 },
  Zhejiang: { wind: 0.02, solar: 0.02 },
  Fujian: { wind: 0.02, solar: 0.02 },
  Guangdong: { wind: 0.02, solar: 0.02 },
  Guizhou: { wind: 0.03, solar: 0.03 },
  Guangxi: { wind: 0.03, solar: 0.03 },
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
      source: `Ember China subnational generation ${window[0].date} (trailing 12mo) × NEA 2024 curtailment rate ${(rate * 100).toFixed(1)}%`,
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

main().catch((err) => {
  console.error("refresh-china failed:", err);
  process.exit(1);
});
