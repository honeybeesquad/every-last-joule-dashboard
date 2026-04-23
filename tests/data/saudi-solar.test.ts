import { describe, expect, it } from "vitest";
import { buildSaudiSolarData } from "../../src/data/saudi-solar.json";

describe("saudi-solar loader", () => {
  it("returns a valid positive RegionData shape", async () => {
    const data = await buildSaudiSolarData();
    expect(data.regionId).toBe("saudi-solar");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
  });
});
