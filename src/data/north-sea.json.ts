import { fetchJSON } from "../lib/fetch.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW } from "../lib/profile.js";
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

/** Pure parser: combines multiple 7-day response pages and returns calibrated CurtailmentPoints. Exported for tests. */
export function parseNorthSea(pages: AGWSResponse[]): CurtailmentPoint[] {
  const totals = new Map<string, number>();
  const allowedTypes = new Set(["Wind Onshore", "Wind Offshore", "Solar"]);

  for (const page of pages) {
    for (const record of page.data ?? []) {
      if (!allowedTypes.has(record.psrType)) continue;
      const quantity = Number(record.quantity);
      if (!Number.isFinite(quantity)) continue;

      const timestamp = new Date(record.startTime).toISOString();
      const current = totals.get(timestamp) ?? 0;
      totals.set(timestamp, current + Math.max(0, quantity));
    }
  }

  return Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, rawMw]) => ({
      utcTimestamp,
      mw: Math.max(0, rawMw) * CURTAILMENT_RATE,
    }));
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

  const points = parseNorthSea(pages);
  return {
    regionId: "north-sea",
    profile: timeOfDayAverageGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: points.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    sourceNote:
      "Elexon BMRS AGWS (wind + solar) × 6.9% calibrated curtailment rate (UK 2024 actuals: 6.6 TWh / 95 TWh)",
  };
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  withFallback<RegionData>("north-sea", run, {
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((d) => process.stdout.write(JSON.stringify(d)))
    .catch((err) => {
      console.error("north-sea loader failed", err);
      process.exit(1);
    });
}
