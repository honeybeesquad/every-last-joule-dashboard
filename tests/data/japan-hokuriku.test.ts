import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildHokurikuRegionData, parseHokurikuCsv } from "../../src/data/japan-hokuriku.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureBytes = readFileSync(join(__dirname, "../fixtures/japan-hokuriku-sample.csv"));
const fixture = new TextDecoder("shift-jis").decode(fixtureBytes);

describe("hokuriku parser (japan-hokuriku loader)", () => {
  it("locates the 5-min solar section by the 4-column DATE,TIME header", () => {
    const { points, sampleCount } = parseHokurikuCsv(fixture);
    expect(points.length).toBeGreaterThan(0);
    expect(sampleCount).toBe(points.length);
  });

  it("emits one point per 5-minute interval (≤ 288 per UTC day) with intervalHours=5/60", () => {
    const { points } = parseHokurikuCsv(fixture);
    expect(points.length).toBeLessThanOrEqual(288);
    for (const p of points) {
      expect(p.intervalHours).toBeCloseTo(5 / 60, 6);
    }
  });

  it("converts JST timestamps to UTC correctly (9-hour offset)", () => {
    const { points } = parseHokurikuCsv(fixture);
    if (points.length === 0) return;
    // First point timestamp should be 9 hours before the JST midnight entry
    const firstUtcHour = new Date(points[0].utcTimestamp).getUTCHours();
    // JST 0:00 = UTC 15:00 of previous day
    expect(firstUtcHour).toBe(15);
  });

  it("applies the 1% calibration rate to the 万kW solar column", () => {
    const { points, solarMwSum } = parseHokurikuCsv(fixture);
    expect(solarMwSum).toBeGreaterThanOrEqual(0);
    const curtailmentMwSum = points.reduce((s, p) => s + p.mw, 0);
    expect(curtailmentMwSum).toBeCloseTo(solarMwSum * 0.01, 4);
  });

  it("produces non-negative curtailment MW values", () => {
    const { points } = parseHokurikuCsv(fixture);
    for (const p of points) {
      expect(p.mw).toBeGreaterThanOrEqual(0);
    }
  });

  it("buildHokurikuRegionData returns a valid 24-element profile with regionId=japan-hokuriku", () => {
    const { points } = parseHokurikuCsv(fixture);
    const region = buildHokurikuRegionData(points, new Date("2026-05-02T00:00:00Z").toISOString());
    expect(region.regionId).toBe("japan-hokuriku");
    expect(region.profile).toHaveLength(24);
    for (const v of region.profile) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
    expect(region.peakGW).toBeGreaterThanOrEqual(0);
    expect(region.totalTWh).toBeGreaterThanOrEqual(0);
    expect(typeof region.sourceNote).toBe("string");
    expect(region.sourceNote).toMatch(/Hokuriku/);
  });
});
