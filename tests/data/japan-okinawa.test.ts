import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOkinawaRegionData, parseOkinawaCsv } from "../../src/data/japan-okinawa.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Fixture is a minimal synthetic Shift-JIS CSV with the correct multi-section format.
// The live endpoint returned 404 on 2026-05-02; this validates the parser logic.
const fixtureBytes = readFileSync(join(__dirname, "../fixtures/japan-okinawa-sample.csv"));
const fixture = new TextDecoder("shift-jis").decode(fixtureBytes);

describe("okinawa parser (japan-okinawa loader)", () => {
  it("locates the 5-min solar section by the 4-column DATE,TIME header", () => {
    const { points, sampleCount } = parseOkinawaCsv(fixture);
    expect(points.length).toBeGreaterThan(0);
    expect(sampleCount).toBe(points.length);
  });

  it("emits points with intervalHours=5/60", () => {
    const { points } = parseOkinawaCsv(fixture);
    for (const p of points) {
      expect(p.intervalHours).toBeCloseTo(5 / 60, 6);
    }
  });

  it("converts JST timestamps to UTC (9-hour offset; Naha lon ~127.7°E)", () => {
    const { points } = parseOkinawaCsv(fixture);
    if (points.length === 0) return;
    // JST 0:00 = UTC 15:00 prior day
    const firstUtcHour = new Date(points[0].utcTimestamp).getUTCHours();
    expect(firstUtcHour).toBe(15);
  });

  it("applies the 2% calibration rate to the 万kW solar column", () => {
    const { points, solarMwSum } = parseOkinawaCsv(fixture);
    expect(solarMwSum).toBeGreaterThanOrEqual(0);
    const curtailmentMwSum = points.reduce((s, p) => s + p.mw, 0);
    expect(curtailmentMwSum).toBeCloseTo(solarMwSum * 0.02, 4);
  });

  it("produces non-negative curtailment MW values", () => {
    const { points } = parseOkinawaCsv(fixture);
    for (const p of points) {
      expect(p.mw).toBeGreaterThanOrEqual(0);
    }
  });

  it("buildOkinawaRegionData returns a valid 24-element profile with regionId=japan-okinawa", () => {
    const { points } = parseOkinawaCsv(fixture);
    const region = buildOkinawaRegionData(points, new Date("2026-05-02T00:00:00Z").toISOString());
    expect(region.regionId).toBe("japan-okinawa");
    expect(region.profile).toHaveLength(24);
    for (const v of region.profile) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
    expect(region.peakGW).toBeGreaterThanOrEqual(0);
    expect(region.totalTWh).toBeGreaterThanOrEqual(0);
    expect(typeof region.sourceNote).toBe("string");
    expect(region.sourceNote).toMatch(/Okinawa/);
  });
});
