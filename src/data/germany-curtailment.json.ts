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
 * breakdown. We derive a per-TSO wind fraction from live ENTSO-E A75
 * generation for each TSO control area (30-day window, per psrType) weighted
 * by the documented BNetzA prior per-fuel curtailment rates:
 *   windFraction = Σ(windGen × windRate) / (Σ(windGen × windRate) + solarGen × solarRate)
 * and use it to apportion each TSO's measured curtailment into wind and solar
 * sub-regions. If ENTSO-E is unreachable, a static prior ratio (derived
 * 2026-08-19 from the same formula) is used; a 50/50 split is the loud last
 * resort only. The magnitude is MEASURED; the wind/solar split is an
 * ESTIMATED apportionment in every case (hence T1b tier persists — the
 * source note documents which path produced the split).
 *
 * History: the original #313 implementation read germany-{tso}-{fuel} keys
 * from data/snapshots/last-good/entsoe.json — but the same PR removed those
 * zones from entsoe.json.ts, so the keys could never exist again and every
 * build silently fell through to 50/50. Fixed by deriving the ratio directly
 * from ENTSO-E here.
 *
 * On any failure (OAuth, network, empty response, backend pool down) the
 * loader falls back via withFallback() to the last-good snapshot. All
 * diagnostics go to stderr (console.warn/error). stdout is the emitted JSON.
 */

import { withFallback } from "../lib/resilient.js";
import { parseEntsoeXml } from "../lib/entsoe.js";
import type { RegionData, CurtailmentPoint } from "../lib/types.js";
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
// Wind/solar split from live ENTSO-E A75 generation × BNetzA prior rates
// ---------------------------------------------------------------------------

export interface TsoFuelRatios {
  windFraction: number;
  solarFraction: number;
  /** Which fallback rung produced this ratio (drives the sourceNote wording) */
  ratioSource: "entsoe-live" | "static-prior" | "even-split";
}

interface TechSpec {
  psrType: string;
  /** BNetzA prior per-fuel curtailment rate (see docs/methodology/entsoe-rates.md) */
  rate: number;
}

/**
 * ENTSO-E control-area domains + BNetzA prior per-fuel curtailment rates for
 * the 4 German TSOs. Recovered from the pre-#313 entsoe.json.ts proxy zones
 * (B18 offshore wind 17.8%, B19 onshore wind 3.0%, B16 solar 2.3% — BNetzA
 * 2024 grid-congestion figures; Amprion and TransnetBW have no offshore).
 */
export const TSO_ENTSOE_SPECS: Record<
  string,
  { domain: string; wind: TechSpec[]; solar: TechSpec[] }
> = {
  "50hertz": {
    domain: "10YDE-VE-------2",
    wind: [{ psrType: "B18", rate: 0.178 }, { psrType: "B19", rate: 0.030 }],
    solar: [{ psrType: "B16", rate: 0.023 }],
  },
  "amprion": {
    domain: "10YDE-RWENET---I",
    wind: [{ psrType: "B19", rate: 0.030 }],
    solar: [{ psrType: "B16", rate: 0.023 }],
  },
  "tennet-de": {
    domain: "10YDE-EON------1",
    wind: [{ psrType: "B18", rate: 0.178 }, { psrType: "B19", rate: 0.030 }],
    solar: [{ psrType: "B16", rate: 0.023 }],
  },
  "transnetbw": {
    domain: "10YDE-ENBW-----N",
    wind: [{ psrType: "B19", rate: 0.030 }],
    solar: [{ psrType: "B16", rate: 0.023 }],
  },
};

/**
 * Static prior wind fractions, used only when live ENTSO-E is unreachable.
 * Derived 2026-08-19 from ENTSO-E A75 30-day generation per control area ×
 * the BNetzA prior rates above (same formula as the live path):
 *   50hertz 0.656, amprion 0.346, tennet-de 0.749, transnetbw 0.143.
 * Still an estimate — but anchored, unlike a 50/50 guess.
 */
export const STATIC_WIND_FRACTION: Record<string, number> = {
  "50hertz": 0.656,
  "amprion": 0.346,
  "tennet-de": 0.749,
  "transnetbw": 0.143,
};

/**
 * Wind fraction from per-fuel curtailment proxies (MWh × rate sums).
 * Returns null when the inputs cannot support a ratio (both zero, negative,
 * or non-finite) so the caller can fall back.
 */
export function windFractionFromProxies(
  windProxyMwh: number,
  solarProxyMwh: number,
): number | null {
  if (!Number.isFinite(windProxyMwh) || !Number.isFinite(solarProxyMwh)) return null;
  if (windProxyMwh < 0 || solarProxyMwh < 0) return null;
  const total = windProxyMwh + solarProxyMwh;
  if (total <= 0) return null;
  return windProxyMwh / total;
}

/** Energy sum (MWh) of an ENTSO-E point series. */
function seriesMwh(points: CurtailmentPoint[]): number {
  return points.reduce(
    (sum, p) => sum + Math.max(0, p.mw) * (p.intervalHours ?? 1),
    0,
  );
}

/** Fetches raw ENTSO-E A75 XML for one control area + psrType (30-day window). */
export type EntsoeXmlFetcher = (domain: string, psrType: string) => Promise<string>;

function defaultEntsoeXmlFetcher(): EntsoeXmlFetcher {
  const token = process.env.ENTSOE_API_TOKEN;
  if (!token) throw new Error("ENTSOE_API_TOKEN not set");
  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:T]/g, "").slice(0, 12);
  return async (domain, psrType) => {
    const params = new URLSearchParams({
      securityToken: token,
      documentType: "A75",
      processType: "A16",
      in_Domain: domain,
      psrType,
      periodStart: fmt(start),
      periodEnd: fmt(now),
    });
    const res = await fetch(`https://web-api.tp.entsoe.eu/api?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`ENTSO-E A75 ${domain} ${psrType}: HTTP ${res.status}`);
    }
    return res.text();
  };
}

/**
 * Derive one TSO's wind fraction from live ENTSO-E A75 generation weighted by
 * the BNetzA prior rates. Returns null (caller falls back) when the fetches
 * fail or the data cannot support a ratio.
 */
export async function deriveTsoWindFraction(
  spec: { domain: string; wind: TechSpec[]; solar: TechSpec[] },
  fetchXml: EntsoeXmlFetcher,
): Promise<number | null> {
  try {
    let windProxy = 0;
    for (const tech of spec.wind) {
      const xml = await fetchXml(spec.domain, tech.psrType);
      windProxy += seriesMwh(parseEntsoeXml(xml)) * tech.rate;
    }
    let solarProxy = 0;
    for (const tech of spec.solar) {
      const xml = await fetchXml(spec.domain, tech.psrType);
      solarProxy += seriesMwh(parseEntsoeXml(xml)) * tech.rate;
    }
    return windFractionFromProxies(windProxy, solarProxy);
  } catch (err) {
    console.warn(
      `[germany-curtailment] ENTSO-E A75 fetch failed for ${spec.domain}: ${(err as Error).message}`,
    );
    return null;
  }
}

/**
 * Resolve per-TSO wind/solar ratios via the fallback chain:
 *   1. live ENTSO-E A75 generation × BNetzA prior rates ("entsoe-live")
 *   2. static prior ratio derived from the same formula ("static-prior")
 *   3. 50/50 — last resort only, logged loudly ("even-split")
 */
export async function resolveFuelRatios(
  fetchXml?: EntsoeXmlFetcher,
): Promise<Record<string, TsoFuelRatios>> {
  let fetcher: EntsoeXmlFetcher | null = fetchXml ?? null;
  if (!fetcher) {
    try {
      fetcher = defaultEntsoeXmlFetcher();
    } catch (err) {
      console.warn(
        `[germany-curtailment] ${(err as Error).message} — using static prior wind/solar split`,
      );
    }
  }

  const ratios: Record<string, TsoFuelRatios> = {};
  for (const [stem, spec] of Object.entries(TSO_ENTSOE_SPECS)) {
    const live = fetcher ? await deriveTsoWindFraction(spec, fetcher) : null;
    if (live !== null) {
      ratios[stem] = {
        windFraction: live,
        solarFraction: 1 - live,
        ratioSource: "entsoe-live",
      };
      continue;
    }
    const staticFw = STATIC_WIND_FRACTION[stem];
    if (staticFw !== undefined) {
      console.warn(
        `[germany-curtailment] TSO ${stem}: live ENTSO-E ratio unavailable — using static prior wind fraction ${staticFw}`,
      );
      ratios[stem] = {
        windFraction: staticFw,
        solarFraction: 1 - staticFw,
        ratioSource: "static-prior",
      };
      continue;
    }
    console.error(
      `[germany-curtailment] TSO ${stem}: NO ratio available (live ENTSO-E failed, no static prior) — ` +
        `falling back to a 50/50 wind/solar split. The split for this TSO is a GUESS; fix the ratio source.`,
    );
    ratios[stem] = { windFraction: 0.5, solarFraction: 0.5, ratioSource: "even-split" };
  }
  return ratios;
}

// ---------------------------------------------------------------------------
// Build RegionData for a single TSO × fuel
// ---------------------------------------------------------------------------

/** Human-readable description of how the wind/solar split was derived */
export function splitNote(ratios: TsoFuelRatios): string {
  const fw = ratios.windFraction.toFixed(3);
  switch (ratios.ratioSource) {
    case "entsoe-live":
      return (
        `Wind/solar split apportioned by live ENTSO-E A75 30d generation × BNetzA prior ` +
        `per-fuel curtailment rates (wind fraction ${fw}); the feed reports renewable ` +
        `curtailment without a fuel breakdown — magnitude is measured, split is an ` +
        `estimated apportionment.`
      );
    case "static-prior":
      return (
        `Wind/solar split apportioned by a static prior ratio (wind fraction ${fw}, derived ` +
        `2026-08-19 from ENTSO-E A75 generation × BNetzA prior rates; live ENTSO-E was ` +
        `unavailable at build time) — magnitude is measured, split is an estimated apportionment.`
      );
    case "even-split":
      return (
        `Wind/solar split UNKNOWN — assumed 50/50 (no ENTSO-E ratio and no static prior ` +
        `available at build time); magnitude is measured, split is a guess.`
      );
  }
}

export function buildRegionData(
  tsoStem: string,
  fuel: "wind" | "solar",
  acc: TsoAccumulator,
  ratios: TsoFuelRatios,
  monthLabel: string,
): RegionData {
  const regionId = `germany-${tsoStem}-${fuel}`;
  const now = new Date().toISOString();
  const fraction = fuel === "wind" ? ratios.windFraction : ratios.solarFraction;

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
    `window ${monthLabel}. ${splitNote(ratios)} Seasonal — single-month window.`;

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

  // Derive wind/solar split ratios: live ENTSO-E → static prior → 50/50
  const fuelRatios = await resolveFuelRatios();

  // Log wind fractions
  for (const stem of Object.values(TSO_MAP)) {
    console.warn(
      `[germany-curtailment] ${stem}: wind fraction = ${fuelRatios[stem].windFraction.toFixed(3)} (${fuelRatios[stem].ratioSource})`,
    );
  }

  // Build output RegionData for all 8 sub-regions
  const out: Record<string, RegionData> = {};
  for (const stem of Object.values(TSO_MAP)) {
    const acc = accByTso[stem];
    out[`germany-${stem}-wind`] = buildRegionData(stem, "wind", acc, fuelRatios[stem], monthLabel);
    out[`germany-${stem}-solar`] = buildRegionData(stem, "solar", acc, fuelRatios[stem], monthLabel);
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
