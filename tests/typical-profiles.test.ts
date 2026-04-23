import { describe, expect, it } from "vitest";
import { solarProfile, buildTypicalSolarRegion } from "../src/lib/typical-profiles";

describe("typical profiles", () => {
  it("scales solar profile area to the requested annual TWh", () => {
    const profile = solarProfile(16.5, 5.9);
    const annualTWh = (profile.reduce((sum, gw) => sum + gw, 0) * 365) / 1000;
    expect(annualTWh).toBeCloseTo(5.9, 6);
  });

  it("peaks around the configured UTC solar noon", () => {
    const profile = solarProfile(16.5, 5.9);
    const peakHour = profile.indexOf(Math.max(...profile));
    expect(peakHour).toBe(16);
  });

  it("builds a RegionData payload for the Atacama fallback", () => {
    const region = buildTypicalSolarRegion("atacama", 16.5, 5.9, "test source");
    expect(region.regionId).toBe("atacama");
    expect(region.profile).toHaveLength(24);
    expect(region.totalTWh).toBeCloseTo((5.9 * 30) / 365, 6);
    expect(region.peakGW).toBeGreaterThan(0);
  });
});
