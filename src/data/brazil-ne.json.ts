import { fetchText } from "../lib/fetch.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW, latestCompleteUtcDayProfileGW } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData, CurtailmentPoint } from "../lib/types.js";
import { pathToFileURL } from "url";

const WIND_CSV_URL =
  "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/restricao_coff_eolica_tm/RESTRICAO_COFF_EOLICA_";
const SOLAR_CSV_URL =
  "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/restricao_coff_fotovoltaica_tm/RESTRICAO_COFF_FOTOVOLTAICA_";

type BrazilRegionId =
  | "brazil-rn"
  | "brazil-ce"
  | "brazil-bahia"
  | "brazil-piaui"
  | "brazil-pernambuco"
  | "brazil-mg"
  | "brazil-sp"
  | "brazil-mt"
  | "brazil-go"
  | "brazil-pr"
  | "brazil-rs"
  | "brazil-other";

// ONS constrained-off rows carry an explicit `id_estado` two-letter state
// code. Use that field directly rather than deriving state from `id_ons`
// prefixes; ONS documents `id_ons` as a plant/conjunto identifier, not as a
// stable state namespace.
const STATE_TO_REGION: Record<string, BrazilRegionId> = {
  RN: "brazil-rn",
  CE: "brazil-ce",
  BA: "brazil-bahia",
  PI: "brazil-piaui",
  PE: "brazil-pernambuco",
  MG: "brazil-mg",
  SP: "brazil-sp",
  MT: "brazil-mt",
  GO: "brazil-go",
  PR: "brazil-pr",
  RS: "brazil-rs",
};

/** Pure parser: CSV text → timestamped points grouped by state cluster. Exported for tests. */
export function parseOnsCurtailmentCsv(csv: string): Record<BrazilRegionId, CurtailmentPoint[]> {
  const normalized = csv.replace(/^\uFEFF/, "").trim();
  const empty: Record<BrazilRegionId, CurtailmentPoint[]> = {
    "brazil-rn": [],
    "brazil-ce": [],
    "brazil-bahia": [],
    "brazil-piaui": [],
    "brazil-pernambuco": [],
    "brazil-mg": [],
    "brazil-sp": [],
    "brazil-mt": [],
    "brazil-go": [],
    "brazil-pr": [],
    "brazil-rs": [],
    "brazil-other": [],
  };
  if (!normalized) return empty;

  const lines = normalized.split(/\r?\n/);
  if (lines.length < 2) return empty;

  const headers = lines[0].split(";");
  const timestampIndex = headers.indexOf("din_instante");
  const curtailedIndex = headers.indexOf("val_geracaolimitada");
  const stateIndex = headers.indexOf("id_estado");

  if (timestampIndex === -1 || curtailedIndex === -1 || stateIndex === -1) {
    throw new Error("ONS CSV missing required columns");
  }

  const totals = new Map<string, Map<string, number>>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const cells = line.split(";");
    const localTimestamp = cells[timestampIndex]?.trim();
    if (!localTimestamp) continue;
    const state = cells[stateIndex]?.trim().toUpperCase();
    const regionId = STATE_TO_REGION[state] ?? "brazil-other";

    const curtailedRaw = cells[curtailedIndex]?.trim() ?? "";
    const curtailedMw = curtailedRaw === "" ? 0 : Number(curtailedRaw);
    if (!Number.isFinite(curtailedMw)) continue;

    const match = localTimestamp.match(
      /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/
    );
    if (!match) continue;

    const [, year, month, day, hour, minute, second] = match;
    const utcMs = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) + 3,
      Number(minute),
      Number(second)
    );
    const utcTimestamp = new Date(utcMs).toISOString();

    let bucket = totals.get(regionId);
    if (!bucket) totals.set(regionId, (bucket = new Map<string, number>()));
    bucket.set(utcTimestamp, (bucket.get(utcTimestamp) ?? 0) + Math.max(0, curtailedMw));
  }

  for (const regionId of Object.keys(empty) as BrazilRegionId[]) {
    empty[regionId] = Array.from(totals.get(regionId)?.entries() ?? [])
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw: Math.max(0, mw) }));
  }

  return empty;
}

function makeEmptyBuckets(): Record<BrazilRegionId, CurtailmentPoint[]> {
  return {
    "brazil-rn": [],
    "brazil-ce": [],
    "brazil-bahia": [],
    "brazil-piaui": [],
    "brazil-pernambuco": [],
    "brazil-mg": [],
    "brazil-sp": [],
    "brazil-mt": [],
    "brazil-go": [],
    "brazil-pr": [],
    "brazil-rs": [],
    "brazil-other": [],
  };
}

/**
 * Merge two per-timestamp point arrays by summing MW at matching UTC
 * timestamps. Preserves sort order.
 */
function mergeSum(a: CurtailmentPoint[], b: CurtailmentPoint[]): CurtailmentPoint[] {
  const map = new Map<string, number>();
  for (const p of a) map.set(p.utcTimestamp, (map.get(p.utcTimestamp) ?? 0) + p.mw);
  for (const p of b) map.set(p.utcTimestamp, (map.get(p.utcTimestamp) ?? 0) + p.mw);
  return Array.from(map.entries())
    .sort(([x], [y]) => x.localeCompare(y))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));
}

/** Fetch the last two months of CSV — both wind AND solar — to give 30+ days' coverage. */
const run = async (): Promise<Record<BrazilRegionId, RegionData>> => {
  const now = new Date();
  const current = `${now.getUTCFullYear()}_${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const prevDate = new Date(now.getTime());
  prevDate.setUTCMonth(prevDate.getUTCMonth() - 1);
  const prev = `${prevDate.getUTCFullYear()}_${String(prevDate.getUTCMonth() + 1).padStart(2, "0")}`;

  const windUrls = [`${WIND_CSV_URL}${prev}.csv`, `${WIND_CSV_URL}${current}.csv`];
  const solarUrls = [`${SOLAR_CSV_URL}${prev}.csv`, `${SOLAR_CSV_URL}${current}.csv`];
  const windPoints = makeEmptyBuckets();
  const solarPoints = makeEmptyBuckets();

  async function fillFrom(urls: string[], sink: Record<BrazilRegionId, CurtailmentPoint[]>) {
    for (const url of urls) {
      try {
        const csv = await fetchText(url);
        const parsed = parseOnsCurtailmentCsv(csv);
        for (const regionId of Object.keys(sink) as BrazilRegionId[]) {
          sink[regionId].push(...parsed[regionId]);
        }
      } catch (err) {
        console.warn(`ons fetch skipped: ${url}: ${(err as Error).message}`);
      }
    }
  }

  await fillFrom(windUrls, windPoints);
  await fillFrom(solarUrls, solarPoints);

  const cutoff = now.getTime() - 30 * 24 * 3600 * 1000;
  const out = {} as Record<BrazilRegionId, RegionData>;
  for (const regionId of Object.keys(windPoints) as BrazilRegionId[]) {
    const windRecent = windPoints[regionId].filter(
      (p) => new Date(p.utcTimestamp).getTime() >= cutoff,
    );
    const solarRecent = solarPoints[regionId].filter(
      (p) => new Date(p.utcTimestamp).getTime() >= cutoff,
    );
    const combined = mergeSum(windRecent, solarRecent);

    // Observed volumes over the 30-day window — used to compute the real
    // wind/solar split this region actually shows right now. Brazil's NE
    // states vary wildly: Bahia + Piauí are increasingly solar-dominant,
    // RN + CE stay wind-heavy.
    const windTotalMw = windRecent.reduce((sum, p) => sum + p.mw, 0);
    const solarTotalMw = solarRecent.reduce((sum, p) => sum + p.mw, 0);
    const denom = windTotalMw + solarTotalMw;
    const fuelShare: { wind: number; solar: number } | undefined =
      denom > 0
        ? { wind: windTotalMw / denom, solar: solarTotalMw / denom }
        : undefined;

    out[regionId] = {
      regionId,
      profile: timeOfDayAverageGW(combined),
      latestProfile: latestCompleteUtcDayProfileGW(combined),
      totalTWh: totalTWh30d(combined),
      peakGW: peakGW(combined),
      lastUpdated: combined.at(-1)?.utcTimestamp ?? new Date().toISOString(),
      sourceNote: fuelShare
        ? `ONS Brazil direct constrained-off wind+solar curtailment (observed split: wind ${(fuelShare.wind * 100).toFixed(0)}% / solar ${(fuelShare.solar * 100).toFixed(0)}%)`
        : "ONS Brazil direct constrained-off wind+solar curtailment",
      ...(fuelShare ? { fuelShare } : {}),
    };
  }

  return out;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  withFallback<Record<BrazilRegionId, RegionData>>("brazil-ne", run, {
    tagLive: (r) => Object.fromEntries(
      Object.entries(r).map(([k, v]) => [k, { ...v, sourceStatus: "live" as const }]),
    ) as Record<BrazilRegionId, RegionData>,
    tagCached: (c) => Object.fromEntries(
      Object.entries(c).map(([k, v]) => [k, { ...v, sourceStatus: "cached" as const }]),
    ) as Record<BrazilRegionId, RegionData>,
  })
    .then((d) => process.stdout.write(JSON.stringify(d)))
    .catch((err) => {
      console.error("brazil-ne loader failed", err);
      process.exit(1);
    });
}
