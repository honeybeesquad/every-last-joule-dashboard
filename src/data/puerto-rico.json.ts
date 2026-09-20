/**
 * Puerto Rico — PREPA/LUMA/Genera operational generation.
 *
 * Live snapshot: https://operationdata.prepa.pr.gov/dataSource.js
 * (utility-scale PPOA solar + wind SiteTotal MW). Not a 30-day archive.
 * abed appends distinct `dataFechaAcualizado` rows to
 * `data/historical/puerto-rico-genera.csv` (NordVPN Puerto_Rico / United_States
 * on 403 — same private-repo path as Colombia/Argentina).
 *
 * Waste unpublished. EIA-930 has no PR BA. Not T1a. Missing ≠ zero.
 * Until the lake has 24 distinct snapshots, emit unpublished empty
 * generation — do not clone a single 7am snapshot into a fake diurnal.
 */

import { pathToFileURL, fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import { unpublishedEmptyRegion, unpublishedGenerationRegion } from "../lib/waste-status.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, "../../data/historical/puerto-rico-genera.csv");

const SOLAR_ID = "puerto-rico-solar";
const WIND_ID = "puerto-rico-wind";

const NOTE =
  "PREPA operationdata.prepa.pr.gov dataSource.js (utility-scale PPOA SiteTotal MW; abed NordVPN relay CSV). " +
  "Waste unpublished — no curtailment column. EIA-930 has no PR BA. Missing ≠ zero. Not T1a.";

export interface PrepaCsvRow {
  utcTimestamp: string;
  solarMw: number;
  windMw: number;
  systemMw: number | null;
}

export function parsePrepaCsv(text: string): PrepaCsvRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const header = lines[0].split(",");
  const tsIdx = header.indexOf("utc_timestamp");
  const solarIdx = header.indexOf("solar_mw");
  const windIdx = header.indexOf("wind_mw");
  const systemIdx = header.indexOf("system_mw");
  if (tsIdx < 0 || solarIdx < 0 || windIdx < 0) {
    throw new Error("PREPA CSV missing utc_timestamp / solar_mw / wind_mw");
  }
  const out: PrepaCsvRow[] = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cols = line.split(",");
    const utcTimestamp = cols[tsIdx]?.trim() ?? "";
    const solarMw = Number(cols[solarIdx]);
    const windMw = Number(cols[windIdx]);
    const systemRaw = systemIdx >= 0 ? cols[systemIdx]?.trim() : "";
    const systemMw = systemRaw ? Number(systemRaw) : NaN;
    if (!utcTimestamp || !Number.isFinite(solarMw) || !Number.isFinite(windMw)) continue;
    out.push({
      utcTimestamp,
      solarMw: Math.max(0, solarMw),
      windMw: Math.max(0, windMw),
      systemMw: Number.isFinite(systemMw) ? systemMw : null,
    });
  }
  out.sort((a, b) => a.utcTimestamp.localeCompare(b.utcTimestamp));
  return out;
}

function pointsFor(rows: PrepaCsvRow[], fuel: "solar" | "wind"): CurtailmentPoint[] {
  return rows.map((row) => ({
    utcTimestamp: row.utcTimestamp,
    mw: fuel === "solar" ? row.solarMw : row.windMw,
  }));
}

function emptyFuel(
  id: string,
  kind: "solar" | "wind",
  note: string,
  lastUpdated: string,
): RegionData {
  return {
    ...applyUncertainty(unpublishedEmptyRegion(id, note, lastUpdated), {
      regionTier: "estimated",
      profileKind: kind,
    }),
    sourceProvenance: "official-lead",
  };
}

export function buildPuertoRicoFromCsv(text: string): { solar: RegionData; wind: RegionData } {
  const rows = parsePrepaCsv(text);
  const last = rows.at(-1)?.utcTimestamp ?? new Date().toISOString();
  const solarNote = `${NOTE} — solar (utility-scale PPOA).`;
  const windNote = `${NOTE} — wind (utility-scale PPOA).`;
  // Count distinct UTC hours, not rows. The lake is appended one row per
  // distinct `dataFechaAcualizado`, and PREPA republishes every ~6 minutes,
  // so a sub-hourly cron, a retry storm, or a few manual runs while the
  // relay is being set up all reach 24 ROWS inside a few hours. That passes
  // a row-count guard and then timeOfDayAverageGW leaves every uncovered
  // hour at 0 — publishing a day that is mostly zero generation, including
  // overnight wind, which is its own fabrication rather than the 7am-clone
  // one this guard was written to stop. Same rule as
  // latestCompleteUtcDayProfileGW: missing any hour makes the day ineligible.
  const distinctHours = new Set(
    rows.map((row) => new Date(row.utcTimestamp).getUTCHours()),
  ).size;
  if (distinctHours < 24) {
    const filling =
      ` Relay lake has ${rows.length} snapshot(s) covering ${distinctHours}/24 UTC hours;` +
      ` need 24 distinct hours before a diurnal generation profile is emitted.`;
    return {
      solar: emptyFuel(SOLAR_ID, "solar", solarNote + filling, last),
      wind: emptyFuel(WIND_ID, "wind", windNote + filling, last),
    };
  }
  return {
    solar: unpublishedGenerationRegion(SOLAR_ID, "solar", pointsFor(rows, "solar"), solarNote),
    wind: unpublishedGenerationRegion(WIND_ID, "wind", pointsFor(rows, "wind"), windNote),
  };
}

function readCsvText(): string {
  return readFileSync(CSV_PATH, "utf-8");
}

async function run(): Promise<{ solar: RegionData; wind: RegionData }> {
  let text: string;
  try {
    text = readCsvText();
  } catch {
    throw new Error("PREPA relay CSV missing (data/historical/puerto-rico-genera.csv)");
  }
  return buildPuertoRicoFromCsv(text);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<{ solar: RegionData; wind: RegionData }>("puerto-rico", () => run(), {
    regionTier: "estimated" as const,
    tagLive: (r) => r,
    tagCached: (c) => c as { solar: RegionData; wind: RegionData },
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("puerto-rico loader failed", err);
      process.exit(1);
    });
}

export const buildPuertoRicoData = () => run();
