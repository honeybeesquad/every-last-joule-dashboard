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

/**
 * AEMO WEM (Western Australia / SWIS) Facility SCADA loader.
 *
 * Endpoint: https://data.wa.aemo.com.au/public/market-data/wemde/facilityScada/previous/
 *   - Daily zip per UTC date, e.g. FacilityScada_20260424.zip
 *   - Each zip contains one JSON: SCADA_<YYYY>-<MM>-<DD>.json
 *   - JSON shape: { data: { facilityScadaDispatchIntervals: [...] } }
 *   - Each entry: { dispatchInterval: ISO+08:00, code: <DUID>, quantity: <MWh> }
 *   - `quantity` is generation energy for a 5-minute interval (MWh), so
 *     instantaneous MW = quantity × 12.
 *
 * Strategy: AEMO WEM does not publish a SEMIDISPATCHCAP-style direct curtailment
 * signal (unlike NEM Next-Day Dispatch). Instead, mirror the static-loader
 * approach: take observed wind+solar generation × an 8% calibrated curtailment
 * rate. The 8% rate derives from the AEMO WA 2024 published anchor (~0.4 TWh
 * RES curtailment against ~5 TWh of solar+wind generation in SWIS); SWIS is an
 * islanded grid so its curtailment fraction runs higher than NEM's ~3%.
 *
 * Output remains live-tier (T1a-live-tso) because the underlying generation
 * series is hourly TSO-published; only the multiplier is calibrated. This
 * matches the precedent set by the south-africa loader (Eskom Total_Hourly_
 * Generation × 12% calibrated curtailment).
 */

const REGION_ID = "wa-swis";
const DIRECTORY_URL = "https://data.wa.aemo.com.au/public/market-data/wemde/facilityScada/previous/";
const RATE = 0.08; // 8% calibrated curtailment rate (WA-SWIS 2024 anchor: 0.4 TWh/yr)

/**
 * SWIS large wind facility DUIDs from AEMO WEM Registered Facilities (2025).
 * Codes that are no longer on the system are tolerated by the parser
 * (they simply won't appear in the SCADA stream).
 */
const WIND_CODES = new Set([
  "ALBANY_WF1",
  "ALINTA_WWF",
  "BADGINGARRA_WF1",
  "BLAIRFOX_BEROSRD_WF1",
  "BLAIRFOX_KARAKIN_WF1",
  "BLAIRFOX_WESTHILLS_WF3",
  "BREMER_BAY_WF1",
  "DCWL_DENMARK_WF1",
  "EDWFMAN_WF1",
  "FLATROCKS_WF1",
  "GRASMERE_WF1",
  "INVESTEC_COLLGAR_WF1",
  "KALBARRI_WF1",
  "MWF_MUMBIDA_WF1",
  "SKYFRM_MTBARKER_WF1",
  "WARRADARGE_WF1",
  "YANDIN_WF1",
]);

/** SWIS large solar/PV facility DUIDs from AEMO WEM Registered Facilities. */
const SOLAR_CODES = new Set([
  "AMBRISOLAR_PV1",
  "GREENOUGH_RIVER_PV1",
  "MERSOLAR_PV1",
  "NORTHAM_SF_PV1",
  "SBSOLAR1_CUNDERDIN_PV1",
  "NAMKKN_MERR_SG1",
]);

interface WemScadaInterval {
  dispatchInterval: string;
  code: string;
  quantity: number;
}

interface WemScadaResponse {
  data?: {
    facilityScadaDispatchIntervals?: WemScadaInterval[];
  };
}

function unzipJson(zipBytes: Uint8Array): string {
  const dir = mkdtempSync(join(tmpdir(), "wem-"));
  const zipPath = join(dir, "report.zip");
  try {
    writeFileSync(zipPath, zipBytes);
    return execFileSync("unzip", ["-p", zipPath], { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function listRecentZips(html: string, limit = 30): string[] {
  // AEMO WEM directory listings emit absolute paths in HREFs:
  // <A HREF="/public/market-data/wemde/facilityScada/previous/FacilityScada_20260424.zip">
  // Match either an absolute or bare filename to be defensive against future
  // template changes; new URL(href, DIRECTORY_URL) handles both.
  const matches = Array.from(
    html.matchAll(/href="([^"]*FacilityScada_\d{8}\.zip)"/gi),
  ).map((m) => m[1]);
  // The listing is sorted oldest-first; take the last `limit` entries to get
  // the most recent ~30 days.
  return matches.slice(-limit).map((href) => new URL(href, DIRECTORY_URL).toString());
}

export interface WemScadaParsed {
  /** Per-5-min CurtailmentPoint[] summed across all RE facilities at each timestamp. */
  points: CurtailmentPoint[];
  /** 30-day-window wind curtailment-proxy MWh total, for fuelShare derivation. */
  windMwhTotal: number;
  /** 30-day-window solar curtailment-proxy MWh total. */
  solarMwhTotal: number;
}

/**
 * Parse one daily SCADA JSON. Sums wind+solar generation across all matched
 * facilities at each 5-minute timestamp before applying the calibration rate;
 * this preserves the regional curtailment-proxy MW magnitude. Without this
 * sum, hourlyAverage downstream would average per-facility values and dilute
 * the signal by the count of active facilities.
 */
export function parseWemScadaJson(jsonStr: string): WemScadaParsed {
  const parsed = JSON.parse(jsonStr) as WemScadaResponse;
  const intervals = parsed.data?.facilityScadaDispatchIntervals ?? [];

  // Bucket per UTC timestamp. We track wind+solar separately so we can
  // accumulate the per-fuel MWh totals for the observed fuelShare.
  const sums = new Map<string, { windMw: number; solarMw: number }>();
  let windMwhTotal = 0;
  let solarMwhTotal = 0;

  for (const interval of intervals) {
    const isWind = WIND_CODES.has(interval.code);
    const isSolar = SOLAR_CODES.has(interval.code);
    if (!isWind && !isSolar) continue;
    const energyMwh = Number(interval.quantity);
    if (!Number.isFinite(energyMwh) || energyMwh <= 0) continue;

    const utcTimestamp = new Date(interval.dispatchInterval).toISOString();
    if (Number.isNaN(new Date(utcTimestamp).getTime())) continue;

    // 5-minute MWh × 12 → instantaneous MW
    const generatedMw = energyMwh * 12;
    const curtailedMw = generatedMw * RATE;
    const curtailedMwh = energyMwh * RATE;

    const bucket = sums.get(utcTimestamp) ?? { windMw: 0, solarMw: 0 };
    if (isWind) {
      bucket.windMw += curtailedMw;
      windMwhTotal += curtailedMwh;
    } else {
      bucket.solarMw += curtailedMw;
      solarMwhTotal += curtailedMwh;
    }
    sums.set(utcTimestamp, bucket);
  }

  const points: CurtailmentPoint[] = Array.from(sums.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, b]) => ({
      utcTimestamp,
      mw: b.windMw + b.solarMw,
    }));

  return { points, windMwhTotal, solarMwhTotal };
}

const run = async (): Promise<RegionData> => {
  const listing = await fetchText(DIRECTORY_URL);
  const urls = listRecentZips(listing, 30);
  if (!urls.length) throw new Error("AEMO WEM directory listing returned no daily SCADA zips");

  const allPoints: CurtailmentPoint[] = [];
  let windMwhTotal = 0;
  let solarMwhTotal = 0;

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`WEM fetch skipped: ${url}: HTTP ${res.status}`);
        continue;
      }
      const jsonStr = unzipJson(new Uint8Array(await res.arrayBuffer()));
      const parsed = parseWemScadaJson(jsonStr);
      allPoints.push(...parsed.points);
      windMwhTotal += parsed.windMwhTotal;
      solarMwhTotal += parsed.solarMwhTotal;
    } catch (err) {
      console.warn(`WEM processing skipped: ${url}: ${(err as Error).message}`);
    }
  }

  if (allPoints.length === 0) {
    throw new Error("AEMO WEM returned no usable wind or solar SCADA points");
  }

  // Bucket 5-minute MW values to hourly averages (per-hour mean of the 12
  // five-minute regional-total MW samples). The downstream profile helpers
  // (timeOfDayAverageGW, totalTWh30d, peakGW, latestCompleteUtcDayProfileGW)
  // assume hourly cadence with default intervalHours=1.
  const points = hourlyAverage(allPoints);

  if (points.length === 0) {
    throw new Error("AEMO WEM produced points before bucketing but none after; timestamp parse failed");
  }

  const denom = windMwhTotal + solarMwhTotal;
  const fuelShare = denom > 0
    ? { wind: windMwhTotal / denom, solar: solarMwhTotal / denom }
    : { wind: 0.3, solar: 0.7 }; // typical SWIS mix fallback

  return {
    regionId: REGION_ID,
    profile: timeOfDayAverageGW(points),
    latestProfile: latestCompleteUtcDayProfileGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: points.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    lastSuccessAt: new Date().toISOString(),
    sourceNote: `AEMO WEM Facility SCADA hourly RE × 8% calibrated curtailment (WA-SWIS 2024 anchor: 0.4 TWh/yr; SWIS is islanded so curtailment-rate higher than NEM; observed split: wind ${(fuelShare.wind * 100).toFixed(0)}% / solar ${(fuelShare.solar * 100).toFixed(0)}%)`,
    fuelShare,
  };
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>(REGION_ID, run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("wa-swis loader failed", err);
      process.exit(1);
    });
}

export const buildWaSwisData = () => run();
