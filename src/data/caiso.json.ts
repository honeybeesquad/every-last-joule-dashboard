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

const SOLAR_RATE = 0.0425;
const WIND_RATE = 0.042;

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

function toPoints(raw: EIAResponse, rate: number): CurtailmentPoint[] {
  return raw.response.data.map((r) => ({
    utcTimestamp: `${r.period}:00:00Z`,
    mw: Math.max(0, Number(r.value) * rate),
  }));
}

function scalePoints(points: CurtailmentPoint[], share: number): CurtailmentPoint[] {
  return points.map((p) => ({ ...p, mw: p.mw * share }));
}

export function parseCaisoPerFuel(
  solarRaw: EIAResponse,
  windRaw?: EIAResponse,
): { wind: RegionData; solar: RegionData } {
  const solarPoints = toPoints(solarRaw, SOLAR_RATE);
  const windPoints = toPoints(windRaw ?? { response: { total: 0, data: [] } }, WIND_RATE);

  const solarLast = solarPoints.at(-1)?.utcTimestamp ?? new Date().toISOString();
  const windLast = windPoints.at(-1)?.utcTimestamp ?? new Date().toISOString();

  const solarTotalMw = solarPoints.reduce((s, p) => s + p.mw, 0);
  const windTotalMw = windPoints.reduce((s, p) => s + p.mw, 0);
  const denom = solarTotalMw + windTotalMw;
  const fuelShare = denom > 0
    ? { solar: solarTotalMw / denom, wind: windTotalMw / denom }
    : { solar: 1, wind: 0 };

  return {
    solar: {
      regionId: "caiso-solar",
      profile: timeOfDayAverageGW(solarPoints),
      latestProfile: latestCompleteUtcDayProfileGW(solarPoints),
      totalTWh: totalTWh30d(solarPoints),
      peakGW: peakGW(solarPoints),
      lastUpdated: solarLast,
      lastSuccessAt: solarLast,
      sourceNote: `EIA CISO solar × ${(SOLAR_RATE * 100).toFixed(2)}% calibrated curtailment (CAISO 2024: 3.4 TWh / 80 TWh)`,
      fuelShare,
    },
    wind: {
      regionId: "caiso-wind",
      profile: timeOfDayAverageGW(windPoints),
      latestProfile: latestCompleteUtcDayProfileGW(windPoints),
      totalTWh: totalTWh30d(windPoints),
      peakGW: peakGW(windPoints),
      lastUpdated: windLast,
      lastSuccessAt: windLast,
      sourceNote: `EIA CISO wind × ${(WIND_RATE * 100).toFixed(1)}% calibrated curtailment (CAISO 2024: 0.5 TWh / 12 TWh)`,
      fuelShare,
    },
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

export function parseCaisoOasisCurtailmentCsvPerFuel(
  csv: string,
): { wind: RegionData; solar: RegionData } {
  if (/INVALID_REQUEST/i.test(csv)) throw new Error("CAISO OASIS returned INVALID_REQUEST");
  const rows = parseDelimitedRows(csv, ",");

  const solarTotals = new Map<string, number>();
  const windTotals = new Map<string, number>();
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

    if (fuel.includes("SOLAR")) {
      solarTotals.set(utcTimestamp, (solarTotals.get(utcTimestamp) ?? 0) + value);
      solarMw += value;
    } else if (fuel.includes("WIND")) {
      windTotals.set(utcTimestamp, (windTotals.get(utcTimestamp) ?? 0) + value);
      windMw += value;
    }
  }

  const solarPoints = Array.from(solarTotals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));
  const windPoints = Array.from(windTotals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));

  if (!solarPoints.length && !windPoints.length) throw new Error("CAISO OASIS curtailment CSV had no wind/solar rows");

  const denom = solarMw + windMw;
  const fuelShare = denom > 0
    ? { solar: solarMw / denom, wind: windMw / denom }
    : { solar: 1, wind: 0 };

  const solarLast = solarPoints.at(-1)?.utcTimestamp ?? new Date().toISOString();
  const windLast = windPoints.at(-1)?.utcTimestamp ?? new Date().toISOString();

  return {
    solar: {
      regionId: "caiso-solar",
      profile: timeOfDayAverageGW(solarPoints),
      latestProfile: latestCompleteUtcDayProfileGW(solarPoints),
      totalTWh: totalTWh30d(solarPoints),
      peakGW: peakGW(solarPoints),
      lastUpdated: solarLast,
      lastSuccessAt: solarLast,
      sourceNote: `CAISO OASIS SLD_REN_CURTAIL direct (observed 30d split: solar ${(fuelShare.solar * 100).toFixed(0)}% / wind ${(fuelShare.wind * 100).toFixed(0)}%)`,
      fuelShare,
    },
    wind: {
      regionId: "caiso-wind",
      profile: timeOfDayAverageGW(windPoints),
      latestProfile: latestCompleteUtcDayProfileGW(windPoints),
      totalTWh: totalTWh30d(windPoints),
      peakGW: peakGW(windPoints),
      lastUpdated: windLast,
      lastSuccessAt: windLast,
      sourceNote: `CAISO OASIS SLD_REN_CURTAIL direct (observed 30d split: solar ${(fuelShare.solar * 100).toFixed(0)}% / wind ${(fuelShare.wind * 100).toFixed(0)}%)`,
      fuelShare,
    },
  };
}

async function fetchCaisoOasisDirect(): Promise<{ wind: RegionData; solar: RegionData }> {
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
  return parseCaisoOasisCurtailmentCsvPerFuel(unzipText(new Uint8Array(await res.arrayBuffer())));
}

const run = async (): Promise<{ wind: RegionData; solar: RegionData }> => {
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
  return parseCaisoPerFuel(solar, wind);
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<{ wind: RegionData; solar: RegionData }>("caiso", run, {
    regionTier: "live" as const,
    tagLive: (r) => r,
    tagCached: (c) => c,
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("caiso loader failed", err);
      process.exit(1);
    });
}