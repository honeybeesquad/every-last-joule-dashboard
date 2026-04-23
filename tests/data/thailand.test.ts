import { describe, expect, it } from "vitest";
import { buildThailandData } from "../../src/data/thailand.json";

describe("thailand loader", () => {
  it("returns a valid positive RegionData shape", async () => {
    const data = await buildThailandData();
    expect(data.regionId).toBe("thailand");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
  });
});
