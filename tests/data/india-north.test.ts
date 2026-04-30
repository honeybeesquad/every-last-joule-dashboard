import { describe, expect, it } from "vitest";
import { buildIndiaNorthData } from "../../src/data/india-north.json";

describe("india-north loader", () => {
  it("returns a valid positive RegionData shape", async () => {
    const data = await buildIndiaNorthData();
    expect(data.regionId).toBe("india-north");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
  });
});
