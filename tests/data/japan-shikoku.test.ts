import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildShikokuRegionData, parseShikokuCsv } from "../../src/data/japan-shikoku.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Fixture is a minimal synthetic Shift-JIS CSV with the correct multi-section format.
// The live endpoint returned 404 on 2026-05-02; this validates the parser logic.
const fixtureBytes = readFileSync(join(__dirname, "../fixtures/japan-shikoku-sample.csv"));
const fixture = new TextDecoder("shift-jis").decode(fixtureBytes);

describe("shikoku parser (japan-shikoku loader)", () => {
  it("locates the 5-min solar section by the 4-column DATE,TIME header", () => {
    const { points, sampleCount } = parseShikokuCsv(fixture);
    expect(points.length).toBeGreaterThan(0);
    expect(sampleCount).toBe(points.length);
  });

  it("emits points with intervalHours=5/60", () => {
    const { points } = parseShikokuCsv(fixture);
    for (const p of points) {
      expect(p.intervalHours).toBeCloseTo(5 / 60, 6);
    }
  });

  it("converts JST timestamps to UTC (9-hour offset)", () => {
    const { points } = parseShikokuCsv(fixture);
    if (points.length === 0) return;
    const firstUtcHour = new Date(points[0].utcTimestamp).getUTCHours();
    expect(firstUtcHour).toBe(15);
  });

  it("applies the 7% calibration rate to the 万kW solar column", () => {
    const { points, solarMwSum } = parseShikokuCsv(fixture);
    expect(solarMwSum).toBeGreaterThanOrEqual(0);
    const curtailmentMwSum = points.reduce((s, p) => s + p.mw, 0);
    expect(curtailmentMwSum).toBeCloseTo(solarMwSum * 0.07, 4);
  });

  it("produces non-negative curtailment MW values", () => {
    const { points } = parseShikokuCsv(fixture);
    for (const p of points) {
      expect(p.mw).toBeGreaterThanOrEqual(0);
    }
  });

  it("buildShikokuRegionData returns a valid 24-element profile with regionId=japan-shikoku", () => {
    const { points } = parseShikokuCsv(fixture);
    const region = buildShikokuRegionData(points, new Date("2026-05-02T00:00:00Z").toISOString());
    expect(region.regionId).toBe("japan-shikoku");
    expect(region.profile).toHaveLength(24);
    for (const v of region.profile) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
    expect(region.peakGW).toBeGreaterThanOrEqual(0);
    expect(region.totalTWh).toBeGreaterThanOrEqual(0);
    expect(typeof region.sourceNote).toBe("string");
    expect(region.sourceNote).toMatch(/Shikoku/);
  });
});
