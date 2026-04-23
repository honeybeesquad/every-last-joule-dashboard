import { describe, expect, it } from "vitest";
import { buildEthiopiaData } from "../../src/data/ethiopia.json";

describe("ethiopia loader", () => {
  it("returns a valid positive RegionData shape", async () => {
    const data = await buildEthiopiaData();
    expect(data.regionId).toBe("ethiopia");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
  });
});
