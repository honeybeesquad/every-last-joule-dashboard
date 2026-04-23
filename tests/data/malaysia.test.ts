import { describe, expect, it } from "vitest";
import { buildMalaysiaData } from "../../src/data/malaysia.json";

describe("malaysia loader", () => {
  it("returns a valid positive RegionData shape", async () => {
    const data = await buildMalaysiaData();
    expect(data.regionId).toBe("malaysia");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
  });
});
