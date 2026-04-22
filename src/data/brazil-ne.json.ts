import { fetchText } from "../lib/fetch.js";
import { timeOfDayAverageGW, totalTWh30d, peakGW } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData, CurtailmentPoint } from "../lib/types.js";
import { pathToFileURL } from "url";

const CSV_URL =
  "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/restricao_coff_eolica_tm/RESTRICAO_COFF_EOLICA_";

/** Pure parser: CSV text → CurtailmentPoints (summed across all plants per timestamp). Exported for tests. */
export function parseOnsCurtailmentCsv(csv: string): CurtailmentPoint[] {
  const normalized = csv.replace(/^\uFEFF/, "").trim();
  if (!normalized) return [];

  const lines = normalized.split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(";");
  const timestampIndex = headers.indexOf("din_instante");
  const curtailedIndex = headers.indexOf("val_geracaolimitada");

  if (timestampIndex === -1 || curtailedIndex === -1) {
    throw new Error("ONS CSV missing required columns");
  }

  const totals = new Map<string, number>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const cells = line.split(";");
    const localTimestamp = cells[timestampIndex]?.trim();
    if (!localTimestamp) continue;

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

    const current = totals.get(utcTimestamp) ?? 0;
    totals.set(utcTimestamp, current + Math.max(0, curtailedMw));
  }

  return Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({
      utcTimestamp,
      mw: Math.max(0, mw),
    }));
}

/** Fetch the last two months of CSV to give 30+ days' coverage. */
const run = async (): Promise<RegionData> => {
  const now = new Date();
  const current = `${now.getUTCFullYear()}_${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const prevDate = new Date(now.getTime());
  prevDate.setUTCMonth(prevDate.getUTCMonth() - 1);
  const prev = `${prevDate.getUTCFullYear()}_${String(prevDate.getUTCMonth() + 1).padStart(2, "0")}`;

  const urls = [`${CSV_URL}${prev}.csv`, `${CSV_URL}${current}.csv`];
  const combined: CurtailmentPoint[] = [];

  for (const url of urls) {
    try {
      const csv = await fetchText(url);
      combined.push(...parseOnsCurtailmentCsv(csv));
    } catch (err) {
      console.warn(`ons fetch skipped: ${url}: ${(err as Error).message}`);
    }
  }

  const cutoff = now.getTime() - 30 * 24 * 3600 * 1000;
  const recent = combined.filter(
    (p) => new Date(p.utcTimestamp).getTime() >= cutoff
  );

  return {
    regionId: "brazil-ne",
    profile: timeOfDayAverageGW(recent),
    totalTWh: totalTWh30d(recent),
    peakGW: peakGW(recent),
    lastUpdated: recent.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    sourceNote: "ONS Brazil direct constrained-off wind curtailment (not a proxy)",
  };
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  withFallback<RegionData>("brazil-ne", run, {
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((d) => process.stdout.write(JSON.stringify(d)))
    .catch((err) => {
      console.error("brazil-ne loader failed", err);
      process.exit(1);
    });
}
