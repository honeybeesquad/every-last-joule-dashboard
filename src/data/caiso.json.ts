import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fetchJSON } from "../lib/fetch.js";
import { parseDelimitedRows } from "../lib/csv.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW, latestCompleteUtcDayProfileGW } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData, CurtailmentPoint } from "../lib/types.js";
import { pathToFileURL } from "url";

/**
 * CAISO (California) solar curtailment loader - v0 proxy.
 *
 * Source: EIA Hourly Electric Grid Monitor, CISO respondent, SUN fueltype.
 * CAISO's own OASIS API has obsolete curtailment-report query names in 2026;
 * EIA publishes the same underlying data with a stable schema.
 *
 * Curtailment derivation: EIA does not directly publish curtailment for
 * CAISO.  We apply a calibrated proxy rate of 4.25% to hourly solar
 * generation.  The rate is CAISO's 2024 curtailment ratio (3.4 TWh
 * curtailed / 80 TWh generated) per Ascend Analytics, CAISO daily reports,
 * and `research/energy_arithmetic.md`.
 *
 * The 30-day time-of-day average inherits the real solar diurnal shape -
 * midday-heavy - which matches CAISO's actual duck-curve curtailment
 * pattern.
 */

// CAISO 2024 curtailment: ~3.4 TWh solar out of ~80 TWh solar generated (~4.25%).
// Wind curtailment ~0.5 TWh out of ~12 TWh wind generated (~4.2%). Rates close;
// keep as 4.25% blended.
const CURTAILMENT_RATE = 0.0425;
const API_BASE = "https://api.eia.gov/v2/electricity/rto/fuel-type-data/data/";
const OASIS_BASE = "https://oasis.caiso.com/oasisapi/SingleZip";

interface EIAResponse {
  response: {
    total: string | number;
    data: Array<{
      period: string;
      respondent: string;
      fueltype: string;
      value: string;
    }>;
  };
}

/** Merge parallel fueltype EIA responses (solar + wind) into a single
 *  per-hour curtailment series. Each gets the same calibrated rate. */
function mergeEiaResponses(
  solar: EIAResponse,
  wind?: EIAResponse,
): { points: CurtailmentPoint[]; solarMw: number; windMw: number } {
  const map = new Map<string, number>();
  let solarMw = 0;
  let windMw = 0;
  const rows: Array<{ period: string; value: string; fuel: "solar" | "wind" }> = [
    ...solar.response.data.map((r) => ({ period: r.period, value: r.value, fuel: "solar" as const })),
    ...(wind?.response?.data ?? []).map((r) => ({ period: r.period, value: r.value, fuel: "wind" as const })),
  ];
  for (const r of rows) {
    const ts = `${r.period}:00:00Z`;
    const mw = Math.max(0, Number(r.value) * CURTAILMENT_RATE);
    map.set(ts, (map.get(ts) ?? 0) + mw);
    if (r.fuel === "solar") solarMw += mw;
    else windMw += mw;
  }
  const points = Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));
  return { points, solarMw, windMw };
}

export function parseCaiso(solarRaw: EIAResponse, windRaw?: EIAResponse): RegionData {
  const { points, solarMw, windMw } = mergeEiaResponses(solarRaw, windRaw);
  const denom = solarMw + windMw;
  const fuelShare = denom > 0
    ? { solar: solarMw / denom, wind: windMw / denom }
    : { solar: 1, wind: 0 };
  const lastPeriod = points.at(-1)?.utcTimestamp ?? new Date().toISOString();

  return {
    regionId: "caiso",
    profile: timeOfDayAverageGW(points),
    latestProfile: latestCompleteUtcDayProfileGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: lastPeriod,
    sourceNote: `EIA hourly solar+wind × 4.25% calibrated curtailment (observed 30d split: solar ${(fuelShare.solar * 100).toFixed(0)}% / wind ${(fuelShare.wind * 100).toFixed(0)}%)`,
    fuelShare,
  };
}

function unzipText(zipBytes: Uint8Array): string {
  const dir = mkdtempSync(join(tmpdir(), "caiso-"));
  const zipPath = join(dir, "report.zip");
  try {
    writeFileSync(zipPath, zipBytes);
    return execFileSync("unzip", ["-p", zipPath], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function parseCaisoOasisCurtailmentCsv(csv: string): RegionData {
  if (/INVALID_REQUEST/i.test(csv)) throw new Error("CAISO OASIS returned INVALID_REQUEST");
  const rows = parseDelimitedRows(csv, ",");
  const totals = new Map<string, number>();
  let solarMw = 0;
  let windMw = 0;

  for (const row of rows) {
    const fuel = String(row.RENEWABLE_TYPE || row.FUEL_TYPE || row.FUEL_CATEGORY || "").toUpperCase();
    if (fuel && !/(SOLAR|WIND)/.test(fuel)) continue;
    const rawTs = row.INTERVALSTARTTIME_GMT || row.INTERVAL_START_GMT || row.OPR_DT || row.DATA_ITEM;
    const interval = row.INTERVAL_NUM ? Number(row.INTERVAL_NUM) : 1;
    const ts = rawTs && /^\d{4}-\d{2}-\d{2}/.test(rawTs)
      ? new Date(rawTs.replace(" ", "T").replace(/Z?$/, "Z"))
      : null;
    if (!ts || Number.isNaN(ts.getTime())) continue;
    if (row.OPR_DT && !row.INTERVALSTARTTIME_GMT && Number.isFinite(interval)) {
      ts.setUTCHours(interval - 1, 0, 0, 0);
    }

    const value = Number(
      row.CURTAILMENT_MW ||
      row.CURTAILMENT_MWH ||
      row.CURTAILED_MW ||
      row.VALUE ||
      row.MW ||
      0,
    );
    if (!Number.isFinite(value) || value <= 0) continue;
    const utcTimestamp = ts.toISOString();
    totals.set(utcTimestamp, (totals.get(utcTimestamp) ?? 0) + value);
    if (fuel.includes("SOLAR")) solarMw += value;
    else if (fuel.includes("WIND")) windMw += value;
  }

  const points = Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));
  if (!points.length) throw new Error("CAISO OASIS curtailment CSV had no wind/solar rows");

  const denom = solarMw + windMw;
  const fuelShare = denom > 0
    ? { solar: solarMw / denom, wind: windMw / denom }
    : undefined;

  return {
    regionId: "caiso",
    profile: timeOfDayAverageGW(points),
    latestProfile: latestCompleteUtcDayProfileGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: points.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    sourceNote: fuelShare
      ? `CAISO OASIS SLD_REN_CURTAIL direct (observed 30d split: solar ${(fuelShare.solar * 100).toFixed(0)}% / wind ${(fuelShare.wind * 100).toFixed(0)}%)`
      : "CAISO OASIS SLD_REN_CURTAIL direct wind+solar curtailment",
    ...(fuelShare ? { fuelShare } : {}),
  };
}

async function fetchCaisoOasisDirect(): Promise<RegionData> {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end.getTime() - 30 * 24 * 3600 * 1000);
  const fmt = (d: Date) => `${d.toISOString().slice(0, 10).replace(/-/g, "")}T00:00-0000`;
  const params = new URLSearchParams({
    queryname: "SLD_REN_CURTAIL",
    version: "1",
    startdatetime: fmt(start),
    enddatetime: fmt(end),
    resultformat: "6",
  });
  const res = await fetch(`${OASIS_BASE}?${params.toString()}`);
  if (!res.ok) throw new Error(`CAISO OASIS HTTP ${res.status}`);
  return parseCaisoOasisCurtailmentCsv(unzipText(new Uint8Array(await res.arrayBuffer())));
}

const run = async (): Promise<RegionData> => {
  try {
    return await fetchCaisoOasisDirect();
  } catch (err) {
    console.warn(`CAISO OASIS direct curtailment unavailable; falling back to EIA proxy: ${(err as Error).message}`);
  }

  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey) throw new Error("EIA_API_KEY not set");

  const now = new Date();
  const end = now.toISOString().slice(0, 13);
  const start = new Date(now.getTime() - 30 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 13);

  const makeUrl = (fueltype: "SUN" | "WND") => {
    const params = new URLSearchParams({
      api_key: apiKey,
      frequency: "hourly",
      "data[0]": "value",
      "facets[respondent][]": "CISO",
      "facets[fueltype][]": fueltype,
      start,
      end,
      "sort[0][column]": "period",
      "sort[0][direction]": "asc",
      length: "5000",
    });
    return `${API_BASE}?${params.toString()}`;
  };
  const [solar, wind] = await Promise.all([
    fetchJSON<EIAResponse>(makeUrl("SUN")),
    fetchJSON<EIAResponse>(makeUrl("WND")).catch((err) => {
      console.warn(`CAISO WND fetch failed, continuing solar-only: ${(err as Error).message}`);
      return undefined;
    }),
  ]);
  return parseCaiso(solar, wind);
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>("caiso", run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("caiso loader failed", err);
      process.exit(1);
    });
}
