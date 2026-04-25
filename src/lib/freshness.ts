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
