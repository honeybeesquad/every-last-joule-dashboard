import { describe, expect, it } from "vitest";
import { buildKurdistanData } from "../../src/data/kurdistan.json";

describe("kurdistan loader", () => {
  it("returns a valid solar fallback RegionData shape", async () => {
    const data = await buildKurdistanData();
    expect(data.regionId).toBe("kurdistan");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.sourceNote).toMatch(/0\.05 TWh\/yr/);
  });
});
