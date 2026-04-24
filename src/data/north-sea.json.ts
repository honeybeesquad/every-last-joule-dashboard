import { fetchJSON } from "../lib/fetch.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW, latestCompleteUtcDayProfileGW } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData, CurtailmentPoint } from "../lib/types.js";
import { pathToFileURL } from "url";

const CURTAILMENT_RATE = 0.069;
const API = "https://data.elexon.co.uk/bmrs/api/v1/datasets/AGWS";

interface AGWSRecord {
  psrType: "Wind Onshore" | "Wind Offshore" | "Solar" | string;
  quantity: number;
  startTime: string;
}

interface AGWSResponse {
  data: AGWSRecord[];
}

export interface NorthSeaParsed {
  points: CurtailmentPoint[];
  windMwTotal: number;
  solarMwTotal: number;
}

/** Pure parser: combines multiple 7-day response pages into calibrated CurtailmentPoints with per-fuel totals. */
export function parseNorthSea(pages: AGWSResponse[]): NorthSeaParsed {
  const totals = new Map<string, number>();
  let windMwTotal = 0;
  let solarMwTotal = 0;
  const windTypes = new Set(["Wind Onshore", "Wind Offshore"]);

  for (const page of pages) {
    for (const record of page.data ?? []) {
      const quantity = Number(record.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) continue;
      const isWind = windTypes.has(record.psrType);
      const isSolar = record.psrType === "Solar";
      if (!isWind && !isSolar) continue;
      const curtailedMw = quantity * CURTAILMENT_RATE;
      const timestamp = new Date(record.startTime).toISOString();
      totals.set(timestamp, (totals.get(timestamp) ?? 0) + curtailedMw);
      if (isWind) windMwTotal += curtailedMw;
      else solarMwTotal += curtailedMw;
    }
  }

  const points = Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));
  return { points, windMwTotal, solarMwTotal };
}

const run = async (): Promise<RegionData> => {
  const now = new Date();
  const pages: AGWSResponse[] = [];

  for (let i = 4; i >= 1; i--) {
    const to = new Date(now.getTime() - (i - 1) * 7 * 24 * 3600 * 1000);
    const from = new Date(now.getTime() - i * 7 * 24 * 3600 * 1000);
    const iso = (d: Date) => d.toISOString().slice(0, 19) + "Z";
    const params = new URLSearchParams({
      publishDateTimeFrom: iso(from),
      publishDateTimeTo: iso(to),
      format: "json",
    });
    const page = await fetchJSON<AGWSResponse>(`${API}?${params.toString()}`);
    pages.push(page);
  }

  const { points, windMwTotal, solarMwTotal } = parseNorthSea(pages);
  const denom = windMwTotal + solarMwTotal;
  const fuelShare = denom > 0
    ? { wind: windMwTotal / denom, solar: solarMwTotal / denom }
    : undefined;
  return {
    regionId: "north-sea",
    profile: timeOfDayAverageGW(points),
    latestProfile: latestCompleteUtcDayProfileGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: points.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    sourceNote: fuelShare
      ? `Elexon BMRS AGWS wind+solar × 6.9% curtailment (observed 30d split: wind ${(fuelShare.wind * 100).toFixed(0)}% / solar ${(fuelShare.solar * 100).toFixed(0)}%)`
      : "Elexon BMRS AGWS (wind + solar) × 6.9% calibrated curtailment rate (UK 2024 actuals: 6.6 TWh / 95 TWh)",
    ...(fuelShare ? { fuelShare } : {}),
  };
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  withFallback<RegionData>("north-sea", run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((d) => process.stdout.write(JSON.stringify(d)))
    .catch((err) => {
      console.error("north-sea loader failed", err);
      process.exit(1);
    });
}
