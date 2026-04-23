import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { fetchText } from "../lib/fetch.js";
import { peakGW, timeOfDayAverageGW, totalTWh30d } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";
import { AEMO_UNIT_MAP } from "./aemo-unit-map.js";

const DIRECTORY_URL = "https://nemweb.com.au/Reports/Current/Next_Day_Intermittent_Gen_Scada/";
const CALIBRATION_RATE = 0.03;

type AemoRegionId = "aemo-nsw" | "aemo-vic" | "aemo-qld" | "aemo-sa" | "aemo-tas";

const REGION_CODE_TO_ID: Record<string, AemoRegionId> = {
  NSW1: "aemo-nsw",
  VIC1: "aemo-vic",
  QLD1: "aemo-qld",
  SA1: "aemo-sa",
  TAS1: "aemo-tas",
};

function parseAemoDate(localAest: string): string | null {
  const match = localAest.match(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const utcMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) - 10,
    Number(minute),
    Number(second),
  );
  return new Date(utcMs).toISOString();
}

export function parseAemoIntermittentCsv(
  csv: string,
): Record<AemoRegionId, CurtailmentPoint[]> {
  const totals = new Map<AemoRegionId, Map<string, number>>();
  const lines = csv.replace(/^\uFEFF/, "").trim().split(/\r?\n/);

  for (const line of lines) {
    if (!line.startsWith("D,DEMAND,INTERMITTENT_GEN_SCADA,")) continue;
    const cells = line.split(",");
    const localTimestamp = cells[4]?.replace(/^"|"$/g, "");
    const duid = cells[5]?.replace(/^"|"$/g, "");
    const scadaType = cells[6]?.replace(/^"|"$/g, "");
    const value = Number(cells[7]);

    if (!duid || scadaType !== "LOCL" || !Number.isFinite(value)) continue;
    const unit = AEMO_UNIT_MAP[duid as keyof typeof AEMO_UNIT_MAP];
    if (!unit) continue;
    const regionId = REGION_CODE_TO_ID[unit.region];
    const utcTimestamp = localTimestamp ? parseAemoDate(localTimestamp) : null;
    if (!regionId || !utcTimestamp) continue;

    let bucket = totals.get(regionId);
    if (!bucket) totals.set(regionId, (bucket = new Map<string, number>()));
    bucket.set(utcTimestamp, (bucket.get(utcTimestamp) ?? 0) + Math.max(0, value * CALIBRATION_RATE));
  }

  return Object.fromEntries(
    Object.values(REGION_CODE_TO_ID).map((regionId) => [
      regionId,
      Array.from(totals.get(regionId)?.entries() ?? [])
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw })),
    ]),
  ) as Record<AemoRegionId, CurtailmentPoint[]>;
}

function unzipCsv(zipBytes: Uint8Array): string {
  const dir = mkdtempSync(join(tmpdir(), "aemo-"));
  const zipPath = join(dir, "report.zip");
  try {
    writeFileSync(zipPath, zipBytes);
    return execFileSync("unzip", ["-p", zipPath], { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function listRecentZips(html: string, limit = 30): string[] {
  const matches = Array.from(
    html.matchAll(/HREF="([^"]*PUBLIC_NEXT_DAY_INTERMITTENT_GEN_SCADA_[^"]+\.zip)"/gi),
  ).map((m) => m[1]);
  return matches.slice(-limit).map((href) => new URL(href, DIRECTORY_URL).toString());
}

const run = async (): Promise<Record<AemoRegionId, RegionData>> => {
  const listing = await fetchText(DIRECTORY_URL);
  const urls = listRecentZips(listing, 30);
  if (!urls.length) throw new Error("AEMO directory listing returned no daily intermittent SCADA zips");

  const allPoints: Record<AemoRegionId, CurtailmentPoint[]> = {
    "aemo-nsw": [],
    "aemo-vic": [],
    "aemo-qld": [],
    "aemo-sa": [],
    "aemo-tas": [],
  };

  for (const url of urls) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const csv = unzipCsv(new Uint8Array(await res.arrayBuffer()));
    const parsed = parseAemoIntermittentCsv(csv);
    for (const regionId of Object.keys(allPoints) as AemoRegionId[]) {
      allPoints[regionId].push(...parsed[regionId]);
    }
  }

  const out = {} as Record<AemoRegionId, RegionData>;
  for (const regionId of Object.keys(allPoints) as AemoRegionId[]) {
    const points = allPoints[regionId];
    out[regionId] = {
      regionId,
      profile: timeOfDayAverageGW(points),
      totalTWh: totalTWh30d(points),
      peakGW: peakGW(points),
      lastUpdated: points.at(-1)?.utcTimestamp ?? new Date().toISOString(),
      sourceNote: "AEMO intermittent SCADA LOCL output × 3% calibrated curtailment proxy, split by NEM region",
    };
  }

  return out;
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<Record<AemoRegionId, RegionData>>("aemo", run, {
    tagLive: (r) => Object.fromEntries(
      Object.entries(r).map(([k, v]) => [k, { ...v, sourceStatus: "live" as const }]),
    ) as Record<AemoRegionId, RegionData>,
    tagCached: (c) => Object.fromEntries(
      Object.entries(c).map(([k, v]) => [k, { ...v, sourceStatus: "cached" as const }]),
    ) as Record<AemoRegionId, RegionData>,
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("aemo loader failed", err);
      process.exit(1);
    });
}
