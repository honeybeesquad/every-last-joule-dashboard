import { describe, expect, it } from "vitest";
import { buildMalaysiaData } from "../../src/data/malaysia.json";

describe("malaysia loader", () => {
  it("returns a valid positive RegionData shape", async () => {
    const data = await buildMalaysiaData();
    expect(data.regionId).toBe("malaysia");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.confidenceTier).toBe("T3-modelled");
    expect(data.totalTWh).toBeCloseTo((0.15 * 30) / 365, 8);
    expect(data.peakGW).toBeGreaterThan(0);
    expect(Math.min(...data.profile)).toBeCloseTo(0, 8);
  });
});
