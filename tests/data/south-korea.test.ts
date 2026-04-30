import { describe, expect, it } from "vitest";
import { buildSouthKoreaData } from "../../src/data/south-korea.json";

describe("south-korea loader", () => {
  it("returns a valid positive RegionData shape", async () => {
    const data = await buildSouthKoreaData();
    expect(data.regionId).toBe("south-korea");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
    expect(data.sourceNote).toContain("Typical-shape fallback");
    expect(data.sourceNote).toContain("mainland");
  });
});
