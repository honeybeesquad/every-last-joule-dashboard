export function parseCsvLine(line: string, delimiter = ","): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

export function parseDelimitedRows(csv: string, delimiter = ","): Array<Record<string, string>> {
  const normalized = csv.replace(/^\uFEFF/, "").trim();
  if (!normalized) return [];

  const lines = normalized.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0], delimiter).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line, delimiter);
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = (cells[i] ?? "").trim();
    });
    return row;
  });
}

export function hourlyAverage(points: Array<{ utcTimestamp: string; mw: number }>) {
  const buckets = new Map<string, { sum: number; count: number }>();
  for (const point of points) {
    const d = new Date(point.utcTimestamp);
    if (Number.isNaN(d.getTime())) continue;
    d.setUTCMinutes(0, 0, 0);
    const hour = d.toISOString();
    const bucket = buckets.get(hour) ?? { sum: 0, count: 0 };
    bucket.sum += point.mw;
    bucket.count += 1;
    buckets.set(hour, bucket);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, b]) => ({ utcTimestamp, mw: b.count > 0 ? b.sum / b.count : 0 }));
}
