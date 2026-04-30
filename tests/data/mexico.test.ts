import { describe, expect, it } from "vitest";
import { buildMexicoData } from "../../src/data/mexico.json";

describe("mexico loader", () => {
  it("returns a valid positive RegionData shape", async () => {
    const data = await buildMexicoData();
    expect(data.regionId).toBe("mexico");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
  });
});
