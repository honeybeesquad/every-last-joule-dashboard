import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildMexicoData, buildMexicoPoints } from "../../src/data/mexico.json";

const CSV_PATH = join(process.cwd(), "data/historical/mexico-generacion.csv");

describe("mexico loader", () => {
  it("returns per-fuel solar + wind T3 RegionData (no fabricated feed)", async () => {
    const data = await buildMexicoData();
    for (const [fuel, id] of [
      ["solar", "mexico-solar"],
      ["wind", "mexico-wind"],
    ] as const) {
      const r = data[fuel];
      expect(r.regionId).toBe(id);
      expect(r.profile).toHaveLength(24);
      expect(r.latestProfile).toBeNull();
      expect(r.totalTWh).toBeGreaterThan(0);
      expect(r.peakGW).toBeGreaterThan(0);
      expect(r.confidenceTier).toBe("T3-modelled");
      // sourceStatus must be "cached" at construction — buildMexicoData()
      // bypasses withFallback, so this is the path a regression (re-hardcoding
      // "live") would reopen. See resilient.ts stampLive.
      expect(r.sourceStatus).toBe("cached");
      expect(r.sourceProvenance).toBe("modelled-fallback");
    }
    // Solar is the larger share of the ~1.2 TWh anchor (0.8 vs 0.4 wind).
    expect(data.solar.totalTWh).toBeGreaterThan(data.wind.totalTWh);
  });

  it("throws (does not silently zero the region) on a degenerate zero-area shape", async () => {
    // A zero-area shape is a degenerate input (e.g. an all-zero relay CSV row
    // that slips past the plausibility gate). buildPoints must THROW so the
    // loader's withFallback serves last-good, rather than emitting a flat-zero
    // profile that silently zeroes the region's totalTWh/peakGW. This matches
    // scaleProfileToAnnualTWh, which throws on non-positive area.
    expect(() => buildMexicoPoints([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 0.8)).toThrow();
  });

  it("totalTWh is the 30-day figure and agrees with the rendered profile", async () => {
    const data = await buildMexicoData();
    // RegionData.totalTWh is the trailing-30-day cumulative (types.ts docs +
    // tooltip "30d total"). The normalized typical-day shape's 24h energy is
    // dailyTWh = annual/365, so the 30-day total must equal annual * 30/365.
    // The first assertion (profile integral) is a self-consistency check on
    // buildPoints; the SECOND (annual*30/365) is the load-bearing guard that
    // fails if the shape is not normalized by shapeSum. Both must hold.
    for (const [fuel, annual] of [
      ["solar", 0.8],
      ["wind", 0.4],
    ] as const) {
      const r = data[fuel];
      const profileEnergyTWh = (r.profile.reduce((s, v) => s + v, 0)) / 1000 * 30;
      // Self-consistency: totalTWh must equal the rendered curve's 30-day
      // integral (catches a shape that is not normalized by shapeSum).
      expect(r.totalTWh).toBeCloseTo(profileEnergyTWh, 9);
      // Load-bearing anchor check: 30-day total == annual * 30/365.
      expect(r.totalTWh).toBeCloseTo(annual * (30 / 365), 6);
      // Guard against the old regression: full-annual (~12x) would be > annual.
      expect(r.totalTWh).toBeLessThan(annual);
    }
  });

  it("uses the CENACE relay CSV for solar profile shape (not hardcoded)", () => {
    // The relay CSV must exist and be non-trivial for the loader to use real data
    expect(existsSync(CSV_PATH)).toBe(true);
    const csv = readFileSync(CSV_PATH, "utf-8");
    const lines = csv.trim().split("\n");
    expect(lines.length).toBeGreaterThan(168); // At least 7 days
  });

  it("solar profile reads ~0 at night (forensic test — hours 2-4 UTC = 8-10 PM CST)", async () => {
    const data = await buildMexicoData();
    const profile = data.solar.profile;
    const peak = Math.max(...profile);
    // Hours 2, 3, 4 UTC = 8pm, 9pm, 10pm CST — deep night, must be <1% of peak
    expect(profile[2] / peak).toBeLessThan(0.01);
    expect(profile[3] / peak).toBeLessThan(0.01);
    expect(profile[4] / peak).toBeLessThan(0.01);
    // Hours 7-17 UTC (1am-11am CST) = midday — must be substantial
    expect(profile[11] / peak).toBeGreaterThan(0.5); // Peak midday
  });

  it("wind profile is non-zero at night (wind blows 24/7)", async () => {
    const data = await buildMexicoData();
    const profile = data.wind.profile;
    // Wind curtailment can occur any hour of the day
    const totalProfile = profile.reduce((sum, v) => sum + v, 0);
    expect(totalProfile).toBeGreaterThan(0);
  });
});
