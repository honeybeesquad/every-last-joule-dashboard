/**
 * Yukon — Yukon Energy hourly generation by source, waste unpublished.
 *
 * MEASURED     the past 24 hours of generation from Yukon Energy's public
 *              "Electricity Generation" page. The page embeds the chart data
 *              as JavaScript arrays; `rows_chart_past_day` is one row per
 *              hour, `[ISO time with −07:00 offset, hydro, wind, solar,
 *              thermal]`, values in MWh for that hour (= average MW).
 *              Renewable generation here is hydro + wind + solar; thermal
 *              (LNG and diesel) is excluded.
 * UNPUBLISHED  waste. Yukon Energy publishes no spill or curtailment series,
 *              and its hourly per-unit workbook has no spill column.
 *
 * Timestamp convention: the page gives 25 rows from 00:00 on the previous
 * day to 00:00 today. We read each stamp as the END of its hour and keep
 * the latest 24, so the window is the previous local day. The page does not
 * say which end the stamp marks; for a hydro-dominated grid a one-hour shift
 * does not change the 24-hour total.
 *
 * Probe notes: docs/research/2026-11-18-no-public-series-probe.md.
 * Stays `tier: "estimated"` / T3 / official-lead. Not T1a.
 */

import { pathToFileURL } from "node:url";

import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";
import { unpublishedGenerationRegion } from "../lib/waste-status.js";

const REGION_ID = "yukon";
const PAGE_URL = "https://yukonenergy.ca/energy-in-yukon/electricity-101/electricity-generation";

/**
 * Plausibility ceiling for one hour of renewable generation, MWh. Yukon
 * Energy's hydro fleet is roughly 92 MW and the grid's record load is in
 * the low hundreds of MW; a value above this means the parser picked up a
 * cumulative or weekly row.
 */
const MAX_PLAUSIBLE_HOURLY_MWH = 400;

/** A source value below this is a corrupt row, not metering noise. */
const MIN_PLAUSIBLE_SOURCE_MWH = -1;

/** The newest hour must start within this many hours of now. */
const MAX_AGE_HOURS = 36;

export type YukonRow = [string, number, number, number, number];

/** Pull the `rows_chart_past_day` array out of the page HTML. */
export function extractPastDayRows(html: string): YukonRow[] {
  const m = /rows_chart_past_day\s*=\s*(?:parseDates\()?(\[\s*\[[\s\S]*?\]\s*\])/.exec(html);
  if (!m) throw new Error("yukon: rows_chart_past_day not found in page");
  let rows: unknown;
  try {
    rows = JSON.parse(m[1]);
  } catch (err) {
    throw new Error(`yukon: rows_chart_past_day is not JSON (${(err as Error).message})`);
  }
  if (!Array.isArray(rows)) throw new Error("yukon: rows_chart_past_day is not an array");
  for (const row of rows) {
    if (
      !Array.isArray(row) ||
      row.length < 5 ||
      typeof row[0] !== "string" ||
      !row.slice(1, 5).every((v) => typeof v === "number" && Number.isFinite(v))
    ) {
      throw new Error(`yukon: unexpected row shape ${JSON.stringify(row)}`);
    }
  }
  return rows as YukonRow[];
}

/**
 * Hourly renewable (hydro + wind + solar) points, each stamped at the start
 * of its hour in UTC. Keeps the latest 24 rows.
 */
export function pastDayRenewablePoints(rows: YukonRow[]): CurtailmentPoint[] {
  const points = rows
    .map(([stamp, hydro, wind, solar]) => {
      const endMs = Date.parse(stamp);
      if (!Number.isFinite(endMs)) throw new Error(`yukon: bad timestamp ${stamp}`);
      for (const v of [hydro, wind, solar]) {
        if (v < MIN_PLAUSIBLE_SOURCE_MWH) throw new Error(`yukon: negative value ${v} MWh at ${stamp}`);
      }
      // Readings in [-1, 0) are metering noise around zero output.
      const mwh = Math.max(0, hydro) + Math.max(0, wind) + Math.max(0, solar);
      if (mwh > MAX_PLAUSIBLE_HOURLY_MWH) {
        throw new Error(`yukon: ${mwh.toFixed(1)} MWh at ${stamp} exceeds ${MAX_PLAUSIBLE_HOURLY_MWH} MWh ceiling`);
      }
      return { utcTimestamp: new Date(endMs - 3_600_000).toISOString(), mw: mwh, intervalHours: 1 };
    })
    .sort((a, b) => a.utcTimestamp.localeCompare(b.utcTimestamp));
  const window = points.slice(-24);
  for (let i = 1; i < window.length; i++) {
    const step = Date.parse(window[i].utcTimestamp) - Date.parse(window[i - 1].utcTimestamp);
    if (step !== 3_600_000) {
      throw new Error(`yukon: hours not consecutive at ${window[i].utcTimestamp} (step ${step / 60_000} min)`);
    }
  }
  return window;
}

export function buildYukonRegionFromHtml(html: string, now: Date = new Date()): RegionData {
  const points = pastDayRenewablePoints(extractPastDayRows(html));
  const last = points.at(-1);
  if (last && now.getTime() - Date.parse(last.utcTimestamp) > MAX_AGE_HOURS * 3_600_000) {
    throw new Error(`yukon: newest hour ${last.utcTimestamp} is older than ${MAX_AGE_HOURS} h; the page has stopped updating`);
  }
  const note =
    `Yukon Energy hourly hydro + wind + solar generation, ${points.length} hours ` +
    `${points[0]?.utcTimestamp ?? "?"} → ${points.at(-1)?.utcTimestamp ?? "?"} (UTC, hour start). ` +
    "Thermal excluded. Waste unpublished: Yukon Energy publishes no spill or curtailment series.";
  return unpublishedGenerationRegion(REGION_ID, "hydro-seasonal", points, note);
}

async function run(): Promise<RegionData> {
  const html = await fetchText(PAGE_URL, { timeoutMs: 20000, retries: 1 });
  return buildYukonRegionFromHtml(html);
}

export const buildYukonData = () => run();

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "estimated" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("yukon loader failed", err); process.exit(1); });
}
