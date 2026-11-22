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
  "BAA",
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
 * Redispatch + Manual for one BA: `baa` "SPP" (the default; a blank BAA, as in
 * older files, reads as SPP) for `spp-*`, or "SWPW" for `swpw-*` (see
 * swpw.json.ts). CurtailedForEnergy is left out:
 * across 35 days of the report (17 Oct to 20 Nov 2026, about 20,000 rows) it is
 * never larger than Redispatch and never non-zero when Redispatch is zero, so
 * it reads as a subset of Redispatch, and adding it would double count. SPP's
 * portal does not document the columns, so that is an inference from the data.
 *
 * Rows are bucketed by interval start (GMTIntervalEnding minus 5 minutes) into
 * UTC hours; an hour's MWh is the sum of its intervals' MW / 12, which is its
 * average MW. Rows with blank values (SPP leaves a few per day empty) add
 * nothing. Also returns how many distinct SPP intervals carried values, so a
 * caller can drop a partial day and scale for the gaps.
 */
export type SppBaa = "SPP" | "SWPW";

export function parseSppVerCurtailments(csv: string, baa: SppBaa = "SPP"): {
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
    const rowBaa = (cells[idx.BAA] ?? "").trim() || "SPP";
    if (rowBaa !== baa) continue;
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

/** Five-minute intervals in 30 days. */
const INTERVALS_30D = 30 * 288;

const BAA_LABEL: Record<SppBaa, { regionPrefix: string; label: string }> = {
  SPP: { regionPrefix: "spp", label: "SPP balancing authority" },
  SWPW: { regionPrefix: "swpw", label: "SPP RTO West (SWPW) balancing authority" },
};

export function buildSppMeasuredRegions(
  days: { ymd: string; wind: CurtailmentPoint[]; solar: CurtailmentPoint[]; intervals: number }[],
  baa: SppBaa = "SPP",
): { wind: RegionData; solar: RegionData } {
  const { regionPrefix, label } = BAA_LABEL[baa];
  if (days.length === 0) throw new Error("SPP VER curtailments: no days to build from");
  const intervalsHeld = days.reduce((s, d) => s + d.intervals, 0);
  if (intervalsHeld <= 0) throw new Error("SPP VER curtailments: no intervals with values");
  // A missing interval (a day SPP did not publish, a blank row, the unfilled
  // end of a partial day) is missing, not zero: scale the intervals held to 30
  // days. A DST day's 276 or 300 intervals move this by under 0.2%.
  const scale = INTERVALS_30D / intervalsHeld;
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
    `SPP VER Curtailments report, measured 5-minute curtailment (redispatch + manual, ${label}), ` +
    `${days.length} days ${fmt(ymds[0])} to ${fmt(ymds.at(-1)!)}` +
    (intervalsHeld < INTERVALS_30D
      ? ` (30-day total scaled up from ${(intervalsHeld / 288).toFixed(1)} days of 5-minute intervals)`
      : "") +
    `; observed split ${split}`;
  const build = (regionId: string, points: CurtailmentPoint[]): RegionData => {
    const last = points.at(-1)?.utcTimestamp ?? new Date().toISOString();
    return {
      regionId,
      profile: timeOfDayAverageGW(points),
      latestProfile: latestCompleteUtcDayProfileGW(points),
      totalTWh: totalTWh30d(points) * scale,
      peakGW: peakGW(points),
      lastUpdated: last,
      lastSuccessAt: last,
      sourceNote: note,
    };
  };
  return { wind: build(`${regionPrefix}-wind`, windPoints), solar: build(`${regionPrefix}-solar`, solarPoints) };
}

function ymdUtc(t: number): string {
  return new Date(t).toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * The 30 most recent complete days of the report, looking back 33 days from
 * yesterday (UTC). The file for a Central day fills through that day, so the
 * newest candidate can be partial; the interval count drops it.
 */
export async function fetchSppVerCurtailments(
  baa: SppBaa = "SPP",
  now = new Date(),
): Promise<{ wind: RegionData; solar: RegionData }> {
  const candidates = Array.from({ length: 33 }, (_, i) => ymdUtc(now.getTime() - (i + 1) * 86_400_000));
  // Eight at a time, no retry: portal.spp.org drops traffic from some networks
  // (on 2026-11-21 it timed out from a home connection in New Zealand and from
  // a cloud dev container, and answered from a Vercel sandbox in iad1). The
  // EIA estimate runs alongside (see run), so an unreachable portal costs
  // about five request timeouts without delaying it.
  const results = await mapWithConcurrency(candidates, 8, async (ymd) => {
    try {
      const parsed = parseSppVerCurtailments(await fetchText(sppVerCurtailmentsUrl(ymd), { retries: 0 }), baa);
      if (parsed.intervals < MIN_INTERVALS_PER_DAY) {
        console.warn(`SPP VER curtailments ${baa} ${ymd} skipped: ${parsed.intervals} intervals (partial day)`);
        return null;
      }
      return { ymd, ...parsed };
    } catch (err) {
      console.warn(`SPP VER curtailments ${ymd} skipped: ${(err as Error).message}`);
      return null;
    }
  });
  const days = results.filter((r): r is NonNullable<typeof r> => r !== null).slice(0, 30);
  if (days.length < MIN_DAYS) {
    throw new Error(`SPP VER curtailments ${baa}: only ${days.length} of the last 33 days parsed (need ${MIN_DAYS})`);
  }
  return buildSppMeasuredRegions(days, baa);
}

/**
 * Measured curtailment from the VER report, with EIA-930 generation for the
 * same BA attached: respondent SWPP for the SPP BA, SWPW for SPP RTO West
 * (its own respondent and BAA since April 2026). The two cover the same BA, and as
 * curtailment is now measured rather than generation x a rate, the generation
 * is an independent denominator. The EIA window runs to the latest hour; the
 * report's runs to the end of yesterday.
 */
export function attachEiaGeneration(
  measured: { wind: RegionData; solar: RegionData },
  eia: { wind: RegionData; solar: RegionData } | null,
): { wind: RegionData; solar: RegionData } {
  const attach = (m: RegionData, e: RegionData | undefined): RegionData =>
    e && Array.isArray(e.generationProfile) && typeof e.generationTotalTWh === "number"
      ? {
          ...m,
          generationProfile: e.generationProfile,
          generationTotalTWh: e.generationTotalTWh,
          generationBasis: "measured-independent",
        }
      : m;
  return { wind: attach(measured.wind, eia?.wind), solar: attach(measured.solar, eia?.solar) };
}

const run = async (): Promise<{ wind: RegionData; solar: RegionData }> => {
  // Both at once, so an unreachable portal does not hold up the EIA fallback.
  const [measured, eia] = await Promise.allSettled([fetchSppVerCurtailments(), loader.run()]);
  if (measured.status === "fulfilled") {
    if (eia.status === "rejected") {
      console.warn(`SPP EIA-930 generation unavailable; measured curtailment only: ${(eia.reason as Error).message}`);
    }
    return attachEiaGeneration(measured.value, eia.status === "fulfilled" ? eia.value : null);
  }
  console.warn(
    `SPP measured curtailment unavailable; falling back to the EIA estimate: ${(measured.reason as Error).message}`,
  );
  if (eia.status === "fulfilled") return eia.value;
  throw eia.reason;
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
