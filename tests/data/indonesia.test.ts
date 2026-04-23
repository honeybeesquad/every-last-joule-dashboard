import { describe, expect, it } from "vitest";
import { buildIndonesiaData } from "../../src/data/indonesia.json";

describe("indonesia loader", () => {
  it("returns a valid positive RegionData shape", async () => {
    const data = await buildIndonesiaData();
    expect(data.regionId).toBe("indonesia");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
  });
});
