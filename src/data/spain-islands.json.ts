/**
 * Spain's island systems — REE REData daily generation by technology.
 *
 * Token-free endpoint, one request per electric system:
 *   https://apidatos.ree.es/en/datos/generacion/estructura-generacion
 *     ?time_trunc=day&geo_trunc=electric_system&geo_limit=canarias&geo_ids=8742
 *     ?time_trunc=day&geo_trunc=electric_system&geo_limit=baleares&geo_ids=8743
 *
 * What this is, and is not:
 *   - Generation only. REData carries no curtailment series for these systems,
 *     so waste is unpublished. No rate is borrowed from mainland Spain.
 *   - Daily totals (MWh). `time_trunc=hour` returns HTTP 400 on this widget,
 *     for the peninsula as well as the islands (probed 2026-11-18). The
 *     30-day generation total is therefore REE's; the 24-hour
 *     `generationProfile` is not: solar is a typical clear-sky shape centred
 *     on local solar noon, wind is flat. Neither shape is measured.
 *   - Only settled days count. Asked for a range that ends today, REData
 *     returns a full-day figure for the day still in progress (seen at 10:30
 *     UTC on 2026-11-18), which cannot be a measured total. The window
 *     therefore ends two days before the fetch date (by UTC date, which is
 *     never later than REE's Madrid date), and a day must also appear in the
 *     system's "Total generation" row. The window is the 30 calendar days up
 *     to that cutoff; days REE has not published are not replaced by older
 *     ones.
 *   - apidatos.ree.es sits behind an Incapsula bot wall that answered 403 to
 *     about a third of requests from a datacentre address on 2026-11-18. A
 *     403 is retried three times; any other failure, and a 403 that persists,
 *     falls back to the last-good snapshot through withFallback.
 *
 * Regions: canary-islands-wind, canary-islands-solar, balearic-islands-solar.
 * The Balearics report no wind row in REData at day resolution (about
 * 1.3 GWh in all of 2023), so there is no Balearic wind region. Ceuta and
 * Melilla are left out: REData's 2025 year totals show 0.0 and 0.1 GWh of
 * solar and no wind. El Hierro's "Hydroeolian" row (wind-pumped hydro) is not
 * added to Canary wind.
 *
 * Measured curtailment for these systems, if REE publishes it, would sit in
 * ESIOS behind ESIOS_API_TOKEN (see spain-esios.json.ts). The ESIOS indicator
 * list answers 403 without a token, so that is unchecked.
 */

import { pathToFileURL } from "url";
import { fetchJSON } from "../lib/fetch.js";
import { relayFreshness } from "../lib/freshness.js";
import { withFallback } from "../lib/resilient.js";
import { solarProfile } from "../lib/typical-profiles.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { RegionData } from "../lib/types.js";

export const REDATA_BASE = "https://apidatos.ree.es/en/datos/generacion/estructura-generacion";
/** REData series ids, the same in every language and electric system. */
export const REDATA_WIND_ID = "10291";
export const REDATA_SOLAR_PV_ID = "1458";
export const REDATA_TOTAL_ID = "10296";

export const WINDOW_DAYS = 30;
/** Fewer settled days than this and the run fails over to the snapshot. */
export const MIN_WINDOW_DAYS = 25;
/**
 * Days before the fetch date that count as unsettled and are left out: the day
 * in progress and the day before it.
 */
export const SETTLE_LAG_DAYS = 2;
/** Days requested: the window plus the settle lag and some slack. */
const FETCH_DAYS = 40;
/**
 * Newest settled day older than this reads `degraded`. A healthy run's newest
 * day is two to three days old, so this trips when REE falls two days behind.
 */
export const STALE_AFTER_DAYS = 4;
/** Extra attempts after a bot-wall 403, and the wait before each (× attempt number). */
export const BOT_WALL_RETRIES = 3;
const BOT_WALL_WAIT_MS = 2000;

interface IslandFuel {
  regionId: string;
  redataId: string;
  kind: "wind" | "solar";
}

export interface IslandSystem {
  label: string;
  geoLimit: string;
  geoId: number;
  /** UTC hour of local solar noon: 12 − longitude / 15. */
  solarNoonUtc: number;
  fuels: IslandFuel[];
}

export const ISLAND_SYSTEMS: IslandSystem[] = [
  {
    label: "Canary Islands",
    geoLimit: "canarias",
    geoId: 8742,
    solarNoonUtc: 13.0,
    fuels: [
      { regionId: "canary-islands-wind", redataId: REDATA_WIND_ID, kind: "wind" },
      { regionId: "canary-islands-solar", redataId: REDATA_SOLAR_PV_ID, kind: "solar" },
    ],
  },
  {
    label: "Balearic Islands",
    geoLimit: "baleares",
    geoId: 8743,
    solarNoonUtc: 11.8,
    fuels: [{ regionId: "balearic-islands-solar", redataId: REDATA_SOLAR_PV_ID, kind: "solar" }],
  },
];

interface RedataValue {
  value?: number | null;
  datetime?: string;
}
interface RedataSeries {
  id?: string;
  type?: string;
  attributes?: { values?: RedataValue[] };
}
export interface RedataResponse {
  included?: RedataSeries[];
  errors?: { detail?: string }[];
}

/** Daily MWh keyed by REE's local calendar date (YYYY-MM-DD) for one series id. */
export function dailyMWh(body: RedataResponse, seriesId: string): Map<string, number> {
  const out = new Map<string, number>();
  const series = body.included?.find((s) => String(s.id) === seriesId);
  for (const v of series?.attributes?.values ?? []) {
    const day = typeof v.datetime === "string" ? v.datetime.slice(0, 10) : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    if (typeof v.value !== "number" || !Number.isFinite(v.value) || v.value < 0) continue;
    out.set(day, v.value);
  }
  return out;
}

export interface IslandWindow {
  /** Settled days in the window, oldest first. */
  days: string[];
  sumMWh: number;
  /** `sumMWh` scaled to 30 days when the window holds fewer. */
  totalTWh30d: number;
}

/** The newest calendar day that counts as settled for a fetch made at `now`. */
export function lastSettledDay(now: Date): string {
  return ymd(new Date(now.getTime() - SETTLE_LAG_DAYS * 86_400_000));
}

/**
 * One technology's settled days in the `WINDOW_DAYS` calendar days ending on
 * `lastSettledDay(now)`: days in that span that both its own row and the
 * system's Total generation row carry. Fewer than `MIN_WINDOW_DAYS` throws.
 */
export function selectWindow(
  body: RedataResponse,
  seriesId: string,
  label: string,
  now: Date,
): IslandWindow {
  const total = dailyMWh(body, REDATA_TOTAL_ID);
  if (total.size === 0) {
    throw new Error(`REData ${label}: no Total generation series (id ${REDATA_TOTAL_ID})`);
  }
  const cutoff = lastSettledDay(now);
  const windowStart = ymd(
    new Date(now.getTime() - (SETTLE_LAG_DAYS + WINDOW_DAYS - 1) * 86_400_000),
  );
  const fuel = dailyMWh(body, seriesId);
  const days = Array.from(fuel.keys())
    .filter((day) => day >= windowStart && day <= cutoff && total.has(day))
    .sort();
  if (days.length < MIN_WINDOW_DAYS) {
    throw new Error(
      `REData ${label}: series ${seriesId} has ${days.length} settled days ` +
        `between ${windowStart} and ${cutoff}, need ${MIN_WINDOW_DAYS}`,
    );
  }
  const sumMWh = days.reduce((sum, day) => sum + (fuel.get(day) ?? 0), 0);
  return { days, sumMWh, totalTWh30d: ((sumMWh / days.length) * WINDOW_DAYS) / 1_000_000 };
}

export function buildIslandRegion(
  system: IslandSystem,
  fuel: IslandFuel,
  body: RedataResponse,
  now = new Date(),
): RegionData {
  const window = selectWindow(body, fuel.redataId, `${system.label} ${fuel.kind}`, now);
  const first = window.days[0];
  const last = window.days[window.days.length - 1];
  // Both shapes integrate to the 30-day total: sum(GW) × 30 / 1000 = TWh.
  const meanGW = (window.totalTWh30d * 1000) / (WINDOW_DAYS * 24);
  const generationProfile =
    fuel.kind === "solar"
      ? solarProfile(system.solarNoonUtc, (window.totalTWh30d * 365) / WINDOW_DAYS)
      : Array(24).fill(meanGW);
  const shape =
    fuel.kind === "solar"
      ? "The 24-hour shape is a typical solar curve centred on local solar noon, not measured"
      : "The 24-hour shape is flat at the daily mean, not measured";
  const scaled =
    window.days.length < WINDOW_DAYS ? `, scaled to ${WINDOW_DAYS} days` : "";
  const fuelName = fuel.kind === "solar" ? "solar PV" : "wind";
  const sourceNote =
    `REE REData daily generation, ${system.label} electric system, ${fuelName}: ` +
    `${(window.sumMWh / 1000).toFixed(1)} GWh over ${window.days.length} settled days ` +
    `(${first} to ${last})${scaled}. Daily totals only: REData serves no hourly series here. ` +
    `${shape}. Waste unpublished: REData has no curtailment series for this system, ` +
    `and no mainland rate is applied. Missing ≠ zero. Not T1a.`;
  const nowIso = now.toISOString();
  const base: RegionData = {
    regionId: fuel.regionId,
    profile: Array(24).fill(0),
    latestProfile: null,
    totalTWh: 0,
    peakGW: 0,
    lastUpdated: `${last}T00:00:00.000Z`,
    lastSuccessAt: nowIso,
    sourceNote,
    // A T3 record is never stamped live: fresh rows read "cached".
    sourceStatus:
      relayFreshness(`${last}T00:00:00.000Z`, now, STALE_AFTER_DAYS) === "degraded"
        ? "degraded"
        : "cached",
    sourceProvenance: "official-lead",
    wasteStatus: "unpublished",
    generationProfile,
    generationTotalTWh: window.totalTWh30d,
  };
  return applyUncertainty(base, { regionTier: "estimated", profileKind: fuel.kind });
}

/** Regions for every system whose REData body is supplied, keyed by region id. */
export function buildSpainIslandsFromRedata(
  bodies: Record<string, RedataResponse>,
  now = new Date(),
): Record<string, RegionData> {
  const out: Record<string, RegionData> = {};
  for (const system of ISLAND_SYSTEMS) {
    const body = bodies[system.geoLimit];
    if (!body) throw new Error(`REData ${system.label}: no response body`);
    for (const fuel of system.fuels) {
      out[fuel.regionId] = buildIslandRegion(system, fuel, body, now);
    }
  }
  return out;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function redataUrl(system: IslandSystem, now = new Date()): string {
  const start = new Date(now.getTime() - FETCH_DAYS * 86_400_000);
  const params = new URLSearchParams({
    start_date: `${ymd(start)}T00:00`,
    end_date: `${ymd(now)}T23:59`,
    time_trunc: "day",
    geo_trunc: "electric_system",
    geo_limit: system.geoLimit,
    geo_ids: String(system.geoId),
  });
  return `${REDATA_BASE}?${params.toString()}`;
}

type RedataFetcher = (
  url: string,
  opts: { headers: Record<string, string>; retries: number },
) => Promise<RedataResponse>;

/**
 * One REData request. Only the bot wall's 403 is retried: it comes back at
 * once, so `BOT_WALL_RETRIES` more attempts cost seconds. A timeout or any
 * other failure is not retried here, so a dead upstream costs one request
 * timeout before withFallback serves the snapshot. A 200 that carries an
 * `errors` array (REData's "data unavailable") throws.
 */
export async function fetchRedata(
  url: string,
  label: string,
  fetcher: RedataFetcher = (u, o) => fetchJSON<RedataResponse>(u, o),
  waitMs = BOT_WALL_WAIT_MS,
): Promise<RedataResponse> {
  for (let attempt = 0; ; attempt++) {
    try {
      const body = await fetcher(url, { headers: { accept: "application/json" }, retries: 0 });
      if (body?.errors?.length) {
        throw new Error(`REData ${label}: ${body.errors[0]?.detail ?? "error response"}`);
      }
      return body;
    } catch (err) {
      const blocked = err instanceof Error && err.message.startsWith("HTTP 403");
      if (!blocked || attempt >= BOT_WALL_RETRIES) throw err;
      await new Promise((resolve) => setTimeout(resolve, waitMs * (attempt + 1)));
    }
  }
}

async function run(): Promise<Record<string, RegionData>> {
  const now = new Date();
  const bodies: Record<string, RedataResponse> = {};
  // One system after the other: two requests at once draw the bot wall sooner.
  for (const system of ISLAND_SYSTEMS) {
    bodies[system.geoLimit] = await fetchRedata(redataUrl(system, now), system.label);
  }
  return buildSpainIslandsFromRedata(bodies, now);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback<Record<string, RegionData>>("spain-islands", () => run(), {
    regionTier: "estimated" as const,
    tagLive: (r) => r,
    tagCached: (c) => c as Record<string, RegionData>,
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("spain-islands loader failed", err);
      process.exit(1);
    });
}

export const buildSpainIslandsData = () => run();
