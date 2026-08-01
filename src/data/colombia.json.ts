import { pathToFileURL, fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";
import { fetchJSON } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalHydroSeasonalRegion, HYDRO_SEASONAL_SHARES } from "../lib/typical-profiles.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import { relayFreshness, RELAY_STALENESS_THRESHOLD_DAYS } from "../lib/freshness.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "colombia";
const XM_API_URL = "https://servapibi.xm.com.co/daily";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, "../../data/historical/colombia-vertimientos-daily.csv");

interface CsvRow { date: string; gwh: number; }

// XM SinerGox API response shape for Entity=Sistema daily metrics. The
// /daily endpoint returns each day's value(s) as a `DailyEntities` array
// of {Id, Value} pairs. `Value` is a string-encoded number in **kWh**;
// the loader converts to GWh on the way through. (The earlier shape
// `Values: Record<string, number>` documented here was wrong against
// the live API — confirmed empirically via Britta-relay fetch on
// 2026-05-08, see PR notes.)
interface XmDailyEntity { Id: string; Value: string | number; }
interface XmDailyItem { Date: string; DailyEntities?: XmDailyEntity[] }
interface XmResponse { Items?: XmDailyItem[]; }

function parseCSV(text: string): CsvRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const header = lines[0].split(",");
  const dateIdx = header.indexOf("date");
  const gwhIdx  = header.indexOf("gwh");
  if (dateIdx < 0 || gwhIdx < 0) throw new Error("Colombia CSV missing date/gwh columns");
  return lines.slice(1)
    .map(line => {
      const cols = line.split(",");
      return { date: cols[dateIdx].trim(), gwh: parseFloat(cols[gwhIdx]) };
    })
    .filter(r => !isNaN(r.gwh) && r.gwh >= 0);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Convert a single XM `DailyEntities` row to a CsvRow. XM publishes Value as
// a string in **kWh**; we convert to GWh.
function xmRowToCsv(it: XmDailyItem): CsvRow | null {
  const date = it.Date?.slice(0, 10) ?? "";
  if (!date) return null;
  const sistema = (it.DailyEntities ?? []).find(e => e.Id === "Sistema");
  if (!sistema) return null;
  const kwh = typeof sistema.Value === "string" ? parseFloat(sistema.Value) : sistema.Value;
  if (!isFinite(kwh) || kwh < 0) return null;
  return { date, gwh: kwh / 1_000_000 };
}

async function fetchXmLast365Days(): Promise<{ annualTWh: number; latestDate: string; nDays: number }> {
  // XM's /daily endpoint rejects requests spanning more than ~30 days with
  // HTTP 400. Fetch in 12 contiguous 30-day chunks and merge.
  const end = new Date();
  const all: CsvRow[] = [];
  const seen = new Set<string>();
  for (let chunkOffsetDays = 0; chunkOffsetDays < 365; chunkOffsetDays += 30) {
    const chunkEnd = new Date(end.getTime() - chunkOffsetDays * 24 * 3600 * 1000);
    const chunkStart = new Date(chunkEnd.getTime() - 30 * 24 * 3600 * 1000);
    const body = JSON.stringify({
      MetricId: "VertEner",
      StartDate: isoDate(chunkStart),
      EndDate: isoDate(chunkEnd),
      Entity: "Sistema",
    });
    let resp: XmResponse | undefined;
    try {
      resp = await fetchJSON<XmResponse>(XM_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        timeoutMs: 15000,
        retries: 1,
      });
    } catch {
      continue;
    }
    for (const item of resp?.Items ?? []) {
      const row = xmRowToCsv(item);
      if (!row || seen.has(row.date)) continue;
      seen.add(row.date);
      all.push(row);
    }
  }
  if (all.length === 0) throw new Error("XM API returned no valid VertEner rows");
  all.sort((a, b) => a.date.localeCompare(b.date));
  const sumGwh = all.reduce((s, r) => s + r.gwh, 0);
  const annualTWh = (sumGwh * (365 / all.length)) / 1000;
  return { annualTWh, latestDate: all[all.length - 1].date, nDays: all.length };
}

function readCsvRelay(csvPath = CSV_PATH): { annualTWh: number; latestDate: string; nRows: number } {
  const raw = readFileSync(csvPath, "utf-8");
  const rows = parseCSV(raw);
  rows.sort((a, b) => a.date.localeCompare(b.date));
  const tail = rows.slice(-365);
  const sumGwh = tail.reduce((s, r) => s + r.gwh, 0);
  const annualTWh = (sumGwh * (365 / tail.length)) / 1000;
  return { annualTWh, latestDate: rows[rows.length - 1]?.date ?? "unknown", nRows: rows.length };
}

async function run({
  probe = true,
  now = new Date(),
  csvPath = CSV_PATH,
}: { probe?: boolean; now?: Date; csvPath?: string } = {}): Promise<RegionData> {
  let annualTWh: number;
  let latestDate: string;
  let sourceDetail: string;

  if (probe) {
    // Read the committed relay CSV first — it is local, cheap, and acts as the
    // freshness floor the live path has to beat.
    const csv = readCsvRelay(csvPath);
    const fromCsv = (reason: string) => ({
      annualTWh: csv.annualTWh,
      latestDate: csv.latestDate,
      sourceDetail: `CSV relay ${reason} (${csv.nRows}-day committed CSV, latest: ${csv.latestDate})`,
    });

    try {
      // Primary: XM SinerGox live API. Historically geoblocked outside Colombia
      // and expected to fail from Vercel/CI, but that is NOT reliable: on
      // 2026-08-01 the Vercel build fetched it successfully and got a series
      // ending 2026-04-03, ~4 months behind the relay CSV's 2026-07-28. The old
      // code preferred live unconditionally, so a reachable-but-stale API
      // silently overrode fresher relay data and pinned the region to
      // `degraded` with lastSuccessAt 2026-04-03. Freshness now decides, not
      // reachability: live has to be at least as recent as the CSV to win.
      const live = await fetchXmLast365Days();
      if (live.latestDate >= csv.latestDate) {
        annualTWh = live.annualTWh;
        latestDate = live.latestDate;
        sourceDetail = `XM SinerGox API live (${live.nDays} days, latest: ${live.latestDate})`;
      } else {
        console.error(
          `[colombia] XM live reachable but stale (latest ${live.latestDate} < relay CSV ${csv.latestDate}); using CSV relay`,
        );
        ({ annualTWh, latestDate, sourceDetail } = fromCsv("(live reachable but staler)"));
      }
    } catch (liveErr) {
      console.error(`[colombia] XM live fetch failed (${(liveErr as Error).message}); falling back to CSV relay`);
      ({ annualTWh, latestDate, sourceDetail } = fromCsv("fallback"));
    }
  } else {
    // Test path: skip live API, read CSV directly for deterministic results.
    const csv = readCsvRelay(csvPath);
    annualTWh = csv.annualTWh;
    latestDate = csv.latestDate;
    sourceDetail = `CSV relay (${csv.nRows}-day committed CSV, latest: ${csv.latestDate})`;
  }

  const base = buildTypicalHydroSeasonalRegion(
    REGION_ID,
    annualTWh,
    HYDRO_SEASONAL_SHARES.colombia,
    `XM SinerGox API (servapibi.xm.com.co/daily, MetricId=VertEner, Entity=Sistema). ` +
    `${sourceDetail}. ` +
    `5-yr baseline 7.53 TWh/yr (range 0.53–13.12 TWh/yr ENSO-driven). ` +
    `Bimodal Colombian hydro-seasonal shape (Apr–Jun + Oct–Nov peaks). T1b, ±50% envelope.`,
    "2026",
  );
  // Override T3-modelled → T1b: this loader is set up as a direct live source
  // (XM API primary, CSV relay fallback) rather than a purely static model.
  const result = applyUncertainty(base, { regionTier: "live-domestic-anchored" });

  // Relay-CSV freshness self-stamp: if the newest committed CSV row is older
  // than the staleness threshold, mark this region degraded so the globe
  // shows the amber ring. stampLive() in withFallback preserves pre-set
  // "degraded" status, so this stamp survives to the deployed JSON.
  const status = relayFreshness(latestDate, now, RELAY_STALENESS_THRESHOLD_DAYS);
  if (status === "degraded") {
    result.sourceStatus = "degraded";
    // lastSuccessAt records when fresh data was last seen in the relay CSV.
    // Use the newest row date as an ISO string (UTC midnight).
    result.lastSuccessAt = latestDate
      ? new Date(latestDate).toISOString()
      : result.lastSuccessAt;
  }

  return result;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "live-domestic-anchored" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("colombia loader failed", err);
      process.exit(1);
    });
}

export const buildColombiaData = () => run({ probe: false });

/** Test seam: run the Colombia loader with deterministic now and/or a fixture CSV path. */
export const runColombia = (opts: { probe?: boolean; now?: Date; csvPath?: string } = {}) =>
  run(opts);
