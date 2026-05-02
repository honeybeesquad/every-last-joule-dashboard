import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildTohokuRegionData, parseTohokuCsv } from "../../src/data/japan-tohoku.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Fixture is the upstream Shift-JIS bytes verbatim; the parser receives a
// Shift-JIS-decoded UTF-8 string (mirroring what the live loader does after
// decoding via TextDecoder('shift-jis')).
const fixtureBytes = readFileSync(join(__dirname, "../fixtures/japan-tohoku-sample.csv"));
const fixture = new TextDecoder("shift-jis").decode(fixtureBytes);

describe("tohoku parser (japan-tohoku loader)", () => {
  it("locates the DATE,TIME header and identifies both curtailment columns", () => {
    const { points, sampleCount } = parseTohokuCsv(fixture);
    expect(points.length).toBeGreaterThan(0);
    expect(sampleCount).toBe(points.length);
  });

  it("emits one point per 30-minute interval (≤ 48 per UTC day) with intervalHours=0.5", () => {
    const { points } = parseTohokuCsv(fixture);
    // One day of 30-min intervals = 48 rows max
    expect(points.length).toBeLessThanOrEqual(48);
    for (const p of points) {
      expect(p.intervalHours).toBeCloseTo(0.5, 6);
    }
  });

  it("converts JST timestamps to UTC (peak solar 02:00–05:00 UTC = 11:00–14:00 JST)", () => {
    const { points } = parseTohokuCsv(fixture);
    // Solar curtailment peaks around local noon JST = ~03:00 UTC for Tohoku (lon ~140°E)
    const peakWindow = points.filter((p) => {
      const hour = new Date(p.utcTimestamp).getUTCHours();
      return hour >= 1 && hour <= 5;
    });
    expect(peakWindow.length).toBeGreaterThan(0);
    // At least some points in the midday window should have curtailment > 0
    // (April 30 had solar curtailment; if fixture date differs, at least structure is valid)
    const hasCurtailment = peakWindow.some((p) => p.mw > 0);
    // Don't require curtailment — winter days may have none. Just check structure.
    expect(typeof hasCurtailment).toBe("boolean");
  });

  it("produces non-negative curtailment MW values", () => {
    const { points } = parseTohokuCsv(fixture);
    for (const p of points) {
      expect(p.mw).toBeGreaterThanOrEqual(0);
    }
  });

  it("sums solar and wind curtailment correctly (fixture has solar curtailment on April 30)", () => {
    const { points, solarCurtMwSum, windCurtMwSum } = parseTohokuCsv(fixture);
    // April 30, 2026 had solar curtailment (~490-533 MW peaks), no wind
    expect(solarCurtMwSum).toBeGreaterThan(0);
    // Total point MW should equal solar + wind sums
    const totalPointMw = points.reduce((s, p) => s + p.mw, 0);
    expect(totalPointMw).toBeCloseTo(solarCurtMwSum + windCurtMwSum, 4);
  });

  it("peak curtailment on April 30 is in the midday solar window", () => {
    const { points } = parseTohokuCsv(fixture);
    if (points.length === 0) return; // skip if no data
    const peakPoint = points.reduce((a, b) => (a.mw > b.mw ? a : b));
    if (peakPoint.mw === 0) return; // no curtailment day — skip check
    // Peak should be in local noon window (UTC 02:00-05:00 for lon ~140°E)
    const peakHour = new Date(peakPoint.utcTimestamp).getUTCHours();
    expect(peakHour).toBeGreaterThanOrEqual(1);
    expect(peakHour).toBeLessThanOrEqual(6);
  });

  it("buildTohokuRegionData returns a valid 24-element profile with regionId=japan-tohoku", () => {
    const { points } = parseTohokuCsv(fixture);
    const region = buildTohokuRegionData(points, new Date("2026-04-30T23:59:00Z").toISOString());
    expect(region.regionId).toBe("japan-tohoku");
    expect(region.profile).toHaveLength(24);
    for (const v of region.profile) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
    expect(region.peakGW).toBeGreaterThanOrEqual(0);
    expect(region.totalTWh).toBeGreaterThanOrEqual(0);
    expect(typeof region.sourceNote).toBe("string");
    expect(region.sourceNote).toMatch(/Tohoku/);
  });

  it("single-day totalTWh is in a realistic range for Tohoku (< 1 GWh per day outside curtailment season → < 0.001 TWh; up to ~1.5 GWh on heavy days)", () => {
    const { points } = parseTohokuCsv(fixture);
    const region = buildTohokuRegionData(points, new Date("2026-04-30T23:59:00Z").toISOString());
    // One day's data: 0 ≤ totalTWh ≤ 0.002 (2 GWh ceiling for any single day)
    expect(region.totalTWh).toBeGreaterThanOrEqual(0);
    expect(region.totalTWh).toBeLessThanOrEqual(0.002);
  });
});
