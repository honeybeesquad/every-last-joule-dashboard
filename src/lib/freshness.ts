import type { SourceStatus } from "./types.js";

/**
 * Number of days after which a relay-CSV-fed region is considered stale.
 * Covers XM's ~1–3 day publish lag plus one missed Britta run. Tunable;
 * refine against observed XM cadence during the Colombia recon.
 */
export const RELAY_STALENESS_THRESHOLD_DAYS = 4;

/**
 * Classify a relay-CSV-fed region's freshness from the date of its newest
 * data row. Relay loaders read a committed CSV that a cron refreshes; a
 * successful CSV read is NOT evidence of freshness (the file may be stale).
 * Returns "degraded" when the newest row is older than thresholdDays, else
 * "live". An unparseable/missing date is treated as "degraded" — unknown
 * freshness is never reported as live.
 */
export function relayFreshness(
  latestRowDateIso: string | null | undefined,
  now: Date,
  thresholdDays: number,
): Extract<SourceStatus, "live" | "degraded"> {
  if (!latestRowDateIso) return "degraded";
  const last = new Date(latestRowDateIso).getTime();
  if (!Number.isFinite(last)) return "degraded";
  const ageMs = now.getTime() - last;
  return ageMs > thresholdDays * 24 * 60 * 60 * 1000 ? "degraded" : "live";
}

/** Convert source anchor labels such as "2024" or "2025-Q1" to ISO timestamps. */
export function coerceLastSuccessAt(value: string, fallback = "1970-01-01T00:00:00.000Z"): string {
  const year = value.match(/^(\d{4})$/);
  if (year) return `${year[1]}-01-01T00:00:00.000Z`;

  const quarter = value.match(/^(\d{4})-Q([1-4])$/);
  if (quarter) {
    const month = (Number(quarter[2]) - 1) * 3 + 1;
    return `${quarter[1]}-${String(month).padStart(2, "0")}-01T00:00:00.000Z`;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback;
}
