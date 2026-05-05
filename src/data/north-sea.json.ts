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
  windPoints: CurtailmentPoint[];
  solarPoints: CurtailmentPoint[];
  windMwTotal: number;
  solarMwTotal: number;
}

/** Pure parser: combines multiple 7-day response pages into calibrated CurtailmentPoints with per-fuel totals. */
export function parseNorthSea(pages: AGWSResponse[]): NorthSeaParsed {
  const windTotals = new Map<string, number>();
  const solarTotals = new Map<string, number>();
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
      if (isWind) {
        windTotals.set(timestamp, (windTotals.get(timestamp) ?? 0) + curtailedMw);
        windMwTotal += curtailedMw;
      } else {
        solarTotals.set(timestamp, (solarTotals.get(timestamp) ?? 0) + curtailedMw);
        solarMwTotal += curtailedMw;
      }
    }
  }

  const windPoints = Array.from(windTotals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));

  const solarPoints = Array.from(solarTotals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));

  // Combined for backward compat
  const combined = new Map<string, number>();
  for (const p of windPoints) combined.set(p.utcTimestamp, (combined.get(p.utcTimestamp) ?? 0) + p.mw);
  for (const p of solarPoints) combined.set(p.utcTimestamp, (combined.get(p.utcTimestamp) ?? 0) + p.mw);
  const points = Array.from(combined.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));

  return { points, windPoints, solarPoints, windMwTotal, solarMwTotal };
}

const run = async (): Promise<{ wind: RegionData; solar: RegionData }> => {
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

  const { windPoints, solarPoints, windMwTotal, solarMwTotal } = parseNorthSea(pages);
  const denom = windMwTotal + solarMwTotal;
  const fuelShare = denom > 0
    ? { wind: windMwTotal / denom, solar: solarMwTotal / denom }
    : undefined;

  const lastUpdated = (windPoints.at(-1) ?? solarPoints.at(-1))?.utcTimestamp ?? new Date().toISOString();

  const noteBase = fuelShare
    ? `Elexon BMRS AGWS × 6.9% curtailment (observed 30d split: wind ${(fuelShare.wind * 100).toFixed(0)}% / solar ${(fuelShare.solar * 100).toFixed(0)}%)`
    : "Elexon BMRS AGWS × 6.9% calibrated curtailment rate (UK 2024 actuals: 6.6 TWh / 95 TWh)";

  return {
    wind: {
      regionId: "north-sea-wind",
      profile: timeOfDayAverageGW(windPoints),
      latestProfile: latestCompleteUtcDayProfileGW(windPoints),
      totalTWh: totalTWh30d(windPoints),
      peakGW: peakGW(windPoints),
      lastUpdated,
      lastSuccessAt: lastUpdated,
      sourceNote: noteBase + " — wind share",
    },
    solar: {
      regionId: "north-sea-solar",
      profile: timeOfDayAverageGW(solarPoints),
      latestProfile: latestCompleteUtcDayProfileGW(solarPoints),
      totalTWh: totalTWh30d(solarPoints),
      peakGW: peakGW(solarPoints),
      lastUpdated,
      lastSuccessAt: lastUpdated,
      sourceNote: noteBase + " — solar share",
    },
  };
};

function adaptCachedNorthSeaToPerFuel(
  cached: { wind: RegionData; solar: RegionData } | RegionData,
): { wind: RegionData; solar: RegionData } {
  if (cached && "wind" in cached && "solar" in cached) {
    return cached as { wind: RegionData; solar: RegionData };
  }
  const old = cached as RegionData;
  const windShare = old.fuelShare?.wind ?? 0.85;
  const solarShare = old.fuelShare?.solar ?? 0.15;
  return {
    wind: {
      ...old,
      regionId: "north-sea-wind",
      totalTWh: old.totalTWh * windShare,
      peakGW: old.peakGW * windShare,
      sourceNote: (old.sourceNote ?? "") + " — wind share (adapted from cached aggregate)",
    },
    solar: {
      ...old,
      regionId: "north-sea-solar",
      totalTWh: old.totalTWh * solarShare,
      peakGW: old.peakGW * solarShare,
      sourceNote: (old.sourceNote ?? "") + " — solar share (adapted from cached aggregate)",
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  withFallback<{ wind: RegionData; solar: RegionData }>("north-sea", run, {
    regionTier: "live" as const,
    tagLive: (r) => r,
    tagCached: (c) => adaptCachedNorthSeaToPerFuel(c as { wind: RegionData; solar: RegionData } | RegionData),
  })
    .then((d) => process.stdout.write(JSON.stringify(d)))
    .catch((err) => {
      console.error("north-sea loader failed", err);
      process.exit(1);
    });
}
