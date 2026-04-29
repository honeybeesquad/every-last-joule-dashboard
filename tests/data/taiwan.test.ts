import { describe, expect, it } from "vitest";
import { buildTaiwanData } from "../../src/data/taiwan.json";

describe("taiwan loader", () => {
  it("returns a valid positive RegionData shape", async () => {
    const data = await buildTaiwanData();
    expect(data.regionId).toBe("taiwan");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.confidenceTier).toBe("T3-modelled");
    expect(data.totalTWh).toBeCloseTo((0.6 * 30) / 365, 8);
    expect(data.peakGW).toBeGreaterThan(0);
    expect(data.peakGW).toBeLessThan(0.2);
    expect(data.fuelShare?.wind).toBeGreaterThan(0);
    expect(data.fuelShare?.solar).toBeGreaterThan(0);
  });
});
