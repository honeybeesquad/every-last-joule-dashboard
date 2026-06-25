/**
 * germany-curtailment.json.ts
 *
 * Measured German renewable curtailment from the netztransparenz.de redispatch
 * API. Replaces the ENTSO-E generation × rate proxy for the 4 German TSO zones
 * (50Hertz, Amprion, TenneT DE, TransnetBW).
 *
 * Data source: netztransparenz.de "Redispatch" API (ds.netztransparenz.de)
 *   - OAuth2 client_credentials token → Bearer header
 *   - CSV with semicolon delimiter, German decimal notation (. = thousands, , = decimal)
 *   - Measured renewable curtailment = RICHTUNG starts "Wirkleistungseinspeisung reduzieren"
 *     AND PRIMAERENERGIEART == "Erneuerbar"
 *   - Per-TSO: ANWEISENDER_UENB ∈ {50Hertz, Amprion, TenneT DE, TransnetBW}
 *   - Settlement lag ~1–2 months: query latest complete calendar month
 *
 * Wind/solar split: the feed reports renewable curtailment without a fuel
 * breakdown. We read the current entsoe.json snapshot to get wind vs solar
 * totalTWh per TSO and use that ratio (fw = wind/(wind+solar)) to apportion
 * each TSO's measured curtailment into wind and solar sub-regions. The
 * magnitude is MEASURED; the wind/solar split is ESTIMATED (hence T1b tier
 * persists — the source note documents this explicitly).
 *
 * On any failure (OAuth, network, empty response, backend pool down) the
 * loader falls back via withFallback() to the last-good snapshot. All
 * diagnostics go to stderr (console.warn/error). stdout is the emitted JSON.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { withFallback } from "../lib/resilient.js";
import type { RegionData } from "../lib/types.js";
import { pathToFileURL } from "url";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOKEN_URL = "https://identity.netztransparenz.de/users/connect/token";
const API_BASE = "https://ds.netztransparenz.de";
const SCOPE = "ntpStatistic.read_all_public";

/** netztransparenz ANWEISENDER_UENB values → our region-id stems */
const TSO_MAP: Record<string, string> = {
  "50Hertz":     "50hertz",
  "Amprion":     "amprion",
  "TenneT DE":   "tennet-de",
  "TransnetBW":  "transnetbw",
};

/** Fuels we emit per TSO */
const FUELS = ["wind", "solar"] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

interface CsvRow {
  BEGINN_DATUM: string;
  BEGINN_UHRZEIT: string;
  ZEITZONE_VON: string;
  ENDE_DATUM: string;
  ENDE_UHRZEIT: string;
  ZEITZONE_BIS: string;
  RICHTUNG: string;
  MITTLERE_LEISTUNG_MW: string;
  GESAMTE_ARBEIT_MWH: string;
  ANWEISENDER_UENB: string;
  PRIMAERENERGIEART: string;
}

// ---------------------------------------------------------------------------
// OAuth2 token
// ---------------------------------------------------------------------------

export async function fetchToken(): Promise<string> {
  const clientId = process.env.NETZTRANSPARENZ_CLIENT_ID;
  const clientSecret = process.env.NETZTRANSPARENZ_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "NETZTRANSPARENZ_CLIENT_ID and NETZTRANSPARENZ_CLIENT_SECRET must be set",
    );
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: SCOPE,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`OAuth2 token request failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as TokenResponse;
  if (!data.access_token) {
    throw new Error("OAuth2 response missing access_token");
  }
  return data.access_token;
}

// ---------------------------------------------------------------------------
// CSV fetch
// ---------------------------------------------------------------------------

async function fetchRedispatchCsv(
  token: string,
  fromUtc: string,
  toUtc: string,
): Promise<string> {
  const url = `${API_BASE}/api/v1/data/redispatch/${fromUtc}/${toUtc}`;
  console.warn(`[germany-curtailment] fetching ${url}`);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    // F5 BIG-IP returns 404 for all requests when backend pool is down.
    // This is a transient outage, not a wrong endpoint.
    throw new Error(
      `Redispatch API returned ${res.status} ${res.statusText} — ` +
        (res.status === 404
          ? "possible F5 BIG-IP backend pool outage (transient)"
          : "check credentials/endpoint"),
    );
  }

  const text = await res.text();
  return text;
}

// ---------------------------------------------------------------------------
// German decimal parser
// ---------------------------------------------------------------------------

/**
 * Parse a German-formatted decimal number.
 * Thousands separator is "." (remove it); decimal separator is "," (→ ".").
 * E.g. "1.234,56" → 1234.56; "282,19" → 282.19; "385" → 385.
 */
export function parseGermanDecimal(s: string): number {
  const cleaned = s.trim().replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  if (Number.isNaN(n)) throw new Error(`Cannot parse German decimal: "${s}"`);
  return n;
}

// ---------------------------------------------------------------------------
// CSV parser
// ---------------------------------------------------------------------------

/**
 * Parse netztransparenz semicolon-CSV (UTF-8 with optional BOM).
 * Returns rows as objects keyed by header name.
 */
export function parseRedispatchCsv(raw: string): CsvRow[] {
  // Strip BOM if present
  const text = raw.startsWith("﻿") ? raw.slice(1) : raw;
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];

  const headers = lines[0].split(";").map((h) => h.trim());
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";");
    if (cols.length !== headers.length) continue;
    const obj: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = cols[j].trim();
    }
    rows.push(obj as unknown as CsvRow);
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Renewable curtailment filter
// ---------------------------------------------------------------------------

/**
 * Filter to rows that are measured renewable curtailment:
 *   PRIMAERENERGIEART == "Erneuerbar"
 *   RICHTUNG starts with "Wirkleistungseinspeisung reduzieren"
 *   ANWEISENDER_UENB is one of the 4 German TSOs
 */
export function filterRenewableCurtailment(rows: CsvRow[]): CsvRow[] {
  return rows.filter(
    (r) =>
      r.PRIMAERENERGIEART === "Erneuerbar" &&
      r.RICHTUNG.startsWith("Wirkleistungseinspeisung reduzieren") &&
      TSO_MAP[r.ANWEISENDER_UENB] !== undefined,
  );
}

// ---------------------------------------------------------------------------
// Date helpers (DD.MM.YYYY and HH:MM in UTC, ZEITZONE = "UTC")
// ---------------------------------------------------------------------------

/**
 * Parse a German date "DD.MM.YYYY" and time "HH:MM" in UTC into a JS Date.
 * ZEITZONE fields in this feed are always "UTC".
 */
export function parseGermanDateTime(date: string, time: string): Date {
  const [day, month, year] = date.split(".");
  const [hour, minute] = time.split(":");
  return new Date(
    Date.UTC(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      parseInt(hour, 10),
      parseInt(minute, 10),
      0,
    ),
  );
}

// ---------------------------------------------------------------------------
// Per-TSO hour-bucket accumulation
// ---------------------------------------------------------------------------

export interface TsoAccumulator {
  /** Sum of MITTLERE_LEISTUNG_MW × clock-hours, accumulated per UTC hour-of-day bucket (24 slots) */
  profileMwSum: number[];
  /** Count of contributions per UTC hour-of-day bucket (for averaging) */
  profileCount: number[];
  /** Sum of GESAMTE_ARBEIT_MWH for all measures */
  totalMwh: number;
}

/**
 * Distribute each measure's MITTLERE_LEISTUNG_MW across each UTC clock hour it spans,
 * accumulating into the 24-slot hour-of-day profile for per-TSO averaging.
 * Also accumulates GESAMTE_ARBEIT_MWH for the energy total.
 *
 * A measure spanning e.g. 08:00–11:00 UTC contributes to hours 8, 9, 10.
 */
export function accumulateMeasure(
  acc: TsoAccumulator,
  row: CsvRow,
): void {
  const avgMw = parseGermanDecimal(row.MITTLERE_LEISTUNG_MW);
  const mwh = parseGermanDecimal(row.GESAMTE_ARBEIT_MWH);

  const start = parseGermanDateTime(row.BEGINN_DATUM, row.BEGINN_UHRZEIT);
  const end = parseGermanDateTime(row.ENDE_DATUM, row.ENDE_UHRZEIT);

  // Walk through each UTC clock hour the measure spans
  let cursor = new Date(start);
  // Align to start of hour
  cursor.setUTCMinutes(0, 0, 0);

  while (cursor < end) {
    const hourSlot = cursor.getUTCHours();
    acc.profileMwSum[hourSlot] += avgMw;
    acc.profileCount[hourSlot] += 1;
    cursor = new Date(cursor.getTime() + 3_600_000);
  }

  acc.totalMwh += mwh;
}

// ---------------------------------------------------------------------------
// Fetch the latest complete calendar month
// ---------------------------------------------------------------------------

/**
 * Walk backwards from the month before today. For each candidate month,
 * fetch and parse the CSV. If it has at least one renewable-curtailment row,
 * return it. Tries up to `maxMonths` months back (default 5).
 *
 * Returns { csv, year, month } where month is 1-indexed.
 */
export async function fetchLatestCompleteMonth(
  token: string,
  maxMonths = 5,
): Promise<{ rows: CsvRow[]; year: number; month: number }> {
  const now = new Date();
  // Start from end of last complete calendar month
  for (let mBack = 1; mBack <= maxMonths; mBack++) {
    const target = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - mBack, 1),
    );
    const year = target.getUTCFullYear();
    const month = target.getUTCMonth() + 1; // 1-indexed
    // Last day of month
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

    const fromUtc = `${year}-${String(month).padStart(2, "0")}-01T00:00:00`;
    const toUtc = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}T23:59:59`;

    console.warn(
      `[germany-curtailment] trying ${year}-${String(month).padStart(2, "0")} (${fromUtc} → ${toUtc})`,
    );

    try {
      const csv = await fetchRedispatchCsv(token, fromUtc, toUtc);
      const rows = parseRedispatchCsv(csv);
      const renewable = filterRenewableCurtailment(rows);

      if (renewable.length === 0) {
        console.warn(
          `[germany-curtailment] ${year}-${String(month).padStart(2, "0")}: only header row or no renewable-curtailment rows — stepping back`,
        );
        continue;
      }

      console.warn(
        `[germany-curtailment] ${year}-${String(month).padStart(2, "0")}: found ${renewable.length} renewable-curtailment rows`,
      );
      return { rows, year, month };
    } catch (err) {
      console.warn(
        `[germany-curtailment] ${year}-${String(month).padStart(2, "0")} fetch error: ${(err as Error).message}`,
      );
      // Continue to next month back
    }
  }

  throw new Error(
    `[germany-curtailment] no complete month with renewable-curtailment data found in last ${maxMonths} months`,
  );
}

// ---------------------------------------------------------------------------
// Wind/solar split from ENTSO-E snapshot
// ---------------------------------------------------------------------------

interface TsoFuelRatios {
  windFraction: number;
  solarFraction: number;
}

/**
 * Read the entsoe.json last-good snapshot and compute per-TSO wind fraction
 * (fw = wind_twh / (wind_twh + solar_twh)).
 *
 * Falls back to fw=0.5 for any TSO where both are zero or data is missing.
 */
export function readTsoFuelRatios(
  snapshotPath: string,
): Record<string, TsoFuelRatios> {
  let snapshot: Record<string, { totalTWh?: number }> = {};
  try {
    snapshot = JSON.parse(
      readFileSync(snapshotPath, "utf-8"),
    ) as Record<string, { totalTWh?: number }>;
  } catch (err) {
    console.warn(
      `[germany-curtailment] cannot read entsoe.json snapshot: ${(err as Error).message}. Defaulting to 50/50 split.`,
    );
    return Object.fromEntries(
      Object.values(TSO_MAP).map((stem) => [stem, { windFraction: 0.5, solarFraction: 0.5 }]),
    );
  }

  const ratios: Record<string, TsoFuelRatios> = {};
  for (const stem of Object.values(TSO_MAP)) {
    const windTwh = snapshot[`germany-${stem}-wind`]?.totalTWh ?? 0;
    const solarTwh = snapshot[`germany-${stem}-solar`]?.totalTWh ?? 0;
    const total = windTwh + solarTwh;
    if (total <= 0) {
      console.warn(
        `[germany-curtailment] TSO ${stem}: zero wind+solar in entsoe snapshot, defaulting to 50/50 split`,
      );
      ratios[stem] = { windFraction: 0.5, solarFraction: 0.5 };
    } else {
      ratios[stem] = {
        windFraction: windTwh / total,
        solarFraction: solarTwh / total,
      };
    }
  }
  return ratios;
}

// ---------------------------------------------------------------------------
// Build RegionData for a single TSO × fuel
// ---------------------------------------------------------------------------

export function buildRegionData(
  tsoStem: string,
  fuel: "wind" | "solar",
  acc: TsoAccumulator,
  fraction: number,
  monthLabel: string,
): RegionData {
  const regionId = `germany-${tsoStem}-${fuel}`;
  const now = new Date().toISOString();

  // Profile: average MW per hour-of-day → GW, scaled by fuel fraction
  const profile = acc.profileMwSum.map((sum, i) => {
    const count = acc.profileCount[i];
    if (count === 0) return 0;
    return (sum / count / 1000) * fraction; // MW → GW × fraction
  });

  const peakGW = Math.max(0, ...profile);
  const totalTWh = (acc.totalMwh / 1_000_000) * fraction; // MWh → TWh × fraction

  const sourceNote =
    `netztransparenz redispatch — MEASURED renewable curtailment (GESAMTE_ARBEIT_MWH where ` +
    `RICHTUNG=reduzieren, PRIMAERENERGIEART=Erneuerbar), per instructing TSO (${tsomLabel(tsoStem)}), ` +
    `window ${monthLabel}. Wind/solar split apportioned by the ENTSO-E per-fuel rate ratio ` +
    `(the feed reports renewable curtailment without a fuel breakdown); magnitude is measured, ` +
    `split is estimated. Seasonal — single-month window.`;

  return {
    regionId,
    profile,
    latestProfile: null,
    totalTWh,
    peakGW,
    lastUpdated: now,
    lastSuccessAt: now,
    sourceNote,
    sourceProvenance: "verified",
  };
}

/** Human-readable TSO label for source notes */
function tsomLabel(stem: string): string {
  const labels: Record<string, string> = {
    "50hertz":   "50Hertz",
    "amprion":   "Amprion",
    "tennet-de": "TenneT DE",
    "transnetbw":"TransnetBW",
  };
  return labels[stem] ?? stem;
}

// ---------------------------------------------------------------------------
// Main loader function
// ---------------------------------------------------------------------------

export async function run(): Promise<Record<string, RegionData>> {
  const token = await fetchToken();

  const { rows, year, month } = await fetchLatestCompleteMonth(token);
  const monthLabel = `${year}-${String(month).padStart(2, "0")}`;

  const renewable = filterRenewableCurtailment(rows);
  console.warn(
    `[germany-curtailment] using ${monthLabel}: ${renewable.length} renewable-curtailment rows`,
  );

  // Accumulate per TSO
  const accByTso: Record<string, TsoAccumulator> = {};
  for (const stem of Object.values(TSO_MAP)) {
    accByTso[stem] = {
      profileMwSum: new Array(24).fill(0),
      profileCount: new Array(24).fill(0),
      totalMwh: 0,
    };
  }

  for (const row of renewable) {
    const stem = TSO_MAP[row.ANWEISENDER_UENB];
    if (!stem) continue;
    accumulateMeasure(accByTso[stem], row);
  }

  // Log per-TSO measured totals
  for (const stem of Object.values(TSO_MAP)) {
    console.warn(
      `[germany-curtailment] ${stem}: ${Math.round(accByTso[stem].totalMwh)} MWh renewable curtailment in ${monthLabel}`,
    );
  }

  // Read wind/solar split ratios from entsoe snapshot
  const snapshotPath = join(
    process.cwd(),
    "data",
    "snapshots",
    "last-good",
    "entsoe.json",
  );
  const fuelRatios = readTsoFuelRatios(snapshotPath);

  // Log wind fractions
  for (const stem of Object.values(TSO_MAP)) {
    console.warn(
      `[germany-curtailment] ${stem}: wind fraction = ${fuelRatios[stem].windFraction.toFixed(3)}`,
    );
  }

  // Build output RegionData for all 8 sub-regions
  const out: Record<string, RegionData> = {};
  for (const stem of Object.values(TSO_MAP)) {
    const acc = accByTso[stem];
    out[`germany-${stem}-wind`] = buildRegionData(
      stem,
      "wind",
      acc,
      fuelRatios[stem].windFraction,
      monthLabel,
    );
    out[`germany-${stem}-solar`] = buildRegionData(
      stem,
      "solar",
      acc,
      fuelRatios[stem].solarFraction,
      monthLabel,
    );
  }

  return out;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<Record<string, RegionData>>("germany-curtailment", run, {
    regionTier: "live-domestic-anchored" as const,
    tagLive: (r) => {
      const tagged: Record<string, RegionData> = {};
      for (const [k, v] of Object.entries(r)) {
        tagged[k] = {
          ...v,
          sourceStatus:
            v.sourceStatus === "cached" || v.sourceStatus === "degraded"
              ? v.sourceStatus
              : "live",
        };
      }
      return tagged;
    },
    tagCached: (c) => {
      const tagged: Record<string, RegionData> = {};
      for (const [k, v] of Object.entries(c)) {
        tagged[k] = { ...v, sourceStatus: "cached" };
      }
      return tagged;
    },
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("germany-curtailment loader failed", err);
      process.exit(1);
    });
}
