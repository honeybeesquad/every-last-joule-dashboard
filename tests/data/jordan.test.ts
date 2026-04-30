import { describe, expect, it } from "vitest";
import { buildJordanData } from "../../src/data/jordan.json";

describe("jordan loader", () => {
  it("returns a valid positive RegionData shape", async () => {
    const data = await buildJordanData();
    expect(data.regionId).toBe("jordan");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
    expect(data.fuelShare?.wind).toBeGreaterThan(0);
    expect(data.fuelShare?.solar).toBeGreaterThan(0);
  });
});
