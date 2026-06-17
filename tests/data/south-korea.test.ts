import { describe, expect, it } from "vitest";
import { buildSouthKoreaData } from "../../src/data/south-korea.json";

describe("south-korea loader", () => {
  it("returns valid positive solar + wind RegionData (mainland anchor split)", async () => {
    const { solar, wind } = await buildSouthKoreaData();

    expect(solar.regionId).toBe("south-korea-solar");
    expect(solar.profile).toHaveLength(24);
    expect(solar.latestProfile).toBeNull();
    expect(solar.totalTWh).toBeGreaterThan(0);
    expect(solar.peakGW).toBeGreaterThan(0);
    expect(solar.sourceNote).toContain("mainland");
    // Forensic honesty check: solar must read 0 at local night (KST midnight = 15 UTC).
    expect(solar.profile[15]).toBe(0);

    expect(wind.regionId).toBe("south-korea-wind");
    expect(wind.profile).toHaveLength(24);
    expect(wind.totalTWh).toBeGreaterThan(0);
    expect(wind.peakGW).toBeGreaterThan(0);
    expect(wind.sourceNote).toContain("mainland");
  });
});
