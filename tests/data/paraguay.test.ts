import { describe, expect, it } from "vitest";
import { buildParaguayData } from "../../src/data/paraguay.json";

describe("paraguay loader", () => {
  it("returns a valid positive RegionData shape", async () => {
    const data = await buildParaguayData();
    expect(data.regionId).toBe("paraguay");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
  });
});
