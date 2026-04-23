import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fetchJSON } from "../lib/fetch.js";
import { parseDelimitedRows } from "../lib/csv.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW } from "../lib/profile.js";
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

export function parseCaiso(raw: EIAResponse): RegionData {
  const records = raw.response.data;
  const points: CurtailmentPoint[] = records.map((r) => {
    const utcTimestamp = `${r.period}:00:00Z`;
    const solarMW = Math.max(0, Number(r.value));   // clamp negatives
    const curtailmentMW = solarMW * CURTAILMENT_RATE;
    return { utcTimestamp, mw: curtailmentMW };
  });

  return {
    regionId: "caiso",
    profile: timeOfDayAverageGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: records.at(-1)?.period ?? new Date().toISOString(),
    sourceNote:
      "EIA hourly solar × 4.25% calibrated curtailment rate (CAISO 2024 actuals)",
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
    if (!Number.isFinite(value)) continue;
    const utcTimestamp = ts.toISOString();
    totals.set(utcTimestamp, (totals.get(utcTimestamp) ?? 0) + Math.max(0, value));
  }

  const points = Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));
  if (!points.length) throw new Error("CAISO OASIS curtailment CSV had no wind/solar rows");

  return {
    regionId: "caiso",
    profile: timeOfDayAverageGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: points.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    sourceNote: "CAISO OASIS SLD_REN_CURTAIL direct wind+solar curtailment",
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

  const params = new URLSearchParams({
    api_key: apiKey,
    frequency: "hourly",
    "data[0]": "value",
    "facets[respondent][]": "CISO",
    "facets[fueltype][]": "SUN",
    start,
    end,
    "sort[0][column]": "period",
    "sort[0][direction]": "asc",
    length: "5000",
  });
  const url = `${API_BASE}?${params.toString()}`;
  const raw = await fetchJSON<EIAResponse>(url);
  return parseCaiso(raw);
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>("caiso", run, {
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("caiso loader failed", err);
      process.exit(1);
    });
}
