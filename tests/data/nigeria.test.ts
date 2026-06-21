import { describe, expect, it } from "vitest";
import { buildNigeriaData } from "../../src/data/nigeria.json";

describe("nigeria loader", () => {
  it("returns a valid positive RegionData shape", async () => {
    const data = await buildNigeriaData();
    expect(data.regionId).toBe("nigeria");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
  });
});
