import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildTepcoRegionData, parseTepcoCsv } from "../../src/data/japan-tepco.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Fixture is a minimal synthetic Shift-JIS CSV with the correct multi-section format.
// The live endpoint is WAF-blocked; this fixture validates the parser logic.
const fixtureBytes = readFileSync(join(__dirname, "../fixtures/japan-tepco-sample.csv"));
const fixture = new TextDecoder("shift-jis").decode(fixtureBytes);

describe("tepco parser (japan-tepco loader)", () => {
  it("locates the 5-min solar section by the 4-column DATE,TIME header", () => {
    const { points, sampleCount } = parseTepcoCsv(fixture);
    expect(points.length).toBeGreaterThan(0);
    expect(sampleCount).toBe(points.length);
  });

  it("emits points with intervalHours=5/60", () => {
    const { points } = parseTepcoCsv(fixture);
    for (const p of points) {
      expect(p.intervalHours).toBeCloseTo(5 / 60, 6);
    }
  });

  it("converts JST timestamps to UTC (9-hour offset)", () => {
    const { points } = parseTepcoCsv(fixture);
    // First row is 2026/5/2 0:00 JST = 2026/5/1 15:00 UTC
    if (points.length === 0) return;
    const firstUtcHour = new Date(points[0].utcTimestamp).getUTCHours();
    expect(firstUtcHour).toBe(15);
  });

  it("applies the 1% calibration rate to the 万kW solar column", () => {
    const { points, solarMwSum } = parseTepcoCsv(fixture);
    expect(solarMwSum).toBeGreaterThanOrEqual(0);
    const curtailmentMwSum = points.reduce((s, p) => s + p.mw, 0);
    expect(curtailmentMwSum).toBeCloseTo(solarMwSum * 0.01, 4);
  });

  it("produces non-negative curtailment MW values", () => {
    const { points } = parseTepcoCsv(fixture);
    for (const p of points) {
      expect(p.mw).toBeGreaterThanOrEqual(0);
    }
  });

  it("buildTepcoRegionData returns a valid 24-element profile with regionId=japan-tepco", () => {
    const { points } = parseTepcoCsv(fixture);
    const region = buildTepcoRegionData(points, new Date("2026-05-02T00:00:00Z").toISOString());
    expect(region.regionId).toBe("japan-tepco");
    expect(region.profile).toHaveLength(24);
    for (const v of region.profile) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
    expect(region.peakGW).toBeGreaterThanOrEqual(0);
    expect(region.totalTWh).toBeGreaterThanOrEqual(0);
    expect(typeof region.sourceNote).toBe("string");
    expect(region.sourceNote).toMatch(/TEPCO/);
  });
});
