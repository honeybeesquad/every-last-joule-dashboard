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

/**
 * The repo's stand-in for a time nothing is known about: the epoch. It parses,
 * so anything that ages a record by it reads the record as ancient.
 */
export const UNKNOWN_TIME = "1970-01-01T00:00:00.000Z";

/** Convert source anchor labels such as "2024" or "2025-Q1" to ISO timestamps. */
export function coerceLastSuccessAt(value: string, fallback = UNKNOWN_TIME): string {
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

/**
 * Hours after which the deployment's data counts as stale: a day of missed
 * scheduled rebuilds plus two hours' slack for GitHub, which runs the
 * 3-hourly refresh cron late and drops some runs (3 to 5 of 8 ran per day,
 * 24–27 Sep 2026). One number for the dashboard's stale notice and
 * scripts/lib/deploy-freshness.ts; scripts/append_history.py copies it by hand.
 */
export const DEPLOY_STALE_AFTER_HOURS = 26;

export interface DeployFreshness {
  /** Hours since the build, or null when the build time is missing or unparseable. */
  ageHours: number | null;
  /** Older than the threshold, or of unknown age: unknown freshness is never fresh. */
  stale: boolean;
}

/** How old a deployment's data is, from its build stamp. */
export function deployFreshness(
  builtAt: string | null | undefined,
  now: Date,
  thresholdHours: number = DEPLOY_STALE_AFTER_HOURS,
): DeployFreshness {
  const time = builtAt ? new Date(builtAt).getTime() : Number.NaN;
  if (!Number.isFinite(time)) return { ageHours: null, stale: true };
  const ageHours = Math.max(0, (now.getTime() - time) / 3_600_000);
  return { ageHours, stale: ageHours > thresholdHours };
}

/** "12 min ago", "5 h ago", "3 days ago". Each unit rounds down: 5.9 h reads "5 h ago". */
export function formatAge(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.floor(hours * 60))} min ago`;
  if (hours < 48) return `${Math.floor(hours)} h ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "24 Sep 2026, 04:42 UTC", independent of the viewer's locale and zone. Null if unparseable. */
export function formatUtcStamp(iso: string): string | null {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}, ${hh}:${mm} UTC`;
}
