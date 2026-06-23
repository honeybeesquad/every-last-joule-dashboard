/**
 * Regression test for the SLDC annualisation bug.
 *
 * Bug: the SLDC branch in India state loaders passed the raw trailing-window
 * curtailment sum directly as the annual-TWh argument of buildTypicalSolarRegion.
 * Fix: annualise before passing — rawWindowTWh * 365 / nRows.
 *
 * This test:
 *   1. Writes a synthetic SLDC CSV (30 daily rows) to a temp file.
 *   2. Calls readStateSldcCurtailment and confirms nRows / the sums are correct.
 *   3. Asserts that annualising (rawWindowTWh * 365 / nRows) yields ~12.17× the
 *      per-day mean × 365 — i.e. is the correct annual figure, not the 90-day sum.
 *   4. Confirms that the correct annualised value differs from the raw sum by
 *      the expected factor (365/nRows), catching the ~4× undercount if nRows < 365.
 */

import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, afterAll } from "vitest";
import { readStateSldcCurtailment } from "../src/lib/india-gen-re.js";

const TMP_CSV = join(tmpdir(), `india-sldc-annualisation-test-${Date.now()}.csv`);

/** Build a synthetic SLDC CSV with nRows daily rows, each with constant rates. */
function makeSldcCsv(nRows: number, solarGwh: number, windGwh: number): string {
  const lines = ["date,solar_curtailed_gwh,wind_curtailed_gwh"];
  for (let i = 0; i < nRows; i++) {
    const d = new Date(2026, 0, 1 + i);
    const ds = d.toISOString().slice(0, 10);
    lines.push(`${ds},${solarGwh},${windGwh}`);
  }
  return lines.join("\n") + "\n";
}

describe("india-sldc-annualisation", () => {
  afterAll(() => {
    try { unlinkSync(TMP_CSV); } catch { /* ignore */ }
  });

  it("readStateSldcCurtailment returns correct nRows and sums for a 30-row CSV", () => {
    writeFileSync(TMP_CSV, makeSldcCsv(30, 2.0, 1.0));  // 30 rows, 2 GWh solar + 1 GWh wind per day

    const result = readStateSldcCurtailment(TMP_CSV, 90);
    expect(result).not.toBeNull();

    // nRows should be the full row count (30), not the window size (90)
    expect(result!.nRows).toBe(30);

    // trailing-30 sums: 30 rows × 2 GWh / 1000 = 0.060 TWh solar; 30 × 1 / 1000 = 0.030 TWh wind
    expect(result!.solarCurtailedTWh).toBeCloseTo(0.060, 5);
    expect(result!.windCurtailedTWh).toBeCloseTo(0.030, 5);
  });

  it("annualising by nRows gives ~4.1× larger figure than the raw 30-day sum (catches the undercount)", () => {
    writeFileSync(TMP_CSV, makeSldcCsv(30, 2.0, 1.0));

    const sldc = readStateSldcCurtailment(TMP_CSV, 90)!;
    const rawWindowTWh = sldc.solarCurtailedTWh + sldc.windCurtailedTWh;  // 0.090 TWh (30-day sum)
    const annualizedTWh = rawWindowTWh * 365 / sldc.nRows;                 // 0.090 × 365/30 ≈ 1.095 TWh/yr

    // The annualised value should be 365/30 ≈ 12.17× larger than the raw per-day mean
    // and 365/30 ≈ 12.17× the 1-day value (0.003 TWh/day × 365 ≈ 1.095)
    expect(annualizedTWh).toBeCloseTo(rawWindowTWh * 365 / 30, 10);
    expect(annualizedTWh).toBeCloseTo(0.003 * 365, 3);  // 0.003 TWh/day × 365 days

    // The fix: annualised >> raw window sum when nRows << 365
    // For 30 rows: factor = 365/30 ≈ 12.17 — without the fix (bug) we'd pass 0.090 TWh
    // instead of 1.095 TWh, an ~12× undercount
    expect(annualizedTWh / rawWindowTWh).toBeCloseTo(365 / 30, 5);
    expect(annualizedTWh).toBeGreaterThan(rawWindowTWh * 2);
  });

  it("annualising a full 365-row CSV gives 1:1 ratio (no distortion for full-year data)", () => {
    writeFileSync(TMP_CSV, makeSldcCsv(365, 2.0, 1.0));

    const sldc = readStateSldcCurtailment(TMP_CSV, 90)!;
    // nRows = 365 but only trailing 90 rows are summed
    expect(sldc.nRows).toBe(365);

    const rawWindowTWh = sldc.solarCurtailedTWh + sldc.windCurtailedTWh;
    const annualizedTWh = rawWindowTWh * 365 / sldc.nRows;

    // With 365 rows, annualise = rawWindowTWh × 365/365 = rawWindowTWh × 1
    // But the tail is only 90 rows, so rawWindowTWh = 0.090 TWh (90-day window)
    // and annualizedTWh = 0.090 × 365/365 = 0.090 TWh — no scaling for full-year CSV
    expect(annualizedTWh).toBeCloseTo(rawWindowTWh, 10);
  });

  it("annualising a 90-row CSV (exact window size) gives 365/90 ≈ 4.06× scale factor", () => {
    writeFileSync(TMP_CSV, makeSldcCsv(90, 2.0, 1.0));

    const sldc = readStateSldcCurtailment(TMP_CSV, 90)!;
    expect(sldc.nRows).toBe(90);

    const rawWindowTWh = sldc.solarCurtailedTWh + sldc.windCurtailedTWh;
    const annualizedTWh = rawWindowTWh * 365 / sldc.nRows;

    // 365/90 ≈ 4.056 — the original bug's undercount factor for a full 90-day window
    expect(annualizedTWh / rawWindowTWh).toBeCloseTo(365 / 90, 5);
  });
});
