import { buildEiaIsoRegionPerFuel, adaptCachedAggregateToPerFuel } from "../lib/eia-iso.js";
import { fetchText } from "../lib/fetch.js";
import { mapWithConcurrency } from "../lib/concurrency.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW, latestCompleteUtcDayProfileGW } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

const loader = buildEiaIsoRegionPerFuel({
  regionId: "spp",
  respondent: "SWPP",
  displayName: "SPP",
  windRate: 0.04,
  solarRate: 0.03,
  fallbackSplit: { wind: 0.85, solar: 0.15 },
});

export const parseSpp = loader.parsePerFuel;

const VER_BASE = "https://portal.spp.org/file-browser-api/download/ver-curtailments";

/** `.../ver-curtailments?path=/2026/11/VER-Curtailments-20261119.csv` for 2026-11-19 (SPP's Central operating day). */
export function sppVerCurtailmentsUrl(ymd: string): string {
  return `${VER_BASE}?path=/${ymd.slice(0, 4)}/${ymd.slice(4, 6)}/VER-Curtailments-${ymd}.csv`;
}

const COLUMNS = [
  "GMTIntervalEnding",
  "WindRedispatchCurtailments",
  "WindManualCurtailments",
  "SolarRedispatchCurtailments",
  "SolarManualCurtailments",
] as const;

/** `11/19/2026 06:05:00.000000` (GMT) to epoch ms. */
function parseGmt(s: string): number {
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/);
  if (!m) return NaN;
  return Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2]), Number(m[4]), Number(m[5]));
}

const FIVE_MIN_MS = 5 * 60_000;

/**
 * One operating day of SPP's VER Curtailments report, as hourly curtailment by
 * fuel. Each row is a 5-minute interval per balancing authority (SPP, and
 * since April 2026 SPP RTO West as SWPW) with curtailed MW in three columns per
 * fuel: Redispatch, Manual and CurtailedForEnergy. Curtailment here is
 * Redispatch + Manual, summed over every BA. CurtailedForEnergy is left out:
 * across 35 days of the report (17 Oct to 20 Nov 2026, about 20,000 rows) it is
 * never larger than Redispatch and never non-zero when Redispatch is zero, so
 * it reads as a subset of Redispatch, and adding it would double count. SPP's
 * portal does not document the columns, so that is an inference from the data.
 *
 * Rows are bucketed by interval start (GMTIntervalEnding minus 5 minutes) into
 * UTC hours; an hour's MWh is the sum of its intervals' MW / 12, which is its
 * average MW. Rows with blank values (SPP leaves a few per day empty) add
 * nothing. Also returns how many distinct intervals carried values, so a
 * caller can drop a partial day.
 */
export function parseSppVerCurtailments(csv: string): {
  wind: CurtailmentPoint[];
  solar: CurtailmentPoint[];
  intervals: number;
} {
  const lines = csv.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) throw new Error("SPP VER curtailments: empty file");
  const header = lines[0].split(",").map((h) => h.trim());
  const idx = Object.fromEntries(COLUMNS.map((c) => [c, header.indexOf(c)])) as Record<(typeof COLUMNS)[number], number>;
  const missing = COLUMNS.filter((c) => idx[c] < 0);
  if (missing.length > 0) throw new Error(`SPP VER curtailments: missing column(s) ${missing.join(", ")}`);

  const wind = new Map<number, number>();
  const solar = new Map<number, number>();
  const intervals = new Set<number>();
  const num = (v: string | undefined): number | null => {
    if (v === undefined || v.trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, n) : null;
  };
  for (const line of lines.slice(1)) {
    const cells = line.split(",");
    const end = parseGmt(cells[idx.GMTIntervalEnding] ?? "");
    if (!Number.isFinite(end)) continue;
    const vals = [
      num(cells[idx.WindRedispatchCurtailments]),
      num(cells[idx.WindManualCurtailments]),
      num(cells[idx.SolarRedispatchCurtailments]),
      num(cells[idx.SolarManualCurtailments]),
    ];
    if (vals.every((v) => v === null)) continue;
    const start = end - FIVE_MIN_MS;
    intervals.add(start);
    const hour = Math.floor(start / 3_600_000) * 3_600_000;
    const [wr, wm, sr, sm] = vals.map((v) => v ?? 0);
    wind.set(hour, (wind.get(hour) ?? 0) + (wr + wm) / 12);
    solar.set(hour, (solar.get(hour) ?? 0) + (sr + sm) / 12);
  }
  const toPoints = (m: Map<number, number>): CurtailmentPoint[] =>
    [...m.entries()]
      .sort(([a], [b]) => a - b)
      .map(([t, mw]) => ({ utcTimestamp: new Date(t).toISOString(), mw }));
  return { wind: toPoints(wind), solar: toPoints(solar), intervals: intervals.size };
}

/** A day with fewer 5-minute intervals than this (22 hours) is partial and left out. */
const MIN_INTERVALS_PER_DAY = 264;
/** Fewer complete days than this and the loader falls back to the EIA estimate. */
const MIN_DAYS = 20;

export function buildSppMeasuredRegions(
  days: { ymd: string; wind: CurtailmentPoint[]; solar: CurtailmentPoint[] }[],
): { wind: RegionData; solar: RegionData } {
  const byTime = (a: CurtailmentPoint, b: CurtailmentPoint) => a.utcTimestamp.localeCompare(b.utcTimestamp);
  const windPoints = days.flatMap((d) => d.wind).sort(byTime);
  const solarPoints = days.flatMap((d) => d.solar).sort(byTime);
  const windMwh = windPoints.reduce((s, p) => s + p.mw, 0);
  const solarMwh = solarPoints.reduce((s, p) => s + p.mw, 0);
  const denom = windMwh + solarMwh;
  const split = denom > 0
    ? `wind ${((windMwh / denom) * 100).toFixed(0)}% / solar ${((solarMwh / denom) * 100).toFixed(0)}%`
    : "no curtailment";
  const ymds = days.map((d) => d.ymd).sort();
  const fmt = (ymd: string) => `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
  const note =
    `SPP VER Curtailments report, measured 5-minute curtailment (redispatch + manual; SPP and SPP RTO West), ` +
    `${days.length} days ${fmt(ymds[0])} to ${fmt(ymds.at(-1)!)}` +
    (days.length < 30 ? ` (30-day total scaled up from ${days.length} days)` : "") +
    `; observed split ${split}`;
  const build = (regionId: string, points: CurtailmentPoint[]): RegionData => {
    const last = points.at(-1)?.utcTimestamp ?? new Date().toISOString();
    return {
      regionId,
      profile: timeOfDayAverageGW(points),
      latestProfile: latestCompleteUtcDayProfileGW(points),
      // A day SPP did not publish is missing, not zero: scale the days held to 30.
      totalTWh: totalTWh30d(points) * (30 / days.length),
      peakGW: peakGW(points),
      lastUpdated: last,
      lastSuccessAt: last,
      sourceNote: note,
    };
  };
  return { wind: build("spp-wind", windPoints), solar: build("spp-solar", solarPoints) };
}

function ymdUtc(t: number): string {
  return new Date(t).toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * The 30 most recent complete days of the report, looking back 33 days from
 * yesterday (UTC). The file for a Central day fills through that day, so the
 * newest candidate can be partial; the interval count drops it.
 */
async function fetchSppVerCurtailments(now = new Date()): Promise<{ wind: RegionData; solar: RegionData }> {
  const candidates = Array.from({ length: 33 }, (_, i) => ymdUtc(now.getTime() - (i + 1) * 86_400_000));
  // Eight at a time, no retry: portal.spp.org drops traffic from some networks
  // (on 2026-11-21 it timed out from a home connection in New Zealand and from
  // a cloud dev container, and answered from a Vercel sandbox in iad1), so an
  // unreachable portal costs about five request timeouts and the EIA estimate
  // still runs.
  const results = await mapWithConcurrency(candidates, 8, async (ymd) => {
    try {
      const parsed = parseSppVerCurtailments(await fetchText(sppVerCurtailmentsUrl(ymd), { retries: 0 }));
      if (parsed.intervals < MIN_INTERVALS_PER_DAY) {
        console.warn(`SPP VER curtailments ${ymd} skipped: ${parsed.intervals} intervals (partial day)`);
        return null;
      }
      return { ymd, wind: parsed.wind, solar: parsed.solar };
    } catch (err) {
      console.warn(`SPP VER curtailments ${ymd} skipped: ${(err as Error).message}`);
      return null;
    }
  });
  const days = results.filter((r): r is NonNullable<typeof r> => r !== null).slice(0, 30);
  if (days.length < MIN_DAYS) {
    throw new Error(`SPP VER curtailments: only ${days.length} of the last 33 days parsed (need ${MIN_DAYS})`);
  }
  return buildSppMeasuredRegions(days);
}

const run = async (): Promise<{ wind: RegionData; solar: RegionData }> => {
  try {
    return await fetchSppVerCurtailments();
  } catch (err) {
    console.warn(`SPP measured curtailment unavailable; falling back to the EIA estimate: ${(err as Error).message}`);
  }
  return loader.run();
};

if (loader.isMain(import.meta.url)) {
  withFallback<{ wind: RegionData; solar: RegionData }>("spp", run, {
    regionTier: "live" as const,
    tagLive: (r) => r,
    tagCached: (c) => adaptCachedAggregateToPerFuel(c, "spp", { wind: 0.85, solar: 0.15 }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("spp loader failed", err);
      process.exit(1);
    });
}
