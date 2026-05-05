import { describe, expect, it } from "vitest";
import { buildChinaShanxiData } from "../../src/data/china-shanxi.json";

describe("china-shanxi loader", () => {
  it("returns per-fuel fallback data — wind 60% / solar 40%", async () => {
    const data = await buildChinaShanxiData();
    expect(data.wind.regionId).toBe("china-shanxi-wind");
    expect(data.solar.regionId).toBe("china-shanxi-solar");
    expect(data.wind.profile).toHaveLength(24);
    expect(data.solar.profile).toHaveLength(24);
    expect(data.wind.totalTWh).toBeCloseTo((1.4 * 0.6 * 30) / 365, 5);
    expect(data.solar.totalTWh).toBeCloseTo((1.4 * 0.4 * 30) / 365, 5);
    expect(data.wind.confidenceTier).toBe("T3-modelled");
  });
});
