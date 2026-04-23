import { describe, expect, it } from "vitest";
import { buildIsraelData } from "../../src/data/israel.json";

describe("israel loader", () => {
  it("returns a valid positive RegionData shape", async () => {
    const data = await buildIsraelData();
    expect(data.regionId).toBe("israel");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
  });
});
