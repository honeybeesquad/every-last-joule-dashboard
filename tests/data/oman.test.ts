import { describe, expect, it } from "vitest";
import { buildOmanData } from "../../src/data/oman.json";

describe("oman loader", () => {
  it("returns a valid positive RegionData shape", async () => {
    const data = await buildOmanData();
    expect(data.regionId).toBe("oman");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
  });
});
