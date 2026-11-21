import { fetchJSON, fetchText } from "../lib/fetch.js";
import { mapWithConcurrency } from "../lib/concurrency.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW, latestCompleteUtcDayProfileGW } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import { adaptCachedAggregateToPerFuel } from "../lib/eia-iso.js";
import type { RegionData, CurtailmentPoint } from "../lib/types.js";
import { pathToFileURL } from "url";

const SOLAR_RATE = 0.0425;
const WIND_RATE = 0.042;

const API_BASE = "https://api.eia.gov/v2/electricity/rto/fuel-type-data/data/";
const DAILY_REPORT_BASE = "https://www.caiso.com/documents/daily-renewable-report";

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

function toPoints(raw: EIAResponse, rate: number): CurtailmentPoint[] {
  return raw.response.data.map((r) => ({
    utcTimestamp: `${r.period}:00:00Z`,
    mw: Math.max(0, Number(r.value) * rate),
  }));
}

function scalePoints(points: CurtailmentPoint[], share: number): CurtailmentPoint[] {
  return points.map((p) => ({ ...p, mw: p.mw * share }));
}

export function parseCaisoPerFuel(
  solarRaw: EIAResponse,
  windRaw?: EIAResponse,
): { wind: RegionData; solar: RegionData } {
  const solarPoints = toPoints(solarRaw, SOLAR_RATE);
  const windPoints = toPoints(windRaw ?? { response: { total: 0, data: [] } }, WIND_RATE);

  const solarLast = solarPoints.at(-1)?.utcTimestamp ?? new Date().toISOString();
  const windLast = windPoints.at(-1)?.utcTimestamp ?? new Date().toISOString();

  const solarTotalMw = solarPoints.reduce((s, p) => s + p.mw, 0);
  const windTotalMw = windPoints.reduce((s, p) => s + p.mw, 0);
  const denom = solarTotalMw + windTotalMw;
  const fuelShare = denom > 0
    ? { solar: solarTotalMw / denom, wind: windTotalMw / denom }
    : { solar: 1, wind: 0 };

  return {
    solar: {
      regionId: "caiso-solar",
      profile: timeOfDayAverageGW(solarPoints),
      latestProfile: latestCompleteUtcDayProfileGW(solarPoints),
      totalTWh: totalTWh30d(solarPoints),
      peakGW: peakGW(solarPoints),
      lastUpdated: solarLast,
      lastSuccessAt: solarLast,
      sourceNote: `EIA CISO solar × ${(SOLAR_RATE * 100).toFixed(2)}% calibrated curtailment (CAISO 2024: 3.4 TWh / 80 TWh)`,
    },
    wind: {
      regionId: "caiso-wind",
      profile: timeOfDayAverageGW(windPoints),
      latestProfile: latestCompleteUtcDayProfileGW(windPoints),
      totalTWh: totalTWh30d(windPoints),
      peakGW: peakGW(windPoints),
      lastUpdated: windLast,
      lastSuccessAt: windLast,
      sourceNote: `EIA CISO wind × ${(WIND_RATE * 100).toFixed(1)}% calibrated curtailment (CAISO 2024: 0.5 TWh / 12 TWh)`,
    },
  };
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
/** Curtailment categories in the report: economic, self-schedule, operator instruction; local and system. */
const CURTAILMENT_CATEGORIES = ["econ_local", "econ_system", "ss_local", "ss_system", "oi_local", "oi_system"] as const;

/** A calendar day in California (the report's operating day). */
export interface CaisoDay { year: number; month: number; day: number }

/** `https://www.caiso.com/documents/daily-renewable-report-nov-19-2026.html` for 2026-11-19. */
export function caisoDailyReportUrl({ year, month, day }: CaisoDay): string {
  return `${DAILY_REPORT_BASE}-${MONTHS[month - 1]}-${String(day).padStart(2, "0")}-${year}.html`;
}

/** UTC offset of America/Los_Angeles, in hours, at a given instant (-8 or -7). */
function pacificOffsetHours(at: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", timeZoneName: "shortOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT-8";
  const m = name.match(/GMT([+-]\d+)/);
  return m ? Number(m[1]) : -8;
}

/** The UTC instant at which local hour `hour` (0 = midnight) of a California day starts. */
function pacificHourStartUtc({ year, month, day }: CaisoDay, hour: number): string {
  const guess = new Date(Date.UTC(year, month - 1, day, hour + 8));
  const offset = pacificOffsetHours(guess);
  return new Date(Date.UTC(year, month - 1, day, hour - offset)).toISOString();
}

function inlineArrays(html: string): Map<string, string[]> {
  // The report declares every chart series inline, as one comma-separated
  // `var a = [...],\n b = [...]` statement, so match `name = [ ... ]` anywhere.
  const out = new Map<string, string[]>();
  for (const m of html.matchAll(/\b(curt_hr_tot_(?:solar|wind)_[a-z_]+_mwh)\s*=\s*\[([^\]]*)\]/g)) {
    out.set(m[1], m[2].split(",").map((v) => v.trim().replace(/^["']|["']$/g, "")));
  }
  return out;
}

/**
 * One operating day's hourly curtailment by fuel, from CAISO's Daily Renewable
 * Report HTML. CAISO has published 5-minute and hourly curtailment only there
 * since mid-2025 (its last Production and Curtailments workbook, for
 * June–December 2025, says so), and OASIS `SLD_REN_CURTAIL` answers
 * "Invalid Parameters" (probed 2026-11-21). The hourly MWh per fuel is the sum
 * of the six `curt_hr_tot_<fuel>_<category>_mwh` series; index 0 is the hour
 * starting at local midnight. "NA" reads as 0. Throws when a series is missing.
 */
export function parseCaisoDailyRenewableReport(
  html: string,
  date: CaisoDay,
): { solar: CurtailmentPoint[]; wind: CurtailmentPoint[] } {
  const arrays = inlineArrays(html);
  const sumFuel = (fuel: "solar" | "wind"): number[] => {
    let hours = 0;
    const series = CURTAILMENT_CATEGORIES.map((cat) => {
      const name = `curt_hr_tot_${fuel}_${cat}_mwh`;
      const values = arrays.get(name);
      if (!values) throw new Error(`CAISO daily report ${caisoDailyReportUrl(date)} has no ${name}`);
      hours = Math.max(hours, values.length);
      return values;
    });
    if (hours < 23 || hours > 25) throw new Error(`CAISO daily report ${caisoDailyReportUrl(date)}: ${hours} hourly values`);
    return Array.from({ length: hours }, (_, h) =>
      series.reduce((sum, values) => {
        const v = Number(values[h]);
        return sum + (Number.isFinite(v) && v > 0 ? v : 0);
      }, 0),
    );
  };
  const toPoints = (mwh: number[]): CurtailmentPoint[] =>
    // An hour's MWh is its average MW.
    mwh.map((mw, hour) => ({ utcTimestamp: pacificHourStartUtc(date, hour), mw }));
  return { solar: toPoints(sumFuel("solar")), wind: toPoints(sumFuel("wind")) };
}

function pacificToday(now: Date): CaisoDay {
  const local = new Date(now.getTime() + pacificOffsetHours(now) * 3_600_000);
  return { year: local.getUTCFullYear(), month: local.getUTCMonth() + 1, day: local.getUTCDate() };
}

function daysBefore(d: CaisoDay, n: number): CaisoDay {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day - n));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

/** Fewer report days than this and the loader falls back to the EIA estimate. */
const MIN_REPORT_DAYS = 20;

export function buildCaisoMeasuredRegions(
  days: { date: CaisoDay; solar: CurtailmentPoint[]; wind: CurtailmentPoint[] }[],
): { wind: RegionData; solar: RegionData } {
  const solarPoints = days.flatMap((d) => d.solar).sort((a, b) => a.utcTimestamp.localeCompare(b.utcTimestamp));
  const windPoints = days.flatMap((d) => d.wind).sort((a, b) => a.utcTimestamp.localeCompare(b.utcTimestamp));
  const solarMwh = solarPoints.reduce((s, p) => s + p.mw, 0);
  const windMwh = windPoints.reduce((s, p) => s + p.mw, 0);
  const denom = solarMwh + windMwh;
  const split = denom > 0
    ? `solar ${((solarMwh / denom) * 100).toFixed(0)}% / wind ${((windMwh / denom) * 100).toFixed(0)}%`
    : "no curtailment";
  const ymd = (d: CaisoDay) => `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
  const sorted = [...days].sort((a, b) => ymd(a.date).localeCompare(ymd(b.date)));
  const note =
    `CAISO Daily Renewable Report hourly curtailment, measured (economic, self-schedule and operator-instruction; local and system), ` +
    `${days.length} days ${ymd(sorted[0].date)} to ${ymd(sorted.at(-1)!.date)}; observed split ${split}`;
  const build = (regionId: string, points: CurtailmentPoint[]): RegionData => {
    const last = points.at(-1)?.utcTimestamp ?? new Date().toISOString();
    return {
      regionId,
      profile: timeOfDayAverageGW(points),
      latestProfile: latestCompleteUtcDayProfileGW(points),
      totalTWh: totalTWh30d(points),
      peakGW: peakGW(points),
      lastUpdated: last,
      lastSuccessAt: new Date().toISOString(),
      sourceNote: note,
    };
  };
  return { solar: build("caiso-solar", solarPoints), wind: build("caiso-wind", windPoints) };
}

/**
 * The 30 most recent operating days with a published report, looking back up
 * to 33 days from yesterday (the report for a day appears the morning after;
 * a day CAISO skipped is left out, not zero-filled).
 */
async function fetchCaisoDailyReports(now = new Date()): Promise<{ wind: RegionData; solar: RegionData }> {
  const today = pacificToday(now);
  const candidates = Array.from({ length: 33 }, (_, i) => daysBefore(today, i + 1));
  const results = await mapWithConcurrency(candidates, 4, async (date) => {
    try {
      const html = await fetchText(caisoDailyReportUrl(date), { timeoutMs: 20_000, retries: 1 });
      return { date, ...parseCaisoDailyRenewableReport(html, date) };
    } catch (err) {
      console.warn(`CAISO daily report ${caisoDailyReportUrl(date)} skipped: ${(err as Error).message}`);
      return null;
    }
  });
  const days = results.filter((r): r is NonNullable<typeof r> => r !== null).slice(0, 30);
  if (days.length < MIN_REPORT_DAYS) {
    throw new Error(`CAISO Daily Renewable Report: only ${days.length} of the last 33 days parsed (need ${MIN_REPORT_DAYS})`);
  }
  return buildCaisoMeasuredRegions(days);
}

const run = async (): Promise<{ wind: RegionData; solar: RegionData }> => {
  try {
    return await fetchCaisoDailyReports();
  } catch (err) {
    console.warn(`CAISO measured curtailment unavailable; falling back to the EIA estimate: ${(err as Error).message}`);
  }

  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey) throw new Error("EIA_API_KEY not set");

  const now = new Date();
  const end = now.toISOString().slice(0, 13);
  const start = new Date(now.getTime() - 30 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 13);

  const makeUrl = (fueltype: "SUN" | "WND") => {
    const params = new URLSearchParams({
      api_key: apiKey,
      frequency: "hourly",
      "data[0]": "value",
      "facets[respondent][]": "CISO",
      "facets[fueltype][]": fueltype,
      start,
      end,
      "sort[0][column]": "period",
      "sort[0][direction]": "asc",
      length: "5000",
    });
    return `${API_BASE}?${params.toString()}`;
  };
  const [solar, wind] = await Promise.all([
    fetchJSON<EIAResponse>(makeUrl("SUN")),
    fetchJSON<EIAResponse>(makeUrl("WND")).catch((err) => {
      console.warn(`CAISO WND fetch failed, continuing solar-only: ${(err as Error).message}`);
      return undefined;
    }),
  ]);
  return parseCaisoPerFuel(solar, wind);
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<{ wind: RegionData; solar: RegionData }>("caiso", run, {
    regionTier: "live" as const,
    tagLive: (r) => r,
    tagCached: (c) =>
      adaptCachedAggregateToPerFuel(c, "caiso", { wind: 0.15, solar: 0.85 }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("caiso loader failed", err);
      process.exit(1);
    });
}