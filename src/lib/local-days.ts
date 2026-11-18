/**
 * Calendar days in a fixed-offset local time zone.
 *
 * For operators that publish one file or query per local day and run on a
 * flat UTC offset with no daylight saving (AMM Guatemala UTC−6, UT El Salvador
 * UTC−6, CNDC Bolivia UTC−4). Not for zones with daylight saving.
 */

const DAY_MS = 86_400_000;

/**
 * The `days` complete local calendar days that end yesterday, oldest first,
 * as YYYY-MM-DD. "Today" is the local date at `now` in a zone `utcOffsetHours`
 * from UTC (negative west of Greenwich), so today, still in progress, is never
 * included.
 */
export function completeLocalDays(now: Date, utcOffsetHours: number, days: number): string[] {
  if (!Number.isInteger(days) || days < 1) throw new Error(`completeLocalDays: days must be a positive integer, got ${days}`);
  const local = new Date(now.getTime() + utcOffsetHours * 3_600_000);
  const today = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return Array.from({ length: days }, (_, i) => new Date(today - (days - i) * DAY_MS).toISOString().slice(0, 10));
}
