import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOkinawaRegionData, parseOkinawaCsv } from "../../src/data/japan-okinawa.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Fixture is a synthetic Shift-JIS monthly CSV in the new 22-column format.
// Mirrors the restructured Okiden endpoint (eria_jukyu_YYYYMM_10.csv) introduced 2026-05.
const fixtureBytes = readFileSync(join(__dirname, "../fixtures/japan-okinawa-sample.csv"));
const fixture = new TextDecoder("shift-jis").decode(fixtureBytes);

describe("okinawa parser (japan-okinawa loader)", () => {
  it("locates the 22-column header by エリア需要 / 太陽光発電実績 signature", () => {
    const { points, sampleCount } = parseOkinawaCsv(fixture);
    expect(points.length).toBeGreaterThan(0);
    expect(sampleCount).toBe(points.length);
  });

  it("emits points with intervalHours=0.5 (30-minute intervals)", () => {
    const { points } = parseOkinawaCsv(fixture);
    for (const p of points) {
      expect(p.intervalHours).toBeCloseTo(0.5, 6);
    }
  });

  it("converts JST timestamps to UTC (9-hour offset; Naha lon ~127.7°E)", () => {
    const { points } = parseOkinawaCsv(fixture);
    if (points.length === 0) return;
    // JST 0:00 = UTC 15:00 prior day
    const firstUtcHour = new Date(points[0].utcTimestamp).getUTCHours();
    expect(firstUtcHour).toBe(15);
  });

  it("reads solar curtailment directly from column 14 (no rate multiplication)", () => {
    const { points, solarCurtMwSum } = parseOkinawaCsv(fixture);
    expect(solarCurtMwSum).toBeGreaterThan(0);
    // The fixture has non-zero curtailment only during daytime rows.
    // Curtailment MW values come straight from col 14 — no × rate.
    const firstDayPoint = points.find((p) => {
      const h = new Date(p.utcTimestamp).getUTCHours();
      // JST 6:00 = UTC 21:00; JST 9:00 = UTC 0:00 next day
      return h === 21 || h === 0;
    });
    expect(firstDayPoint).toBeDefined();
    expect(firstDayPoint!.mw).toBeGreaterThan(0);
  });

  it("sums solar and wind curtailment into each point's mw", () => {
    const { points, solarCurtMwSum, windCurtMwSum } = parseOkinawaCsv(fixture);
    const totalMwSum = points.reduce((s, p) => s + p.mw, 0);
    expect(totalMwSum).toBeCloseTo(solarCurtMwSum + windCurtMwSum, 4);
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
