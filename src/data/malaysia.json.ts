import { pathToFileURL } from "url";
import { fetchJSON } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW, latestCompleteUtcDayProfileGW } from "../lib/profile.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

const REGION_ID = "malaysia";
const GSO_GEN_URL = "https://www.gso.org.my/SystemData/CurrentGen.aspx/GetChartDataSource";

/**
 * Malaysia solar curtailment rate.
 * Anchor: ~0.15 TWh/yr Suruhanjaya Tenaga (ST) 2024 / IRENA Malaysia 2024.
 * Estimated Peninsular Malaysia solar generation: ~15.2 TWh/yr (4 GW × 19% CF).
 * Rate = 0.15 / 15.2 ≈ 0.0099 → rounded to 0.01 (~1%).
 */
const CURTAILMENT_RATE = 0.01;

/** GSO API returns timestamps in Asia/Kuala_Lumpur (UTC+8) without timezone suffix. */
const MALAYSIA_UTC_OFFSET_HOURS = 8;

interface GsoGenPoint {
  DT: string;       // "2026-06-18T00:00:00" (local KL time)
  Coal: number;
  Gas: number;
  CoGen: number;
  Oil: number;
  Hydro: number;
  Solar: number;
}

interface GsoResponse {
  d: string;  // double-encoded JSON string
}

/** Convert GSO local timestamp (UTC+8) to UTC ISO string. */
function gsoDtToUtc(dtLocal: string): string {
  // Parse "2026-06-18T00:00:00" as UTC+8
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})$/.exec(dtLocal);
  if (!match) throw new Error(`Invalid GSO timestamp: ${dtLocal}`);
  // Append +08:00 for Malaysia timezone
  const localDate = new Date(match[1] + "+08:00");
  if (isNaN(localDate.getTime())) throw new Error(`Invalid GSO timestamp: ${dtLocal}`);
  // Convert to UTC and format
  return localDate.toISOString();
}

/** Format date as DD/MM/YYYY for GSO API. */
function toGsoDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Fetch GSO generation data for a single date. */
async function fetchGsoGenForDate(date: Date): Promise<GsoGenPoint[]> {
  const dateStr = toGsoDate(date);
  const resp = await fetchJSON<GsoResponse>(GSO_GEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Fromdate: dateStr, Todate: dateStr }),
    timeoutMs: 15000,
    retries: 2,
  });
  // GSO double-encodes: {"d": "[...JSON array...]"}
  return JSON.parse(resp.d) as GsoGenPoint[];
}

/** Fetch GSO solar generation for the last N days, return as CurtailmentPoints. */
async function fetchGsoSolarCurtailment(days: number): Promise<CurtailmentPoint[]> {
  const points: CurtailmentPoint[] = [];
  const now = new Date();

  for (let offset = 0; offset < days; offset++) {
    const d = new Date(now.getTime() - offset * 24 * 3600 * 1000);
    let genPoints: GsoGenPoint[];
    try {
      genPoints = await fetchGsoGenForDate(d);
    } catch (err) {
      console.warn(`[malaysia] GSO fetch failed for ${toGsoDate(d)}: ${(err as Error).message}`);
      continue;
    }

    for (const pt of genPoints) {
      if (!pt.DT || pt.Solar == null) continue;
      try {
        const utcTs = gsoDtToUtc(pt.DT);
        // Curtailment MW = generation MW × rate
        const curtailedMw = pt.Solar * CURTAILMENT_RATE;
        points.push({ utcTimestamp: utcTs, mw: Math.max(0, curtailedMw) });
      } catch {
        // Skip bad timestamps
      }
    }
  }

  return points;
}

async function run({ probe = true } = {}): Promise<RegionData> {
  if (probe) {
    try {
      const points = await fetchGsoSolarCurtailment(30);

      if (points.length === 0) {
        throw new Error("GSO API returned no solar generation data");
      }

      const lastTs = points[points.length - 1].utcTimestamp;
      const sourceNote =
        `GSO Malaysia live solar generation (gso.org.my, 10-min cadence) ` +
        `× ${ (CURTAILMENT_RATE * 100).toFixed(1)}% calibrated curtailment rate ` +
        `(Suruhanjaya Tenaga / IRENA 2024 anchor ~0.15 TWh/yr Peninsular Malaysia solar curtailment). ` +
        `${points.length} points across 30 days. Latest: ${lastTs}.`;

      const result: RegionData = {
        regionId: REGION_ID,
        profile: timeOfDayAverageGW(points),
        latestProfile: latestCompleteUtcDayProfileGW(points),
        totalTWh: totalTWh30d(points),
        peakGW: peakGW(points),
        lastUpdated: lastTs,
        lastSuccessAt: new Date().toISOString(),
        sourceNote,
      };

      // "anchored" tier: live generation shape × published curtailment rate
      return applyUncertainty(result, { regionTier: "anchored" });
    } catch (err) {
      console.error(`[malaysia] GSO live fetch failed: ${(err as Error).message}`);
      // Fall through to fallback
    }
  }

  // Fallback: typical solar profile
  return buildTypicalSolarRegion(
    REGION_ID,
    4,    // peakHour UTC (Malaysia solar noon ~4 UTC = 12 noon KL)
    0.15, // annualTWh anchor
    `Typical-shape fallback: GSO live feed unavailable (${probe ? "probe failed" : "test mode"}). ` +
    `Calibration anchor ~0.15 TWh/yr Peninsular solar curtailment (Suruhanjaya Tenaga / IRENA 2024).`,
    "2024",
  );
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "anchored" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("malaysia loader failed", err);
      process.exit(1);
    });
}

export const buildMalaysiaData = () => run({ probe: false });
