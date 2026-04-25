import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { fetchText } from "../lib/fetch.js";
import { hourlyAverage } from "../lib/csv.js";
import { latestCompleteUtcDayProfileGW, peakGW, timeOfDayAverageGW, totalTWh30d } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";
import { AEMO_UNIT_MAP } from "./aemo-unit-map.js";

const DIRECTORY_URL = "https://nemweb.com.au/Reports/Current/Next_Day_Dispatch/";

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

export interface AemoParsed {
  /** Total (wind+solar) curtailment points per state. */
  points: Record<AemoRegionId, CurtailmentPoint[]>;
  /** Per-state 30-day-window wind MWh total, for fuelShare derivation. */
  windMwhTotal: Record<AemoRegionId, number>;
  /** Per-state 30-day-window solar MWh total. */
  solarMwhTotal: Record<AemoRegionId, number>;
}

function emptyAemoMap<T>(factory: () => T): Record<AemoRegionId, T> {
  return {
    "aemo-nsw": factory(),
    "aemo-vic": factory(),
    "aemo-qld": factory(),
    "aemo-sa": factory(),
    "aemo-tas": factory(),
  };
}

export function parseAemoDispatchCsv(csv: string): AemoParsed {
  const totals = new Map<AemoRegionId, Map<string, number>>();
  const windMwh = emptyAemoMap<number>(() => 0);
  const solarMwh = emptyAemoMap<number>(() => 0);
  let headers: string[] = [];
  const lines = csv.replace(/^\uFEFF/, "").trim().split(/\r?\n/);

  for (const line of lines) {
    if (line.startsWith("I,DISPATCH,UNIT_SOLUTION,")) {
      headers = line.split(",").slice(4);
      continue;
    }
    if (!line.startsWith("D,DISPATCH,UNIT_SOLUTION,")) continue;
    if (!headers.length) continue;

    const cells = line.split(",");
    const values = cells.slice(4);
    const get = (name: string) => values[headers.indexOf(name)]?.replace(/^"|"$/g, "");
    const localTimestamp = get("SETTLEMENTDATE");
    const duid = get("DUID");
    const totalCleared = Number(get("TOTALCLEARED") || 0);
    const availability = Number(get("AVAILABILITY") || 0);
    const semidispatchCap = Number(get("SEMIDISPATCHCAP") || 0);
    const uigf = Number(get("UIGF") || 0);

    if (!duid || semidispatchCap !== 1) continue;
    const unit = AEMO_UNIT_MAP[duid as keyof typeof AEMO_UNIT_MAP];
    if (!unit) continue;
    const regionId = REGION_CODE_TO_ID[unit.region];
    const utcTimestamp = localTimestamp ? parseAemoDate(localTimestamp) : null;
    if (!regionId || !utcTimestamp) continue;

    const unconstrained = Number.isFinite(uigf) && uigf > 0 ? uigf : availability;
    const curtailedMw = Math.max(0, unconstrained - (Number.isFinite(totalCleared) ? totalCleared : 0));
    if (curtailedMw <= 0) continue;

    let bucket = totals.get(regionId);
    if (!bucket) totals.set(regionId, (bucket = new Map<string, number>()));
    bucket.set(utcTimestamp, (bucket.get(utcTimestamp) ?? 0) + curtailedMw);

    // Accumulate per-fuel totals for observed wind/solar split.
    const tech = (unit as { fueltech?: string }).fueltech;
    if (tech === "wind") windMwh[regionId] += curtailedMw;
    else if (tech === "solar") solarMwh[regionId] += curtailedMw;
  }

  const points = Object.fromEntries(
    Object.values(REGION_CODE_TO_ID).map((regionId) => [
      regionId,
      Array.from(totals.get(regionId)?.entries() ?? [])
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw })),
    ]),
  ) as Record<AemoRegionId, CurtailmentPoint[]>;

  return { points, windMwhTotal: windMwh, solarMwhTotal: solarMwh };
}

export const parseAemoIntermittentCsv = parseAemoDispatchCsv;

/** Backwards-compat helper for tests: returns just the per-state points. */
export function parseAemoDispatchCsvPoints(csv: string): Record<AemoRegionId, CurtailmentPoint[]> {
  return parseAemoDispatchCsv(csv).points;
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
    html.matchAll(/HREF="([^"]*PUBLIC_NEXT_DAY_DISPATCH_[^"]+\.zip)"/gi),
  ).map((m) => m[1]);
  return matches.slice(-limit).map((href) => new URL(href, DIRECTORY_URL).toString());
}

const run = async (): Promise<Record<AemoRegionId, RegionData>> => {
  const listing = await fetchText(DIRECTORY_URL);
  const urls = listRecentZips(listing, 30);
  if (!urls.length) throw new Error("AEMO directory listing returned no daily dispatch zips");

  const allPoints: Record<AemoRegionId, CurtailmentPoint[]> = emptyAemoMap(() => []);
  const windTotals: Record<AemoRegionId, number> = emptyAemoMap(() => 0);
  const solarTotals: Record<AemoRegionId, number> = emptyAemoMap(() => 0);

  for (const url of urls) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const csv = unzipCsv(new Uint8Array(await res.arrayBuffer()));
    const parsed = parseAemoDispatchCsv(csv);
    for (const regionId of Object.keys(allPoints) as AemoRegionId[]) {
      allPoints[regionId].push(...parsed.points[regionId]);
      windTotals[regionId] += parsed.windMwhTotal[regionId];
      solarTotals[regionId] += parsed.solarMwhTotal[regionId];
    }
  }

  const out = {} as Record<AemoRegionId, RegionData>;
  for (const regionId of Object.keys(allPoints) as AemoRegionId[]) {
    const points = hourlyAverage(allPoints[regionId]);
    const windTot = windTotals[regionId];
    const solarTot = solarTotals[regionId];
    const denom = windTot + solarTot;
    const fuelShare = denom > 0
      ? { wind: windTot / denom, solar: solarTot / denom }
      : undefined;
    out[regionId] = {
      regionId,
      profile: timeOfDayAverageGW(points),
      latestProfile: latestCompleteUtcDayProfileGW(points),
      totalTWh: totalTWh30d(points),
      peakGW: peakGW(points),
      lastUpdated: points.at(-1)?.utcTimestamp ?? new Date().toISOString(),
      lastSuccessAt: points.at(-1)?.utcTimestamp ?? new Date().toISOString(),
      sourceNote: fuelShare
        ? `NEMWEB SEMIDISPATCHCAP direct curtailment (observed ${regionId.replace("aemo-", "").toUpperCase()} split: wind ${(fuelShare.wind * 100).toFixed(0)}% / solar ${(fuelShare.solar * 100).toFixed(0)}%)`
        : "NEMWEB DISPATCHIS/Next Day Dispatch SEMIDISPATCHCAP direct curtailment per state",
      ...(fuelShare ? { fuelShare } : {}),
    };
  }

  return out;
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<Record<AemoRegionId, RegionData>>("aemo", run, {
    regionTier: "live" as const,
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
