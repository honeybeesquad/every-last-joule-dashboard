/**
 * REE ESIOS — env-gated. Without ESIOS_API_TOKEN this loader returns {} so
 * ENTSO-E Spain (T1a Path-B) is not overwritten.
 *
 * Token: consultasios@ree.es, header x-api-key.
 * Indicator 704 (restricciones técnicas bajar) is mixed-fuel MWh. We refuse
 * to split it onto spain-wind/spain-solar without a fuel discriminator — that
 * would double-count or invent a fuel share. Per-fuel ERNI hourly MWh is the
 * path to measured waste; until that payload exists this file is a no-op.
 *
 * Do not emit unpublished generation here: Spain generation is already ENTSO.
 */

import { pathToFileURL } from "url";
import { fetchJSON } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData } from "../lib/types.js";

export const ESIOS_INDICATORS = {
  windGeneration: 10027,
  solarPvGeneration: 10010,
  restrictionsDown: 704,
} as const;

const ESIOS_BASE = "https://api.esios.ree.es";

export function esiosToken(): string | undefined {
  const t = process.env.ESIOS_API_TOKEN?.trim();
  return t || undefined;
}

export interface EsiosValue {
  datetime: string;
  value: number;
  geo_id?: number;
  geo_name?: string;
}

export function parseEsiosIndicator(payload: unknown): EsiosValue[] {
  const values = (payload as { indicator?: { values?: unknown } })?.indicator?.values;
  if (!Array.isArray(values)) return [];
  const out: EsiosValue[] = [];
  for (const row of values) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const datetime = String(rec.datetime ?? rec.datetime_utc ?? "");
    const value = Number(rec.value);
    if (!datetime || !Number.isFinite(value)) continue;
    out.push({
      datetime,
      value,
      geo_id: typeof rec.geo_id === "number" ? rec.geo_id : undefined,
      geo_name: typeof rec.geo_name === "string" ? rec.geo_name : undefined,
    });
  }
  return out;
}

/** True when every value names wind or solar so a split would not invent shares. */
export function esiosHasPerFuel(values: EsiosValue[]): boolean {
  if (values.length < 24) return false;
  return values.every((v) => {
    const n = (v.geo_name ?? "").toLowerCase();
    return n.includes("eól") || n.includes("eol") || n.includes("solar") || n.includes("fotov");
  });
}

async function fetchIndicator(token: string, id: number): Promise<unknown> {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 3600_000);
  const url =
    `${ESIOS_BASE}/indicators/${id}` +
    `?start_date=${encodeURIComponent(start.toISOString())}` +
    `&end_date=${encodeURIComponent(end.toISOString())}`;
  return fetchJSON(url, {
    timeoutMs: 15000,
    retries: 1,
    headers: {
      Accept: "application/json; application/vnd.esios-api-v1+json",
      "Content-Type": "application/json",
      "x-api-key": token,
    },
  });
}

export async function buildSpainEsiosData(): Promise<Record<string, RegionData>> {
  const token = esiosToken();
  if (!token) return {};
  const raw = await fetchIndicator(token, ESIOS_INDICATORS.restrictionsDown);
  const values = parseEsiosIndicator(raw);
  if (!esiosHasPerFuel(values)) return {};
  // Per-fuel ERNI/restricciones payload is not in hand yet. Returning {} keeps
  // ENTSO Spain authoritative rather than guessing a split.
  return {};
}

async function run(): Promise<Record<string, RegionData>> {
  return buildSpainEsiosData();
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback<Record<string, RegionData>>("spain-esios", () => run(), {
    regionTier: "estimated" as const,
    tagLive: (r) => r,
    tagCached: (c) => c as Record<string, RegionData>,
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("spain-esios loader failed", err);
      process.exit(1);
    });
}
