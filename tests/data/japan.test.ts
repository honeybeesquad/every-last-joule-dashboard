import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildJapanRegionData, parseKyushuCsv } from "../../src/data/japan.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Fixture is the upstream Shift-JIS bytes verbatim; the parser receives a
// Shift-JIS-decoded UTF-8 string (mirroring what the live loader does after
// decoding via TextDecoder('shift-jis')). We decode in the test too.
const fixtureBytes = readFileSync(join(__dirname, "../fixtures/japan-kyushu-sample.csv"));
const fixture = new TextDecoder("shift-jis").decode(fixtureBytes);

describe("kyushu parser (japan loader)", () => {
  it("locates the 5-min solar section by the 4-column DATE,TIME header", () => {
    const { points, sampleCount } = parseKyushuCsv(fixture);
    expect(points.length).toBeGreaterThan(0);
    expect(sampleCount).toBe(points.length);
  });

  it("emits one point per 5-minute interval (≤ 288 per UTC day) with intervalHours=5/60", () => {
    const { points } = parseKyushuCsv(fixture);
    expect(points.length).toBeLessThanOrEqual(288);
    for (const p of points) {
      expect(p.intervalHours).toBeCloseTo(5 / 60, 6);
    }
  });

  it("converts JST timestamps to UTC (peak solar 04:00–06:00 UTC = 13:00–15:00 JST)", () => {
    const { points } = parseKyushuCsv(fixture);
    // The midday peak in JST falls in the 04:00–06:00 UTC window. At least
    // one point in that window should carry > 0 MW after the 10% RATE.
    const peakWindow = points.filter((p) => {
      const hour = new Date(p.utcTimestamp).getUTCHours();
      return hour >= 4 && hour <= 6;
    });
    expect(peakWindow.length).toBeGreaterThan(0);
    expect(peakWindow.some((p) => p.mw > 0)).toBe(true);
  });

  it("applies the 10% calibration rate to the 万kW solar column", () => {
    const { points, solarMwSum } = parseKyushuCsv(fixture);
    expect(solarMwSum).toBeGreaterThan(0);
    const curtailmentMwSum = points.reduce((s, p) => s + p.mw, 0);
    // Each point's mw = solar_MW × 0.10 ⇒ sum of points.mw = solarMwSum × 0.10.
    expect(curtailmentMwSum).toBeCloseTo(solarMwSum * 0.1, 4);
  });

  it("produces a non-negative shape with realistic Kyushu midday peak (a few hundred MW after 10%)", () => {
    const { points } = parseKyushuCsv(fixture);
    for (const p of points) {
      expect(p.mw).toBeGreaterThanOrEqual(0);
    }
    const peakMw = Math.max(...points.map((p) => p.mw));
    // 2026-04-20 hit ~664 万kW = 6.64 GW solar at noon JST → ~664 MW after 10%.
    // Anything in [50, 5000] MW is a defensible single-day midday peak proxy.
    expect(peakMw).toBeGreaterThan(50);
    expect(peakMw).toBeLessThan(5000);
  });

  it("buildJapanRegionData returns a valid 24-element profile shape with regionId=japan", () => {
    const { points } = parseKyushuCsv(fixture);
    const region = buildJapanRegionData(points, new Date("2026-04-26T00:00:00Z").toISOString());
    expect(region.regionId).toBe("japan");
    expect(region.profile).toHaveLength(24);
    for (const v of region.profile) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
    expect(region.peakGW).toBeGreaterThan(0);
    expect(region.totalTWh).toBeGreaterThanOrEqual(0);
    expect(typeof region.sourceNote).toBe("string");
    expect(region.sourceNote).toMatch(/Kyushu/);
  });
});
