import { describe, expect, it } from "vitest";
import { buildUaeData } from "../../src/data/uae.json";

describe("uae loader", () => {
  it("returns a valid positive RegionData shape", async () => {
    const data = await buildUaeData();
    expect(data.regionId).toBe("uae");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
  });
});
