import { readFileSync } from "node:fs";
import { join } from "node:path";
import { withFallback } from "../lib/resilient.js";
import type { RegionData } from "../lib/types.js";
import { buildZoneData, parseEntsoeXml } from "../lib/entsoe.js";
import { fetchText } from "../lib/fetch.js";
import { pathToFileURL } from "url";
import { timeOfDayAverageGW, totalTWh30d, peakGW, latestCompleteUtcDayProfileGW } from "../lib/profile.js";

// Norway has five ENTSO-E bidding zones (NO1-NO5). Until 2026-04 the
// dashboard only modelled NO4 (`n-norway`), leaving 80% of Norwegian
// renewable generation — including NO2 (Kristiansand / offshore wind /
// NorNed+NordLink+North Sea Link cable landings) — entirely absent from
// the global curtailment picture. This loader queries each zone's
// hydro (B12) + wind (B19) actual generation from the ENTSO-E
// Transparency Platform and emits per-fuel RegionData records per zone.
//
// Phase 3c: each zone now returns BOTH a hydro and a wind entry.
// NO5 is hydro-only (no significant wind) and stays as a single entry.

const API = "https://web-api.tp.entsoe.eu/api";

interface ZoneSpec {
  id: string;                 // base region id prefix
  domain: string;             // ENTSO-E EIC code
  rate: number;               // calibrated waste rate
  label: string;              // short description for sourceNote
  hydroOnly?: boolean;        // if true, only emit hydro (no wind split)
}

const ZONES: readonly ZoneSpec[] = [
  { id: "norway-no1", domain: "10YNO-1--------2", rate: 0.015, label: "NO1 Oslo / South-East hydro (load-centre, low curtailment)" },
  { id: "norway-no2", domain: "10YNO-2--------T", rate: 0.08,  label: "NO2 Kristiansand / South-West hydro+offshore wind (NorNed/NordLink/North Sea Link cable zone, export-constrained)" },
  { id: "norway-no3", domain: "10YNO-3--------J", rate: 0.04,  label: "NO3 Trondheim / Central hydro+onshore wind" },
  { id: "norway-no4", domain: "10YNO-4--------9", rate: 0.06,  label: "NO4 Tromsø / North hydro+wind (export-constrained; unchanged from pre-split calibration)" },
  { id: "norway-no5", domain: "10YNO-5--------8", rate: 0.025, label: "NO5 Bergen / West reservoir hydro (spring-spill curtailment only)", hydroOnly: true },
];

async function fetchSeries(domain: string, psrType: string) {
  const token = process.env.ENTSOE_API_TOKEN;
  if (!token) throw new Error("ENTSOE_API_TOKEN not set");

  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:T]/g, "").slice(0, 12);
  const params = new URLSearchParams({
    securityToken: token,
    documentType: "A75",
    processType: "A16",
    in_Domain: domain,
    psrType,
    periodStart: fmt(start),
    periodEnd: fmt(now),
  });

  return parseEntsoeXml(await fetchText(`${API}?${params.toString()}`));
}

async function buildZone(spec: ZoneSpec): Promise<Record<string, RegionData>> {
  const [hydro, wind] = await Promise.all([
    fetchSeries(spec.domain, "B12"),
    spec.hydroOnly ? Promise.resolve([]) : fetchSeries(spec.domain, "B19"),
  ]);

  if (spec.hydroOnly) {
    // NO5: single hydro entry only
    if (hydro.length === 0) {
      throw new Error(`Norway ${spec.id}: ENTSO-E returned no hydro data`);
    }
    const hydroTotalMw = hydro.reduce((s, p) => s + p.mw, 0);
    const note = `${spec.label} × ${(spec.rate * 100).toFixed(1)}% rate`;
    const base = buildZoneData(spec.id, hydro, spec.rate, note);
    return { [spec.id]: base };
  }

  if (hydro.length === 0 && wind.length === 0) {
    throw new Error(`Norway ${spec.id}: ENTSO-E returned no hydro or wind data`);
  }
  if (hydro.length === 0) {
    throw new Error(`Norway ${spec.id}: ENTSO-E returned no hydro data`);
  }
  if (wind.length === 0) {
    throw new Error(`Norway ${spec.id}: ENTSO-E returned no wind data`);
  }

  const hydroTotalMw = hydro.reduce((s, p) => s + p.mw, 0);
  const windTotalMw = wind.reduce((s, p) => s + p.mw, 0);
  const denom = hydroTotalMw + windTotalMw;
  const fuelShare = denom > 0
    ? { hydro: hydroTotalMw / denom, wind: windTotalMw / denom }
    : undefined;

  const noteSuffix = fuelShare
    ? `× ${(spec.rate * 100).toFixed(1)}% rate (observed 30d split: hydro ${(fuelShare.hydro * 100).toFixed(0)}% / wind ${(fuelShare.wind * 100).toFixed(0)}%)`
    : `× ${(spec.rate * 100).toFixed(1)}% rate`;

  const hydroData = buildZoneData(`${spec.id}-hydro`, hydro, spec.rate, `${spec.label} ${noteSuffix} — hydro share`);
  const windData = buildZoneData(`${spec.id}-wind`, wind, spec.rate, `${spec.label} ${noteSuffix} — wind share`);

  return {
    [`${spec.id}-hydro`]: fuelShare ? { ...hydroData, fuelShare } : hydroData,
    [`${spec.id}-wind`]: fuelShare ? { ...windData, fuelShare } : windData,
  };
}

export async function buildNorwayData(): Promise<Record<string, RegionData>> {
  const cachePath = join(process.cwd(), "data", "snapshots", "last-good", "norway.json");
  let previous: Record<string, RegionData> = {};
  try {
    previous = JSON.parse(readFileSync(cachePath, "utf-8")) as Record<string, RegionData>;
  } catch { /* no previous cache */ }

  const out: Record<string, RegionData> = {};
  let anySuccess = false;

  for (const spec of ZONES) {
    try {
      const zoneResult = await buildZone(spec);
      Object.assign(out, zoneResult);
      anySuccess = true;
    } catch (err) {
      console.warn(`Norway zone ${spec.id} failed: ${(err as Error).message}`);
      const keys = spec.hydroOnly ? [spec.id] : [`${spec.id}-hydro`, `${spec.id}-wind`];
      for (const key of keys) {
        if (previous[key]) {
          out[key] = previous[key];
        } else {
          throw new Error(`Norway zone ${spec.id} failed and no cached data for ${key}`);
        }
      }
    }
  }

  if (!anySuccess) {
    throw new Error("All Norway zones failed");
  }

  return out;
}

function tagMulti(
  r: Record<string, RegionData>,
  status: "live" | "cached",
): Record<string, RegionData> {
  const tagged: Record<string, RegionData> = {};
  for (const [k, v] of Object.entries(r)) tagged[k] = { ...v, sourceStatus: status };
  return tagged;
}

// Migration shim: old snapshots had either:
//   - a single RegionData (n-norway legacy)
//   - a Record keyed by norway-no1..norway-no5 (Phase 3b, mixed kind)
// Promote to the per-fuel shape for the new IDs.
function placeholderZone(id: string, lastUpdated: string): RegionData {
  return {
    regionId: id,
    profile: Array(24).fill(0),
    latestProfile: null,
    totalTWh: 0,
    peakGW: 0,
    lastUpdated,
    lastSuccessAt: lastUpdated,
    sourceNote: `${id} placeholder — awaiting first live ENTSO-E fetch after 2026-05 Norway per-fuel split`,
  };
}

function migrateCached(
  cached: Record<string, RegionData> | RegionData,
): Record<string, RegionData> {
  if (cached && typeof cached === "object" && "regionId" in cached) {
    // Legacy single RegionData (n-norway era) — no longer supported; snapshot
    // must be regenerated to the per-fuel format.
    throw new Error(
      "Legacy n-norway snapshot no longer supported; regenerate with: npx tsx src/data/norway.json.ts",
    );
  }
  const old = cached as Record<string, RegionData>;
  // Phase 3b shape had norway-no1..no5 — check if already per-fuel
  if ("norway-no1-hydro" in old) return old;
  // Phase 3b mixed shape — migrate each zone to per-fuel
  const ts = old["norway-no1"]?.lastUpdated ?? new Date().toISOString();
  const out: Record<string, RegionData> = {};
  for (const zone of ["norway-no1", "norway-no2", "norway-no3", "norway-no4"]) {
    const prev = old[zone];
    if (prev) {
      const hydroShare = prev.fuelShare?.hydro ?? 0.7;
      const windShare = prev.fuelShare?.wind ?? 0.3;
      out[`${zone}-hydro`] = { ...prev, regionId: `${zone}-hydro`, totalTWh: prev.totalTWh * hydroShare, peakGW: prev.peakGW * hydroShare };
      out[`${zone}-wind`] = { ...prev, regionId: `${zone}-wind`, totalTWh: prev.totalTWh * windShare, peakGW: prev.peakGW * windShare };
    } else {
      throw new Error(
        `Norway cached snapshot missing ${zone}; regenerate with: npx tsx src/data/norway.json.ts`,
      );
    }
  }
  out["norway-no5"] = old["norway-no5"] ?? placeholderZone("norway-no5", ts);
  return out;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<Record<string, RegionData> | RegionData>("norway", buildNorwayData, {
    regionTier: "live" as const,
    tagLive: (r) => tagMulti(r as Record<string, RegionData>, "live"),
    tagCached: (c) => tagMulti(migrateCached(c), "cached"),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("norway loader failed", err);
      process.exit(1);
    });
}
