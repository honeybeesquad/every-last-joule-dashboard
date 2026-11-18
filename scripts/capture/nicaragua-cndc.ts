#!/usr/bin/env tsx
/**
 * Nightly capture of CNDC Nicaragua's current-day hourly solar generation.
 *
 * CNDC's endpoint serves only the current Nicaragua-time day, so
 * `.github/workflows/nicaragua-capture.yml` runs this near local midnight.
 * It merges the day's SOLAR rows into data/historical/nicaragua-cndc-solar-hourly.csv
 * (a later capture of the same hour replaces an earlier one) and writes the
 * file only when something changed. Exit 1 on a fetch or parse failure, so
 * the workflow run shows red rather than committing nothing silently.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fetchJSON } from "../../src/lib/fetch.js";
import { CNDC_URL, CSV_PATH, mergeCaptures, parseCndcSolar, parseCsv, toCsv } from "../../src/data/nicaragua.json.js";

async function main(): Promise<void> {
  const path = join(process.cwd(), CSV_PATH);
  const before = existsSync(path) ? readFileSync(path, "utf-8") : "";
  const capturedAt = new Date().toISOString();
  const payload = await fetchJSON<unknown>(CNDC_URL, { timeoutMs: 30000, retries: 3 });
  const incoming = parseCndcSolar(payload, capturedAt);
  if (incoming.length === 0) throw new Error("nicaragua capture: no SOLAR rows in the response");
  const merged = mergeCaptures(before ? parseCsv(before) : [], incoming);
  const after = toCsv(merged);
  const day = incoming[0].dateLocal;
  const hours = incoming.map((r) => r.hourLocal);
  console.warn(`nicaragua capture: ${day} hours ${Math.min(...hours)}–${Math.max(...hours)} (${incoming.length} rows); file ${merged.length} rows`);
  if (after !== before) writeFileSync(path, after);
}

main().catch((err) => {
  console.error("nicaragua capture failed:", err);
  process.exit(1);
});
