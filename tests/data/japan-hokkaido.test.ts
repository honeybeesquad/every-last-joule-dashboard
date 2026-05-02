import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildHokkaidoRegionData, parseHokkaidoCsv } from "../../src/data/japan-hokkaido.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureBytes = readFileSync(join(__dirname, "../fixtures/japan-hokkaido-sample.csv"));
const fixture = new TextDecoder("shift-jis").decode(fixtureBytes);

describe("hokkaido parser (japan-hokkaido loader)", () => {
  it("locates the 5-min solar section by the 4-column DATE,TIME header", () => {
    const { points, sampleCount } = parseHokkaidoCsv(fixture);
    expect(points.length).toBeGreaterThan(0);
    expect(sampleCount).toBe(points.length);
  });

  it("emits one point per 5-minute interval (≤ 288 per UTC day) with intervalHours=5/60", () => {
    const { points } = parseHokkaidoCsv(fixture);
    expect(points.length).toBeLessThanOrEqual(288);
    for (const p of points) {
      expect(p.intervalHours).toBeCloseTo(5 / 60, 6);
    }
  });

  it("converts JST timestamps to UTC (peak solar 03:00–05:00 UTC = 12:00–14:00 JST for Sapporo)", () => {
    const { points } = parseHokkaidoCsv(fixture);
    const peakWindow = points.filter((p) => {
      const hour = new Date(p.utcTimestamp).getUTCHours();
      return hour >= 3 && hour <= 5;
    });
    expect(peakWindow.length).toBeGreaterThan(0);
  });

  it("applies the 5% calibration rate to the 万kW solar column", () => {
    const { points, solarMwSum } = parseHokkaidoCsv(fixture);
    expect(solarMwSum).toBeGreaterThanOrEqual(0);
    const curtailmentMwSum = points.reduce((s, p) => s + p.mw, 0);
    expect(curtailmentMwSum).toBeCloseTo(solarMwSum * 0.05, 4);
  });

  it("produces non-negative curtailment MW values", () => {
    const { points } = parseHokkaidoCsv(fixture);
    for (const p of points) {
      expect(p.mw).toBeGreaterThanOrEqual(0);
    }
  });

  it("buildHokkaidoRegionData returns a valid 24-element profile with regionId=japan-hokkaido", () => {
    const { points } = parseHokkaidoCsv(fixture);
    const region = buildHokkaidoRegionData(points, new Date("2026-05-02T00:00:00Z").toISOString());
    expect(region.regionId).toBe("japan-hokkaido");
    expect(region.profile).toHaveLength(24);
    for (const v of region.profile) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
    expect(region.peakGW).toBeGreaterThanOrEqual(0);
    expect(region.totalTWh).toBeGreaterThanOrEqual(0);
    expect(typeof region.sourceNote).toBe("string");
    expect(region.sourceNote).toMatch(/Hokkaido/);
  });
});
