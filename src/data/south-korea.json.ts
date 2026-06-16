import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import {
  solarProfile,
  windProfile,
} from "../lib/typical-profiles.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import { coerceLastSuccessAt } from "../lib/freshness.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "south-korea";
const SOURCE_URL = "https://epsis.kpx.or.kr/epsisnew/selectKnreMain.do";
const CHART_URL =
  "https://epsis.kpx.or.kr/epsisnew/selectKnreUtilRtoChartAjax.ajax";

// South Korea installed VRE capacity (MW) as of end-2024
// Source: KPX EPSIS 2024 annual / IRENA 2024
const SOLAR_INSTALLED_MW = 27_000;
const WIND_INSTALLED_MW = 2_000;

// Curtailment rate estimates based on literature:
// - Solar: IEA/KPX report ~5% curtailment for mainland Korea (excluding Jeju)
// - Wind: ~2% curtailment (lower due to smaller fleet, better grid integration)
const SOLAR_CURTAILMENT_RATE = 0.05;
const WIND_CURTAILMENT_RATE = 0.02;

/**
 * Parse EPSIS chart AJAX response to extract province utilization rates.
 *
 * Response format is JavaScript (not JSON) that builds chart data. The key
 * pattern is: `valueList = "13.2/13.5/.../13.3";`
 */
function parseEpsisUtilization(jsResponse: string): number[] {
  // Extract the first valueList from the response (annual or latest month)
  const match = jsResponse.match(/valueList\s*=\s*"([^"]+)"/);
  if (!match) {
    throw new Error("Could not parse valueList from EPSIS response");
  }
  const values = match[1].split("/").map(Number);
  if (values.some((v) => Number.isNaN(v))) {
    throw new Error(`Invalid numeric values in EPSIS valueList: ${match[1]}`);
  }
  return values;
}

/**
 * Calculate the simple average of province-level utilization rates.
 * This is an approximation — provinces are not weighted by installed
 * capacity because EPSIS does not publish provincial capacity breakdown.
 */
function averageUtilization(rates: number[]): number {
  const nonzero = rates.filter((r) => r > 0);
  if (nonzero.length === 0) return 0;
  return nonzero.reduce((a, b) => a + b, 0) / nonzero.length;
}

/**
 * Fetch utilization rate data from EPSIS for a given fuel type.
 *
 * @param genType 1 = solar, 2 = wind
 * @param year    Calendar year to query (default: current year)
 */
async function fetchEpsisUtilization(
  genType: 1 | 2,
  year = new Date().getFullYear(),
): Promise<{ utilizationPct: number; year: number }> {
  const body = new URLSearchParams({
    selDate: "year",
    beginDate: String(year),
    endDate: String(year),
    beginMonth: "01",
    endMonth: "01",
    mapCd: "0",
    dataType: "U",
    genType: String(genType),
  });

  const jsText = await fetchText(CHART_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0",
      Referer: SOURCE_URL,
    },
    body: body.toString(),
    timeoutMs: 15_000,
    retries: 2,
  });

  const rates = parseEpsisUtilization(jsText);
  return { utilizationPct: averageUtilization(rates), year };
}

/**
 * Build a RegionData from utilization rate and installed capacity.
 *
 * Uses typical hourly profile shapes scaled by (capacity × utilization)
 * to estimate generation, then applies curtailment rate to get curtailed MW.
 */
function buildRegionFromUtilization(
  fuel: "solar" | "wind",
  utilizationPct: number,
  installedMW: number,
  curtailmentRate: number,
  year: number,
  sourceNote: string,
): RegionData {
  // Capacity factor as decimal
  const cf = utilizationPct / 100;

  // Annual generation TWh = capacity (GW) × CF × 8760 h / 1000
  const annualTWh = (installedMW / 1000) * cf * 8760 / 1000;

  // Curtailment TWh = generation × curtailment rate
  const curtailedTWh = annualTWh * curtailmentRate;

  // Peak hour in UTC: Seoul is UTC+9, so solar peak ~11:30 KST = 02:30 UTC
  // Wind peak is flatter, use ~15 UTC
  const peakHourUtc = fuel === "solar" ? 3 : 15;

  // Build profile shape scaled to curtailed TWh
  const shape =
    fuel === "solar"
      ? solarProfile(peakHourUtc, curtailedTWh)
      : windProfile(peakHourUtc, curtailedTWh);

  const lastUpdated = `${year}`;
  const base: RegionData = {
    regionId: `${REGION_ID}-${fuel}`,
    profile: shape,
    latestProfile: null,
    totalTWh: (curtailedTWh * 30) / 365,
    peakGW: Math.max(...shape),
    lastUpdated,
    lastSuccessAt: coerceLastSuccessAt(lastUpdated),
    sourceNote,
  };

  return applyUncertainty(base, {
    regionTier: fuel === "solar" ? "estimated" : "estimated",
    profileKind: fuel,
  });
}

async function run(): Promise<{ wind: RegionData; solar: RegionData }> {
  const year = new Date().getFullYear();

  // Fetch both solar and wind utilization rates in parallel
  const [solarUtil, windUtil] = await Promise.all([
    fetchEpsisUtilization(1, year).catch((err) => {
      console.warn(
        `EPSIS solar fetch failed, trying previous year: ${(err as Error).message}`,
      );
      return fetchEpsisUtilization(1, year - 1);
    }),
    fetchEpsisUtilization(2, year).catch((err) => {
      console.warn(
        `EPSIS wind fetch failed, trying previous year: ${(err as Error).message}`,
      );
      return fetchEpsisUtilization(2, year - 1);
    }),
  ]);

  const solarNote = [
    `KPX EPSIS KNRE ${solarUtil.year} mainland solar utilization ${solarUtil.utilizationPct.toFixed(1)}%`,
    `× ${SOLAR_INSTALLED_MW} MW installed × ${SOLAR_CURTAILMENT_RATE * 100}% curtailment rate`,
    `(IEA/KPX 2024 estimate: ~0.5 TWh/yr curtailed solar, mainland excl. Jeju)`,
  ].join("; ");

  const windNote = [
    `KPX EPSIS KNRE ${windUtil.year} mainland wind utilization ${windUtil.utilizationPct.toFixed(1)}%`,
    `× ${WIND_INSTALLED_MW} MW installed × ${WIND_CURTAILMENT_RATE * 100}% curtailment rate`,
    `(Wind fleet small; curtailment rate from IEA Korea 2024 review)`,
  ].join("; ");

  return {
    solar: buildRegionFromUtilization(
      "solar",
      solarUtil.utilizationPct,
      SOLAR_INSTALLED_MW,
      SOLAR_CURTAILMENT_RATE,
      solarUtil.year,
      solarNote,
    ),
    wind: buildRegionFromUtilization(
      "wind",
      windUtil.utilizationPct,
      WIND_INSTALLED_MW,
      WIND_CURTAILMENT_RATE,
      windUtil.year,
      windNote,
    ),
  };
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<{ wind: RegionData; solar: RegionData }>(REGION_ID, run, {
    regionTier: "estimated" as const,
    tagLive: (r) => r,
    tagCached: (c) => c as { wind: RegionData; solar: RegionData },
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("south-korea loader failed", err);
      process.exit(1);
    });
}

export const buildSouthKoreaData = run;
