import { pathToFileURL } from "url";
import { execFileSync } from "child_process";
import { withFallback } from "../lib/resilient.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import { coerceLastSuccessAt } from "../lib/freshness.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const MALAYSIA_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "Accept": "application/json, text/plain, */*",
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Referer": "https://www.gso.org.my/",
};

function curlPost(url: string, body: string): string {
  const headerArgs = Object.entries(MALAYSIA_HEADERS)
    .flatMap(([k, v]) => ["-H", `${k}: ${v}`]);
  const args = ["curl", "-s", url, ...headerArgs, "-d", body];
  return execFileSync("curl", args, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
}

const REGION_ID = "malaysia";

async function run(): Promise<RegionData> {
  try {
    const genMixRaw = curlPost(
      "https://www.gso.org.my/LandingPage.aspx/GetGenMixData",
      "{}",
    );
    const solarRaw = curlPost(
      "https://www.gso.org.my/LandingPage.aspx/GetSolarActualData",
      "{}",
    );

    let genMixParts: string[];
    let solarParts: string[];
    try {
      genMixParts = (JSON.parse(genMixRaw) as { d: string }).d.split("$");
      solarParts = (JSON.parse(solarRaw) as { d: string }).d.split("$");
    } catch {
      throw new Error("GSO returned non-JSON response — live feed unavailable");
    }

    const solarTicks: number[][] = [];
    for (let i = 0; i < 5; i++) {
      solarTicks.push(solarParts[i].split(",").filter((x) => x.trim() !== "").map(Number));
    }
    const n = Math.min(...solarTicks.map((v) => v.length));
    const distSolarTicks: number[] = Array.from({ length: n }, (_, i) =>
      solarTicks.reduce((sum, arr) => sum + arr[i], 0)
    );
    const ticksPerDay = 48;
    const dayCount = Math.floor(distSolarTicks.length / ticksPerDay);

    const dailyProfiles: number[][] = [];
    for (let d = 0; d < dayCount; d++) {
      dailyProfiles.push(distSolarTicks.slice(d * ticksPerDay, (d + 1) * ticksPerDay));
    }

    const avg48: number[] = Array(48).fill(0);
    for (const day of dailyProfiles) {
      for (let i = 0; i < 48; i++) avg48[i] += day[i];
    }
    for (let i = 0; i < 48; i++) avg48[i] /= dayCount;

    const profile24: number[] = Array(24).fill(0);
    for (let i = 0; i < 24; i++) {
      profile24[i] = (avg48[i * 2] + avg48[i * 2 + 1]) / 2000;
    }

    const peakGW = Math.max(...profile24);
    const dailyMWh = profile24.reduce((sum, gw) => sum + gw * 1000, 0);

    const measuredAnnualTWh = (dailyMWh * 365) / 1e6;
    const anchorTWh = 0.15;
    const scale = anchorTWh / measuredAnnualTWh;

    const profile: number[] = profile24.map((gw) => gw * scale);
    const scaledPeakGW = peakGW * scale;

    const lastUpdatedRaw: string = (solarParts[8] as string) ?? new Date().toISOString();
    const lastUpdated = lastUpdatedRaw.endsWith("Z") ? lastUpdatedRaw : `${lastUpdatedRaw}Z`;

    const base: RegionData = {
      regionId: REGION_ID,
      profile,
      latestProfile: null,
      totalTWh: anchorTWh,
      peakGW: scaledPeakGW,
      lastUpdated,
      lastSuccessAt: coerceLastSuccessAt(new Date().toISOString()),
      sourceNote: `GSO Malaysia Grid System Operator real-time solar actuals (Peninsular); diurnal profile from ${dayCount}-day average of distribution solar (LSS+NEM+FiT+SELCO); annual anchor from IRENA Malaysia Renewable Energy Statistics 2024 + Malaysia Energy Commission ST 2024 Annual Report (~0.15 TWh/yr provisional solar curtailment, ~2% of Peninsular solar generation). T1b: no published curtailment rate; domestic anchor applied via measured diurnal shape.`,
    };

    return applyUncertainty(base, { regionTier: "live-domestic-anchored" });
  } catch (err) {
    return buildTypicalSolarRegion(
      REGION_ID,
      4,
      0.15,
      `Typical-shape fallback: GSO Malaysia live feed unavailable (${(err as Error).message}); calibration anchor ~0.15 TWh/yr Peninsular solar curtailment.`,
      "2024",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, run)
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("malaysia loader failed", err); process.exit(1); });
}

export const buildMalaysiaData = () => run();
