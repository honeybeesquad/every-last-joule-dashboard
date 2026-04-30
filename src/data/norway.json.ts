import { withFallback } from "../lib/resilient.js";
import type { RegionData } from "../lib/types.js";
import { buildZoneData, parseEntsoeXml } from "../lib/entsoe.js";
import { fetchText } from "../lib/fetch.js";
import { pathToFileURL } from "url";

// Norway has five ENTSO-E bidding zones (NO1-NO5). Until 2026-04 the
// dashboard only modelled NO4 (`n-norway`), leaving 80% of Norwegian
// renewable generation — including NO2 (Kristiansand / offshore wind /
// NorNed+NordLink+North Sea Link cable landings) — entirely absent from
// the global curtailment picture. This loader queries each zone's
// hydro (B12) + wind (B19) actual generation from the ENTSO-E
// Transparency Platform and emits a RegionData record per zone.
//
// Calibration rates are zone-specific first-pass values. NO2 is
// highest (offshore wind build-out + tight export capacity to the
// Continent). NO1 is lowest (load centre, demand-matched hydro). The
// companion docs/methodology/entsoe-rates.md (Tier 1.2 audit) will
// refine these against Statnett and NVE published figures.

const API = "https://web-api.tp.entsoe.eu/api";

interface ZoneSpec {
  id: string;                 // region id in the dashboard
  domain: string;             // ENTSO-E EIC code
  rate: number;               // calibrated waste rate
  label: string;              // short description for sourceNote
}

const ZONES: readonly ZoneSpec[] = [
  { id: "norway-no1", domain: "10YNO-1--------2", rate: 0.015, label: "NO1 Oslo / South-East hydro (load-centre, low curtailment)" },
  { id: "norway-no2", domain: "10YNO-2--------T", rate: 0.08,  label: "NO2 Kristiansand / South-West hydro+offshore wind (NorNed/NordLink/North Sea Link cable zone, export-constrained)" },
  { id: "norway-no3", domain: "10YNO-3--------J", rate: 0.04,  label: "NO3 Trondheim / Central hydro+onshore wind" },
  { id: "norway-no4", domain: "10YNO-4--------9", rate: 0.06,  label: "NO4 Tromsø / North hydro+wind (export-constrained; unchanged from pre-split calibration)" },
  { id: "norway-no5", domain: "10YNO-5--------8", rate: 0.025, label: "NO5 Bergen / West reservoir hydro (spring-spill curtailment only)" },
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

async function buildZone(spec: ZoneSpec): Promise<RegionData> {
  const [hydro, wind] = await Promise.all([
    fetchSeries(spec.domain, "B12"),
    fetchSeries(spec.domain, "B19"),
  ]);

  const summed = new Map<string, number>();
  for (const point of [...hydro, ...wind]) {
    summed.set(point.utcTimestamp, (summed.get(point.utcTimestamp) ?? 0) + point.mw);
  }
  const rawPoints = Array.from(summed.entries())
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }))
    .sort((a, b) => a.utcTimestamp.localeCompare(b.utcTimestamp));

  const hydroTotalMw = hydro.reduce((s, p) => s + p.mw, 0);
  const windTotalMw = wind.reduce((s, p) => s + p.mw, 0);
  const denom = hydroTotalMw + windTotalMw;
  const fuelShare = denom > 0
    ? { hydro: hydroTotalMw / denom, wind: windTotalMw / denom }
    : undefined;

  const note = fuelShare
    ? `${spec.label} × ${(spec.rate * 100).toFixed(1)}% rate (observed 30d split: hydro ${(fuelShare.hydro * 100).toFixed(0)}% / wind ${(fuelShare.wind * 100).toFixed(0)}%)`
    : `${spec.label} × ${(spec.rate * 100).toFixed(1)}% rate`;

  const base = buildZoneData(spec.id, rawPoints, spec.rate, note);
  return fuelShare ? { ...base, fuelShare } : base;
}

export async function buildNorwayData(): Promise<Record<string, RegionData>> {
  const results = await Promise.all(ZONES.map(buildZone));
  const out: Record<string, RegionData> = {};
  for (let i = 0; i < ZONES.length; i++) out[ZONES[i].id] = results[i];
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

// Migration shim: the pre-2026-04-24 snapshot held a single RegionData
// for n-norway. If an old-shape snapshot is the only cached fallback
// available, promote it to the norway-no4 slot and synthesise zero-valued
// placeholders for the other four zones so downstream code (aggregation,
// region-map lookups) still gets a complete 5-zone Record. The next
// successful live fetch overwrites the entire snapshot with real data.
function placeholderZone(id: string, lastUpdated: string): RegionData {
  return {
    regionId: id,
    profile: Array(24).fill(0),
    latestProfile: null,
    totalTWh: 0,
    peakGW: 0,
    lastUpdated,
    lastSuccessAt: lastUpdated,
    sourceNote: `${id} placeholder — awaiting first live ENTSO-E fetch after 2026-04-24 Norway zone split`,
  };
}

function migrateCached(
  cached: Record<string, RegionData> | RegionData,
): Record<string, RegionData> {
  if (cached && typeof cached === "object" && "regionId" in cached) {
    const old = cached as RegionData;
    const renamed: RegionData = { ...old, regionId: "norway-no4" };
    const ts = old.lastUpdated ?? new Date().toISOString();
    return {
      "norway-no1": placeholderZone("norway-no1", ts),
      "norway-no2": placeholderZone("norway-no2", ts),
      "norway-no3": placeholderZone("norway-no3", ts),
      "norway-no4": renamed,
      "norway-no5": placeholderZone("norway-no5", ts),
    };
  }
  return cached as Record<string, RegionData>;
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
