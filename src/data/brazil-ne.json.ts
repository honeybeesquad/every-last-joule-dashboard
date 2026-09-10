import { fetchText } from "../lib/fetch.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW, latestCompleteUtcDayProfileGW } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData, CurtailmentPoint } from "../lib/types.js";
import { pathToFileURL } from "url";

const WIND_CSV_URL =
  "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/restricao_coff_eolica_tm/RESTRICAO_COFF_EOLICA_";
const SOLAR_CSV_URL =
  "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/restricao_coff_fotovoltaica_tm/RESTRICAO_COFF_FOTOVOLTAICA_";

type BrazilStateId =
  | "brazil-rn"
  | "brazil-ce"
  | "brazil-bahia"
  | "brazil-piaui"
  | "brazil-pernambuco"
  | "brazil-paraiba"
  | "brazil-maranhao"
  | "brazil-mg"
  | "brazil-sp"
  | "brazil-mt"
  | "brazil-go"
  | "brazil-pr"
  | "brazil-rs"
  | "brazil-other";
type BrazilFuel = "wind" | "solar";
type BrazilRegionId = `${BrazilStateId}-${BrazilFuel}`;

// ONS constrained-off rows carry an explicit `id_estado` two-letter state
// code. Use that field directly rather than deriving state from `id_ons`
// prefixes; ONS documents `id_ons` as a plant/conjunto identifier, not as a
// stable state namespace.
const STATE_TO_REGION: Record<string, BrazilStateId> = {
  RN: "brazil-rn",
  CE: "brazil-ce",
  BA: "brazil-bahia",
  PI: "brazil-piaui",
  PE: "brazil-pernambuco",
  PB: "brazil-paraiba",
  MA: "brazil-maranhao",
  MG: "brazil-mg",
  SP: "brazil-sp",
  MT: "brazil-mt",
  GO: "brazil-go",
  PR: "brazil-pr",
  RS: "brazil-rs",
};

/**
 * ONS publishes the constrained-off feed at a 30-minute cadence (`din_instante`
 * rows at :00 and :30). Each `val_geracao*` figure is an average-MW reading for
 * its half-hour interval, so every emitted point represents 0.5 h of energy.
 * Without this, `totalTWh30d` (which defaults to 1 h/point) double-counts the
 * curtailed energy — the profile/peakGW are unaffected because
 * `timeOfDayAverageGW` averages within each hour bucket.
 */
const ONS_INTERVAL_HOURS = 0.5;

/**
 * Restriction reason codes from the ONS data dictionary (`cod_razaorestricao`):
 * ENE energy/surplus, CNF reliability requirements, REL external (transmission)
 * unavailability, PAR restriction stated in the access opinion.
 */
export type OnsReason = "ENE" | "CNF" | "REL" | "PAR";
const ONS_REASONS: readonly OnsReason[] = ["ENE", "CNF", "REL", "PAR"];

export interface OnsReasonPoint {
  utcTimestamp: string;
  /** Curtailed MW in this half-hour, split by ONS reason code. */
  mwByReason: Record<OnsReason, number>;
}

export interface OnsParsed {
  points: Record<BrazilStateId, CurtailmentPoint[]>;
  reasons: Record<BrazilStateId, OnsReasonPoint[]>;
}

function parseOnsNumber(raw: string | undefined): number | null {
  const s = raw?.trim() ?? "";
  if (s === "") return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Pure parser: CSV text → timestamped points grouped by state cluster, plus the
 * same energy split by restriction reason. Exported for tests.
 *
 * Curtailed MW follows ONS's own definition of frustrated generation —
 * `val_geracaonaorealizadaapurada` (GNRa) in the dictionary published with the
 * dataset: `max(0, val_geracaoreferencia − val_geracao)` on intervals where ONS
 * set a generation limit (`val_geracaolimitada` non-null; null means no limit).
 * Files from 2026 carry GNRa as a column and it is read directly; older files
 * are recomputed from the definition, which reproduces the column to the MW
 * where both exist (checked on 2026-08 wind and solar).
 *
 * `val_geracaoreferenciafinal` is deliberately unused: the dictionary defines
 * it as computed only for REL intervals, for CCEE settlement — a fraction of
 * curtailment. `val_geracaolimitada` is the cap ONS imposed, not lost energy;
 * `reference − cap` (this loader's formula until 2026-09) undercounts by ~4%
 * because the cap binds in fewer than half of constrained intervals.
 */
export function parseOnsCurtailmentCsvDetailed(csv: string): OnsParsed {
  const normalized = csv.replace(/^﻿/, "").trim();
  const points = makeEmptyBuckets();
  const reasons = makeEmptyReasonBuckets();
  const out: OnsParsed = { points, reasons };
  if (!normalized) return out;

  const lines = normalized.split(/\r?\n/);
  if (lines.length < 2) return out;

  const headers = lines[0].split(";");
  const timestampIndex = headers.indexOf("din_instante");
  const generationIndex = headers.indexOf("val_geracao");
  const limitedIndex = headers.indexOf("val_geracaolimitada");
  const referenceIndex = headers.indexOf("val_geracaoreferencia");
  const gnraIndex = headers.indexOf("val_geracaonaorealizadaapurada"); // absent before 2026
  const reasonIndex = headers.indexOf("cod_razaorestricao");
  const stateIndex = headers.indexOf("id_estado");

  if (
    timestampIndex === -1 || generationIndex === -1 || limitedIndex === -1 ||
    referenceIndex === -1 || stateIndex === -1
  ) {
    throw new Error("ONS CSV missing required columns");
  }

  const totals = new Map<string, Map<string, number>>();
  const reasonTotals = new Map<string, Map<string, Record<OnsReason, number>>>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const cells = line.split(";");
    const localTimestamp = cells[timestampIndex]?.trim();
    if (!localTimestamp) continue;
    const state = cells[stateIndex]?.trim().toUpperCase();
    const regionId = STATE_TO_REGION[state] ?? "brazil-other";

    // Null cap = ONS set no limit in this interval (per the dictionary) — not curtailment.
    const limitedMw = parseOnsNumber(cells[limitedIndex]);
    if (limitedMw === null) continue;

    const generationMw = parseOnsNumber(cells[generationIndex]);
    const referenceMw = parseOnsNumber(cells[referenceIndex]);
    const gnraMw = gnraIndex === -1 ? null : parseOnsNumber(cells[gnraIndex]);
    let curtailedMw: number;
    if (gnraMw !== null) {
      curtailedMw = Math.max(0, gnraMw);
    } else if (generationMw !== null && referenceMw !== null) {
      curtailedMw = Math.max(0, referenceMw - generationMw);
    } else {
      // Verified generation or reference missing on a constrained row: fall back to reference − cap.
      curtailedMw = Math.max(0, (referenceMw ?? 0) - limitedMw);
    }

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
    bucket.set(utcTimestamp, (bucket.get(utcTimestamp) ?? 0) + curtailedMw);

    const reason = (reasonIndex === -1 ? "" : cells[reasonIndex]?.trim().toUpperCase() ?? "") as OnsReason;
    if (curtailedMw > 0 && ONS_REASONS.includes(reason)) {
      let reasonBucket = reasonTotals.get(regionId);
      if (!reasonBucket) reasonTotals.set(regionId, (reasonBucket = new Map()));
      let entry = reasonBucket.get(utcTimestamp);
      if (!entry) reasonBucket.set(utcTimestamp, (entry = { ENE: 0, CNF: 0, REL: 0, PAR: 0 }));
      entry[reason] += curtailedMw;
    }
  }

  for (const regionId of Object.keys(points) as BrazilStateId[]) {
    points[regionId] = Array.from(totals.get(regionId)?.entries() ?? [])
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw: Math.max(0, mw), intervalHours: ONS_INTERVAL_HOURS }));
    reasons[regionId] = Array.from(reasonTotals.get(regionId)?.entries() ?? [])
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([utcTimestamp, mwByReason]) => ({ utcTimestamp, mwByReason }));
  }

  return out;
}

/** Pure parser: CSV text → timestamped points grouped by state cluster. Exported for tests. */
export function parseOnsCurtailmentCsv(csv: string): Record<BrazilStateId, CurtailmentPoint[]> {
  return parseOnsCurtailmentCsvDetailed(csv).points;
}

/**
 * Share of curtailed energy by ONS reason code over a set of reason points,
 * e.g. `{ ENE: 0.61, CNF: 0.26, REL: 0.13 }`. Reasons with zero energy are
 * omitted; returns `{}` when nothing was curtailed.
 */
export function reasonShares(reasonPoints: OnsReasonPoint[]): Partial<Record<OnsReason, number>> {
  const sums: Record<OnsReason, number> = { ENE: 0, CNF: 0, REL: 0, PAR: 0 };
  for (const point of reasonPoints) {
    for (const reason of ONS_REASONS) sums[reason] += point.mwByReason[reason] ?? 0;
  }
  const total = ONS_REASONS.reduce((acc, reason) => acc + sums[reason], 0);
  if (total <= 0) return {};
  const shares: Partial<Record<OnsReason, number>> = {};
  for (const reason of ONS_REASONS) if (sums[reason] > 0) shares[reason] = sums[reason] / total;
  return shares;
}

/** "ENE 61% / CNF 26% / REL 13%" for the sourceNote; empty string when no split is available. */
function describeReasonShares(shares: Partial<Record<OnsReason, number>>): string {
  const parts = ONS_REASONS
    .filter((reason) => (shares[reason] ?? 0) > 0)
    .map((reason) => `${reason} ${Math.round((shares[reason] ?? 0) * 100)}%`);
  return parts.length ? `; reasons ${parts.join(" / ")}` : "";
}

function makeEmptyBuckets(): Record<BrazilStateId, CurtailmentPoint[]> {
  return {
    "brazil-rn": [],
    "brazil-ce": [],
    "brazil-bahia": [],
    "brazil-piaui": [],
    "brazil-pernambuco": [],
    "brazil-paraiba": [],
    "brazil-maranhao": [],
    "brazil-mg": [],
    "brazil-sp": [],
    "brazil-mt": [],
    "brazil-go": [],
    "brazil-pr": [],
    "brazil-rs": [],
    "brazil-other": [],
  };
}

function makeEmptyReasonBuckets(): Record<BrazilStateId, OnsReasonPoint[]> {
  return {
    "brazil-rn": [],
    "brazil-ce": [],
    "brazil-bahia": [],
    "brazil-piaui": [],
    "brazil-pernambuco": [],
    "brazil-paraiba": [],
    "brazil-maranhao": [],
    "brazil-mg": [],
    "brazil-sp": [],
    "brazil-mt": [],
    "brazil-go": [],
    "brazil-pr": [],
    "brazil-rs": [],
    "brazil-other": [],
  };
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
  const windReasons = makeEmptyReasonBuckets();
  const solarReasons = makeEmptyReasonBuckets();

  async function fillFrom(
    urls: string[],
    sink: Record<BrazilStateId, CurtailmentPoint[]>,
    reasonSink: Record<BrazilStateId, OnsReasonPoint[]>,
  ) {
    for (const url of urls) {
      try {
        const csv = await fetchText(url);
        const parsed = parseOnsCurtailmentCsvDetailed(csv);
        for (const regionId of Object.keys(sink) as BrazilStateId[]) {
          sink[regionId].push(...parsed.points[regionId]);
          reasonSink[regionId].push(...parsed.reasons[regionId]);
        }
      } catch (err) {
        console.warn(`ons fetch skipped: ${url}: ${(err as Error).message}`);
      }
    }
  }

  await fillFrom(windUrls, windPoints, windReasons);
  await fillFrom(solarUrls, solarPoints, solarReasons);

  const cutoff = now.getTime() - 30 * 24 * 3600 * 1000;
  const inWindow = <T extends { utcTimestamp: string }>(items: T[]): T[] =>
    items.filter((item) => new Date(item.utcTimestamp).getTime() >= cutoff);
  const out = {} as Record<BrazilRegionId, RegionData>;
  const buildRegion = (
    stateId: BrazilStateId,
    fuel: BrazilFuel,
    points: CurtailmentPoint[],
    reasonPoints: OnsReasonPoint[],
  ): RegionData => {
    const regionId = `${stateId}-${fuel}` as BrazilRegionId;
    const state = stateId.replace("brazil-", "").toUpperCase();
    return {
      regionId,
      profile: timeOfDayAverageGW(points),
      latestProfile: latestCompleteUtcDayProfileGW(points),
      totalTWh: totalTWh30d(points),
      peakGW: peakGW(points),
      lastUpdated: points.at(-1)?.utcTimestamp ?? new Date().toISOString(),
      lastSuccessAt: points.at(-1)?.utcTimestamp ?? new Date().toISOString(),
      sourceNote:
        `ONS Brazil direct constrained-off ${fuel} curtailment (${state}; ONS GNRa definition, ` +
        `reference − verified generation on limited half-hours${describeReasonShares(reasonShares(reasonPoints))})`,
    };
  };

  for (const stateId of Object.keys(windPoints) as BrazilStateId[]) {
    out[`${stateId}-wind` as BrazilRegionId] = buildRegion(
      stateId, "wind", inWindow(windPoints[stateId]), inWindow(windReasons[stateId]),
    );
    out[`${stateId}-solar` as BrazilRegionId] = buildRegion(
      stateId, "solar", inWindow(solarPoints[stateId]), inWindow(solarReasons[stateId]),
    );
  }

  return out;
};

function splitLegacyBrazilCache(
  cached: Record<BrazilStateId, RegionData> | Record<BrazilRegionId, RegionData>,
): Record<BrazilRegionId, RegionData> {
  if ("brazil-rn-wind" in cached && "brazil-rn-solar" in cached) {
    return cached as Record<BrazilRegionId, RegionData>;
  }

  const out = {} as Record<BrazilRegionId, RegionData>;
  for (const stateId of Object.keys(makeEmptyBuckets()) as BrazilStateId[]) {
    const parent = (cached as Record<BrazilStateId, RegionData>)[stateId];
    if (!parent) continue;
    const scale = (fuel: BrazilFuel, share: number): RegionData => ({
      ...parent,
      regionId: `${stateId}-${fuel}` as BrazilRegionId,
      profile: parent.profile.map((value) => value * share),
      latestProfile: parent.latestProfile ? parent.latestProfile.map((value) => value * share) : null,
      totalTWh: parent.totalTWh * share,
      peakGW: parent.peakGW * share,
      sourceNote: `ONS Brazil direct constrained-off ${fuel} curtailment (${stateId.replace("brazil-", "").toUpperCase()}; split from legacy state wind+solar cache)`,
      fuelShare: undefined,
      confidenceTier: undefined,
      uncertaintyLowGW: undefined,
      uncertaintyHighGW: undefined,
    });
    out[`${stateId}-wind` as BrazilRegionId] = scale("wind", parent.fuelShare?.wind ?? 0);
    out[`${stateId}-solar` as BrazilRegionId] = scale("solar", parent.fuelShare?.solar ?? 0);
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  withFallback<Record<BrazilRegionId, RegionData> | Record<BrazilStateId, RegionData>>("brazil-ne", run, {
    regionTier: "live" as const,
    tagLive: (r) => Object.fromEntries(
      Object.entries(r).map(([k, v]) => [k, { ...v, sourceStatus: "live" as const }]),
    ) as Record<BrazilRegionId, RegionData>,
    tagCached: (c) => splitLegacyBrazilCache(
      Object.fromEntries(
        Object.entries(c).map(([k, v]) => [k, { ...v, sourceStatus: "cached" as const }]),
      ) as Record<BrazilStateId, RegionData> | Record<BrazilRegionId, RegionData>,
    ),
  })
    .then((d) => process.stdout.write(JSON.stringify(splitLegacyBrazilCache(d))))
    .catch((err) => {
      console.error("brazil-ne loader failed", err);
      process.exit(1);
    });
}
