import { fetchText } from "../lib/fetch.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW, latestCompleteUtcDayProfileGW } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData, CurtailmentPoint } from "../lib/types.js";
import { pathToFileURL } from "url";

const CSV_URL =
  "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/restricao_coff_eolica_tm/RESTRICAO_COFF_EOLICA_";

type BrazilRegionId =
  | "brazil-rn"
  | "brazil-ce"
  | "brazil-bahia"
  | "brazil-piaui"
  | "brazil-pernambuco"
  | "brazil-other";

const STATE_TO_REGION: Record<string, BrazilRegionId> = {
  RN: "brazil-rn",
  CE: "brazil-ce",
  BA: "brazil-bahia",
  PI: "brazil-piaui",
  PE: "brazil-pernambuco",
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

/** Fetch the last two months of CSV to give 30+ days' coverage. */
const run = async (): Promise<Record<BrazilRegionId, RegionData>> => {
  const now = new Date();
  const current = `${now.getUTCFullYear()}_${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const prevDate = new Date(now.getTime());
  prevDate.setUTCMonth(prevDate.getUTCMonth() - 1);
  const prev = `${prevDate.getUTCFullYear()}_${String(prevDate.getUTCMonth() + 1).padStart(2, "0")}`;

  const urls = [`${CSV_URL}${prev}.csv`, `${CSV_URL}${current}.csv`];
  const combined: Record<BrazilRegionId, CurtailmentPoint[]> = {
    "brazil-rn": [],
    "brazil-ce": [],
    "brazil-bahia": [],
    "brazil-piaui": [],
    "brazil-pernambuco": [],
    "brazil-other": [],
  };

  for (const url of urls) {
    try {
      const csv = await fetchText(url);
      const parsed = parseOnsCurtailmentCsv(csv);
      for (const regionId of Object.keys(combined) as BrazilRegionId[]) {
        combined[regionId].push(...parsed[regionId]);
      }
    } catch (err) {
      console.warn(`ons fetch skipped: ${url}: ${(err as Error).message}`);
    }
  }

  const cutoff = now.getTime() - 30 * 24 * 3600 * 1000;
  const out = {} as Record<BrazilRegionId, RegionData>;
  for (const regionId of Object.keys(combined) as BrazilRegionId[]) {
    const recent = combined[regionId].filter(
      (p) => new Date(p.utcTimestamp).getTime() >= cutoff,
    );
    out[regionId] = {
      regionId,
      profile: timeOfDayAverageGW(recent),
      latestProfile: latestCompleteUtcDayProfileGW(recent),
      totalTWh: totalTWh30d(recent),
      peakGW: peakGW(recent),
      lastUpdated: recent.at(-1)?.utcTimestamp ?? new Date().toISOString(),
      sourceNote: "ONS Brazil direct constrained-off wind curtailment clustered by state",
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
