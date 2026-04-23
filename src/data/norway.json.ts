import { withFallback } from "../lib/resilient.js";
import type { RegionData } from "../lib/types.js";
import { buildZoneData, parseEntsoeXml } from "../lib/entsoe.js";
import { fetchText } from "../lib/fetch.js";
import { pathToFileURL } from "url";

const API = "https://web-api.tp.entsoe.eu/api";
const NO4_DOMAIN = "10YNO-4--------9";

async function fetchSeries(psrType: string) {
  const token = process.env.ENTSOE_API_TOKEN;
  if (!token) throw new Error("ENTSOE_API_TOKEN not set");

  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:T]/g, "").slice(0, 12);
  const params = new URLSearchParams({
    securityToken: token,
    documentType: "A75",
    processType: "A16",
    in_Domain: NO4_DOMAIN,
    psrType,
    periodStart: fmt(start),
    periodEnd: fmt(now),
  });

  return parseEntsoeXml(await fetchText(`${API}?${params.toString()}`));
}

export async function buildNorwayData(): Promise<RegionData> {
  const [hydro, wind] = await Promise.all([fetchSeries("B12"), fetchSeries("B19")]);
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

  const base = buildZoneData(
    "n-norway",
    rawPoints,
    0.06,
    fuelShare
      ? `ENTSO-E NO-4 hydro+wind × 6% calibrated waste rate (observed 30d split: hydro ${(fuelShare.hydro * 100).toFixed(0)}% / wind ${(fuelShare.wind * 100).toFixed(0)}%; export-constrained north Norway proxy)`
      : "ENTSO-E NO-4 hydro+wind × 6% calibrated waste rate (export-constrained north Norway proxy)",
  );
  return fuelShare ? { ...base, fuelShare } : base;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>("norway", buildNorwayData, {
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("norway loader failed", err);
      process.exit(1);
    });
}
