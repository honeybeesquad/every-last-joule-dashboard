import { describe, expect, it } from "vitest";
import { buildArgentinaData } from "../../src/data/argentina.json";

describe("argentina loader", () => {
  it("returns a valid positive RegionData shape", async () => {
    const data = await buildArgentinaData();
    expect(data.regionId).toBe("argentina");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBe(0);
    expect(data.wasteStatus).toBe("unpublished");
    expect(data.generationProfile).toHaveLength(24);
    expect(data.generationTotalTWh).toBeGreaterThan(0);
    expect(data.confidenceTier).toBe("T3-modelled");
  });
});
