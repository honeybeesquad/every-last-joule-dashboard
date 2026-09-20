/**
 * Dominican Republic — OC SENI GetGeneracionReprogramadaJSon.
 *
 * Hourly PROGRAMADO / GENERACION / DESVIACION for the whole system. Not a
 * VRE fuel split and not curtailment. Generation is collected; waste unpublished.
 * The previous IRENA 0.5 / 0.3 TWh invented waste anchors are dropped.
 *
 * dominican-republic carries total SENI generation. dominican-republic-wind
 * stays a grid marker (OC does not fuel-split) with unpublished empty generation.
 */

import { pathToFileURL } from "url";
import { mapWithConcurrency } from "../lib/concurrency.js";
import { fetchJSON } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import { unpublishedEmptyRegion, unpublishedGenerationRegion } from "../lib/waste-status.js";

const SOLAR_ID = "dominican-republic";
const WIND_ID = "dominican-republic-wind";
const AST_OFFSET_HOURS = 4;
const DAYS = 14;
const OC_URL =
  "https://apps.oc.org.do/wsOCWebsiteChart/Service.asmx/GetGeneracionReprogramadaJSon";
const NOTE =
  "OC SENI GetGeneracionReprogramadaJSon GENERACION MW (total system, not VRE). " +
  "Waste unpublished — OC does not publish a curtailment column. Missing ≠ zero. Not T1a.";

export interface OcGenerationRow {
  FECHA: string;
  PERIODO: number;
  PROGRAMADO: number;
  GENERACION: number;
  DESVIACION: number;
}

export function parseOcGeneration(payload: { GetGeneracionReprogramada?: OcGenerationRow[] }): CurtailmentPoint[] {
  const rows = payload.GetGeneracionReprogramada ?? [];
  const byTs = new Map<string, number>();
  for (const row of rows) {
    const m = String(row.FECHA).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})/);
    if (!m) continue;
    const utc = Date.UTC(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]) + AST_OFFSET_HOURS,
      0,
      0,
    );
    const mw = Number(row.GENERACION);
    if (!Number.isFinite(mw) || mw < 0) continue;
    byTs.set(new Date(utc).toISOString(), mw);
  }
  return Array.from(byTs.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));
}

export function buildDominicanFromOcJson(
  payloads: { GetGeneracionReprogramada?: OcGenerationRow[] }[],
): Record<string, RegionData> {
  const points = mergeHourly(payloads.flatMap((p) => parseOcGeneration(p)));
  if (points.length < 24) {
    throw new Error(`OC SENI returned ${points.length} hourly rows, need 24`);
  }
  const gen = unpublishedGenerationRegion(SOLAR_ID, "mixed", points, NOTE);
  const wind = applyUncertainty(
    unpublishedEmptyRegion(
      WIND_ID,
      "OC SENI does not fuel-split. Total generation is on dominican-republic. Waste unpublished.",
      points.at(-1)?.utcTimestamp,
    ),
    { regionTier: "estimated", profileKind: "wind" },
  );
  return { [SOLAR_ID]: gen, [WIND_ID]: { ...wind, sourceProvenance: "official-lead" } };
}

function mergeHourly(points: CurtailmentPoint[]): CurtailmentPoint[] {
  const map = new Map<string, number>();
  for (const p of points) map.set(p.utcTimestamp, p.mw);
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));
}

function ocFechaParams(now = new Date()): string[] {
  const ast = new Date(now.getTime() - AST_OFFSET_HOURS * 3_600_000);
  const out: string[] = [];
  for (let back = 0; back < DAYS; back++) {
    const d = new Date(Date.UTC(ast.getUTCFullYear(), ast.getUTCMonth(), ast.getUTCDate() - back));
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    out.push(`${mm}/${dd}/${d.getUTCFullYear()}`);
  }
  return out;
}

async function fetchOneDay(fecha: string): Promise<{ GetGeneracionReprogramada?: OcGenerationRow[] } | null> {
  const url = `${OC_URL}?Fecha=${encodeURIComponent(fecha)}`;
  try {
    return await fetchJSON(url, {
      timeoutMs: 10000,
      retries: 1,
      headers: { "user-agent": "Mozilla/5.0", accept: "application/json" },
    });
  } catch {
    return null;
  }
}

async function run(): Promise<Record<string, RegionData>> {
  const payloads = (await mapWithConcurrency(ocFechaParams(), 4, fetchOneDay)).filter(
    (p): p is { GetGeneracionReprogramada?: OcGenerationRow[] } => p != null,
  );
  if (payloads.length < 1) throw new Error("OC SENI: no daily JSON fetched");
  return buildDominicanFromOcJson(payloads);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback<Record<string, RegionData>>("dominican", () => run(), {
    regionTier: "estimated" as const,
    tagLive: (r) => r,
    tagCached: (c) => c as Record<string, RegionData>,
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("dominican loader failed", err);
      process.exit(1);
    });
}

export const buildDominicanData = run;
