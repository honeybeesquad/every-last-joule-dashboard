#!/usr/bin/env tsx
/**
 * Nightly capture of CNDC Nicaragua's current-day hourly solar generation.
 *
 * CNDC's endpoint serves only the current Nicaragua-time day, so
 * `.github/workflows/nicaragua-capture.yml` runs this before local midnight.
 * It merges the day's SOLAR rows into data/historical/nicaragua-cndc-solar-hourly.csv
 * (a later capture of the same hour replaces an earlier one) and writes the
 * file only when something changed.
 *
 * Usage: nicaragua-cndc.ts [extra.csv ...]
 *   Each extra CSV (e.g. the copy on an automation branch whose PR has not
 *   merged yet) is merged in too, so a pending night is never dropped.
 *
 * Exit 1 on a fetch or parse failure. A response with no SOLAR rows (a run
 * that lands just after local midnight) is a warning, not a failure.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { fetchJSON } from "../../src/lib/fetch.js";
import { CNDC_URL, CSV_PATH, mergeCaptures, parseCndcSolar, parseCsv, toCsv } from "../../src/data/nicaragua.json.js";

/** Merge one CNDC response and any number of CSV texts; return the new CSV text and what was captured. */
export function captureCsv(payload: unknown, csvTexts: string[], capturedAt: string): { csv: string; day: string | null; hours: number[]; rows: number } {
  const incoming = parseCndcSolar(payload, capturedAt);
  const existing = csvTexts.filter((t) => t.trim() !== "").flatMap((t) => parseCsv(t));
  const merged = mergeCaptures(existing, incoming);
  return {
    csv: toCsv(merged),
    day: incoming[0]?.dateLocal ?? null,
    hours: incoming.map((r) => r.hourLocal),
    rows: merged.length,
  };
}

async function main(extraPaths: string[]): Promise<void> {
  const path = join(process.cwd(), CSV_PATH);
  const before = existsSync(path) ? readFileSync(path, "utf-8") : "";
  const extras = extraPaths.filter((p) => existsSync(p)).map((p) => readFileSync(p, "utf-8"));
  const payload = await fetchJSON<unknown>(CNDC_URL, { timeoutMs: 30000, retries: 3 });
  const { csv, day, hours, rows } = captureCsv(payload, [before, ...extras], new Date().toISOString());
  if (day === null) {
    console.warn("nicaragua capture: no SOLAR rows yet (just after local midnight?); merging pending copies only");
  } else {
    console.warn(`nicaragua capture: ${day} hours ${Math.min(...hours)}–${Math.max(...hours)} (${hours.length} rows); file ${rows} rows`);
  }
  if (csv !== before) writeFileSync(path, csv);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main(process.argv.slice(2)).catch((err) => {
    console.error("nicaragua capture failed:", err);
    process.exit(1);
  });
}
