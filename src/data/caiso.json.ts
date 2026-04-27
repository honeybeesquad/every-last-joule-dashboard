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
 * CAISO (California) per-fuel curtailment loader.
 *
 * Source: EIA Hourly Electric Grid Monitor, CISO respondent, SUN + WND
 * fueltypes (separately). Falls back to CAISO OASIS SLD_REN_CURTAIL when
 * the direct curtailment endpoint is reachable; that path also splits by
 * RENEWABLE_TYPE so solar and wind never share a time-series.
 *
 * Why per-fuel: the v0 loader merged solar+wind generation into a single
 * `caiso` regionId × 4.25% rate, producing a non-zero overnight floor
 * (wind blows at night, so wind-curtailment was lit even after sun-down).
 * The dashboard's visual story is "pillars rise as the sun crosses overhead";
 * conflating solar and wind under one regionId obscures that. We now emit
 * `caiso-solar` (Imperial Valley centroid) and `caiso-wind` (Tehachapi
 * centroid) as two separate RegionData records.
 *
 * Calibration rates (per CAISO daily reports + Ascend Analytics 2024
 * curtailment summary, cross-referenced in research/energy_arithmetic.md):
 *   solar — 4.25%   (~3.4 TWh curtailed of ~80 TWh generated, 2024)
 *   wind  — 4.20%   (~0.5 TWh curtailed of ~12 TWh generated, 2024)
 */

const SOLAR_RATE = 0.0425;
const WIND_RATE = 0.0420;
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

export interface CaisoOutput {
  "caiso-solar": RegionData;
  "caiso-wind": RegionData;
}

/** Build per-hour curtailment points from a single-fuel EIA response. */
function buildEiaPoints(raw: EIAResponse, rate: number): CurtailmentPoint[] {
  const map = new Map<string, number>();
  for (const r of raw.response.data) {
    const ts = `${r.period}:00:00Z`;
    const mw = Math.max(0, Number(r.value) * rate);
    map.set(ts, (map.get(ts) ?? 0) + mw);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));
}

/** Build a per-fuel RegionData record. fuelShare is hard-set to 100%/0% for the fuel. */
function buildPerFuelRegion(
  regionId: "caiso-solar" | "caiso-wind",
  points: CurtailmentPoint[],
  sourceNote: string,
): RegionData {
  const lastUpdated = points.at(-1)?.utcTimestamp ?? new Date().toISOString();
  return {
    regionId,
    profile: timeOfDayAverageGW(points),
    latestProfile: latestCompleteUtcDayProfileGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated,
    lastSuccessAt: lastUpdated,
    sourceNote,
    fuelShare: regionId === "caiso-solar" ? { solar: 1, wind: 0 } : { solar: 0, wind: 1 },
  };
}

export function parseCaiso(solarRaw: EIAResponse, windRaw: EIAResponse): CaisoOutput {
  const solarPoints = buildEiaPoints(solarRaw, SOLAR_RATE);
  const windPoints = buildEiaPoints(windRaw, WIND_RATE);
  return {
    "caiso-solar": buildPerFuelRegion(
      "caiso-solar",
      solarPoints,
      "EIA hourly CAISO solar × 4.25% calibrated curtailment (CAISO 2024 ratio: 3.4 TWh / 80 TWh)",
    ),
    "caiso-wind": buildPerFuelRegion(
      "caiso-wind",
      windPoints,
      "EIA hourly CAISO wind × 4.20% calibrated curtailment (CAISO 2024 ratio: 0.5 TWh / 12 TWh)",
    ),
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

export function parseCaisoOasisCurtailmentCsv(csv: string): CaisoOutput {
  if (/INVALID_REQUEST/i.test(csv)) throw new Error("CAISO OASIS returned INVALID_REQUEST");
  const rows = parseDelimitedRows(csv, ",");
  const solarTotals = new Map<string, number>();
  const windTotals = new Map<string, number>();

  for (const row of rows) {
    const fuel = String(row.RENEWABLE_TYPE || row.FUEL_TYPE || row.FUEL_CATEGORY || "").toUpperCase();
    const isSolar = fuel.includes("SOLAR");
    const isWind = fuel.includes("WIND");
    if (!isSolar && !isWind) continue;

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
    const target = isSolar ? solarTotals : windTotals;
    target.set(utcTimestamp, (target.get(utcTimestamp) ?? 0) + value);
  }

  const toPoints = (m: Map<string, number>): CurtailmentPoint[] =>
    Array.from(m.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));

  const solarPoints = toPoints(solarTotals);
  const windPoints = toPoints(windTotals);
  if (!solarPoints.length && !windPoints.length) {
    throw new Error("CAISO OASIS curtailment CSV had no wind/solar rows");
  }

  return {
    "caiso-solar": buildPerFuelRegion(
      "caiso-solar",
      solarPoints,
      "CAISO OASIS SLD_REN_CURTAIL direct solar curtailment",
    ),
    "caiso-wind": buildPerFuelRegion(
      "caiso-wind",
      windPoints,
      "CAISO OASIS SLD_REN_CURTAIL direct wind curtailment",
    ),
  };
}

async function fetchCaisoOasisDirect(): Promise<CaisoOutput> {
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

const run = async (): Promise<CaisoOutput> => {
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

  // Per-fuel split: both fetches required. If either fails, withFallback
  // returns the cached snapshot (which contains both keys). We deliberately
  // do NOT degrade to solar-only here — the previous v0 behaviour of
  // continuing solar-only obscured the absence of wind curtailment data.
  const [solar, wind] = await Promise.all([
    fetchJSON<EIAResponse>(makeUrl("SUN")),
    fetchJSON<EIAResponse>(makeUrl("WND")),
  ]);
  return parseCaiso(solar, wind);
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<CaisoOutput>("caiso", run, {
    regionTier: "live" as const,
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("caiso loader failed", err);
      process.exit(1);
    });
}
