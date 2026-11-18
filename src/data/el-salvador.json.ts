/**
 * El Salvador solar — UT (Unidad de Transacciones) hourly generation by
 * technology.
 *
 * MEASURED     hourly solar generation from UT's public "Operación Diaria"
 *              dashboard (estadistico.ut.com.sv/OperacionDiaria.aspx). The
 *              page is a DevExpress dashboard that loads its data through an
 *              ASP.NET callback: we GET the page once for its hidden form
 *              fields, then POST the same callback the page itself makes, one
 *              day at a time (`FechaConsulta`). The pivot answer gives MWh per
 *              technology × day × hour (hour 0–23, El Salvador time, UTC−6).
 * UNPUBLISHED  waste. UT publishes generation, not curtailment. The former
 *              0.2 TWh/yr static (IRENA-derived) was a modelled figure, not a
 *              UT number, and is dropped with the owner's sign-off (2026-11-18).
 *
 * The pivot omits cells with no records, which for solar are night hours.
 * A missing solar hour is read as zero only at night (18:00–05:59, when El
 * Salvador has no sun in any season); a day missing any hour 06:00–17:59
 * is incomplete and skipped. A null value is missing, not zero.
 *
 * Probe notes: docs/research/2026-11-18-no-public-series-probe.md.
 * Stays `tier: "estimated"` / T3 / official-lead. Not T1a.
 */

import { pathToFileURL } from "node:url";

import { mapWithConcurrency } from "../lib/concurrency.js";
import { completeLocalDays } from "../lib/local-days.js";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";
import { unpublishedGenerationRegion } from "../lib/waste-status.js";

const REGION_ID = "el-salvador";
const PAGE_URL = "https://estadistico.ut.com.sv/OperacionDiaria.aspx";

/** El Salvador is a flat UTC−6 with no daylight saving. */
const SV_OFFSET_HOURS = -6;

/** Days requested: the 14 complete local days before today. */
const WINDOW_DAYS = 14;

/** Fewer complete days than this and the window is not worth trusting. */
const MIN_DAYS = 7;

/**
 * Local hours that must carry a solar cell for a day to count. Sunrise is
 * about 05:40–06:20 and sunset about 17:30–18:20 through the year, so a gap
 * inside 06:00–16:59 is lost data, never night. Hour 17 can legitimately have
 * no records in December, so it defaults to zero like the night hours.
 */
const DAYLIGHT_FIRST_HOUR = 6;
const DAYLIGHT_LAST_HOUR = 16;

/** Callback answers that are not a pivot (error or session pages) tolerated per run. */
const MAX_NON_CALLBACK_BODIES = 2;

/** A 200 response that is not a dashboard callback: an error or session page. */
export class NotCallbackError extends Error {}

/**
 * Plausibility ceiling for one hour of solar, MWh. El Salvador's solar
 * peaked near 300 MWh/h on 2026-11-16. A value in the thousands means the
 * parser has read a daily total or another technology.
 */
const MAX_PLAUSIBLE_SOLAR_MWH = 1200;

const HIDDEN_FIELDS = ["__VIEWSTATE", "__VIEWSTATEGENERATOR", "__EVENTVALIDATION"] as const;
type HiddenFields = Record<(typeof HIDDEN_FIELDS)[number], string>;

/** Pull the ASP.NET hidden fields out of the page HTML. */
export function extractHiddenFields(html: string): HiddenFields {
  const out = {} as HiddenFields;
  for (const name of HIDDEN_FIELDS) {
    const m = new RegExp(`id="${name}" value="([^"]*)"`).exec(html);
    if (!m) throw new Error(`el-salvador: ${name} not found in page`);
    out[name] = m[1];
  }
  return out;
}

/** Form body for one day's pivot callback, as the page itself sends it. */
export function callbackBody(fields: HiddenFields, localDay: string): string {
  const parameters = JSON.stringify([
    { name: "FechaConsulta", value: `${localDay}T00:00:00.000`, type: "System.DateTime", allowMultiselect: false, selectAll: false },
  ]);
  const items = JSON.stringify({ pivotDashboardItem1: {} });
  const url =
    "DXDD.axd?action=DashboardItemBatchGetAction&dashboardId=DashboardID" +
    `&parameters=${encodeURIComponent(parameters)}&items=${encodeURIComponent(items)}`;
  const form = new URLSearchParams({
    ...fields,
    __CALLBACKID: "ASPxDashboardViewer1",
    __CALLBACKPARAM: "c1:" + JSON.stringify({ url, method: "GET", data: "" }),
  });
  return form.toString();
}

/**
 * Hourly solar points for one local day from a callback response
 * (`0|/*DX*\/({'id':1,'result':'<json>'})`). Returns [] when a daylight
 * hour is missing; throws when the response is not the expected pivot.
 */
export function parseCallback(localDay: string, body: string): CurtailmentPoint[] {
  const m = /'result':'([\s\S]*)'\}\)\s*$/.exec(body);
  if (!m) throw new NotCallbackError(`el-salvador ${localDay}: callback has no result (${body.slice(0, 80)})`);
  let doc: any;
  try {
    doc = JSON.parse(m[1].replace(/\\'/g, "'"));
  } catch (err) {
    throw new Error(`el-salvador ${localDay}: result is not JSON (${(err as Error).message})`);
  }
  const storage = doc?.pivotDashboardItem1?.ItemData?.DataStorageDTO;
  const maps = storage?.EncodeMaps;
  const days: unknown = maps?.DataItem3;
  const hours: unknown = maps?.DataItem1;
  const techs: unknown = maps?.DataItem2;
  if (!Array.isArray(days) || !Array.isArray(hours) || !Array.isArray(techs) || !Array.isArray(storage?.Slices)) {
    throw new Error(`el-salvador ${localDay}: pivot encode maps missing`);
  }
  if (days.length !== 1 || !String(days[0]).startsWith(localDay)) {
    throw new Error(`el-salvador ${localDay}: pivot is for ${JSON.stringify(days)}`);
  }
  const solarIdx = techs.findIndex((t) => String(t).trim().toLowerCase() === "solar");
  if (solarIdx < 0) throw new Error(`el-salvador ${localDay}: no Solar technology in ${JSON.stringify(techs)}`);
  const slice = storage.Slices.find(
    (s: any) => Array.isArray(s?.KeyIds) && s.KeyIds.join(",") === "DataItem2,DataItem3,DataItem1",
  );
  if (!slice) throw new Error(`el-salvador ${localDay}: technology × day × hour slice missing`);

  const byHour = new Map<number, number>();
  for (const [key, cell] of Object.entries(slice.Data as Record<string, Record<string, unknown>>)) {
    const [t, d, h] = JSON.parse(key) as number[];
    if (t !== solarIdx || d !== 0) continue;
    const hour = Number(hours[h]);
    const raw = cell?.["0"];
    // null / blank is missing data, not zero (Number(null) would be 0).
    if (raw === null || raw === undefined || String(raw).trim() === "") continue;
    const mwh = Number(raw);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error(`el-salvador ${localDay}: bad hour ${hours[h]}`);
    if (!Number.isFinite(mwh) || mwh < -1) throw new Error(`el-salvador ${localDay}: bad solar value ${String(cell?.["0"])}`);
    if (mwh > MAX_PLAUSIBLE_SOLAR_MWH) {
      throw new Error(`el-salvador ${localDay}: solar ${mwh} MWh exceeds ${MAX_PLAUSIBLE_SOLAR_MWH} MWh ceiling`);
    }
    if (byHour.has(hour)) throw new Error(`el-salvador ${localDay}: duplicate solar hour ${hour}`);
    byHour.set(hour, Math.max(0, mwh));
  }
  for (let h = DAYLIGHT_FIRST_HOUR; h <= DAYLIGHT_LAST_HOUR; h++) {
    if (!byHour.has(h)) return [];
  }
  const [y, mo, dd] = localDay.split("-").map(Number);
  const points: CurtailmentPoint[] = [];
  for (let h = 0; h < 24; h++) {
    points.push({
      utcTimestamp: new Date(Date.UTC(y, mo - 1, dd, h - SV_OFFSET_HOURS)).toISOString(),
      mw: byHour.get(h) ?? 0, // absent outside 06:00–16:59: no sun, no records
      intervalHours: 1,
    });
  }
  return points;
}

/** The `days` complete local days that end yesterday (El Salvador time), oldest first. */
export function windowDays(now: Date, days = WINDOW_DAYS): string[] {
  return completeLocalDays(now, SV_OFFSET_HOURS, days);
}

export function buildElSalvadorRegion(daily: CurtailmentPoint[][], localDays: string[]): RegionData {
  const completeDays = localDays.filter((_, i) => daily[i]?.length === 24);
  if (completeDays.length < MIN_DAYS) {
    throw new Error(`el-salvador: only ${completeDays.length} complete UT days (need ${MIN_DAYS})`);
  }
  const points = daily.filter((d) => d.length === 24).flat();
  const note =
    `UT hourly solar generation, ${completeDays.length} complete days ` +
    `${completeDays[0]} → ${completeDays.at(-1)} (El Salvador time). ` +
    "Waste unpublished: UT publishes generation, not curtailment.";
  return unpublishedGenerationRegion(REGION_ID, "solar", points, note);
}

async function run(now = new Date()): Promise<RegionData> {
  const days = windowDays(now);
  const fields = extractHiddenFields(await fetchText(PAGE_URL, { timeoutMs: 30000, retries: 1 }));
  let nonCallback = 0;
  const daily = await mapWithConcurrency(days, 3, async (day) => {
    let body: string;
    try {
      body = await fetchText(PAGE_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" },
        body: callbackBody(fields, day),
        timeoutMs: 30000,
        retries: 1,
      });
    } catch (err) {
      // A day that does not download is skipped; MIN_DAYS guards the window.
      console.warn(`el-salvador: ${day} skipped (${(err as Error).message})`);
      return [] as CurtailmentPoint[];
    }
    // A day that downloads but does not parse fails the run, so a format
    // change falls back to last-good instead of quietly thinning the window.
    // One error or session page is skipped like a failed download; more than
    // MAX_NON_CALLBACK_BODIES in a run means the endpoint changed, so fail.
    try {
      return parseCallback(day, body);
    } catch (err) {
      if (err instanceof NotCallbackError && ++nonCallback <= MAX_NON_CALLBACK_BODIES) {
        console.warn(`el-salvador: ${day} skipped (${err.message})`);
        return [] as CurtailmentPoint[];
      }
      throw err;
    }
  });
  return buildElSalvadorRegion(daily, days);
}

export const buildElSalvadorData = () => run();

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "estimated" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("el-salvador loader failed", err); process.exit(1); });
}
