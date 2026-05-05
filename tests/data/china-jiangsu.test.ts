import { describe, expect, it } from "vitest";
import { buildChinaJiangsuData } from "../../src/data/china-jiangsu.json";

describe("china-jiangsu loader", () => {
  it("returns per-fuel fallback data — wind 50% / solar 50%", async () => {
    const data = await buildChinaJiangsuData();
    expect(data.wind.regionId).toBe("china-jiangsu-wind");
    expect(data.solar.regionId).toBe("china-jiangsu-solar");
    expect(data.wind.profile).toHaveLength(24);
    expect(data.solar.profile).toHaveLength(24);
    expect(data.wind.totalTWh).toBeCloseTo((2.8 * 0.5 * 30) / 365, 5);
    expect(data.solar.totalTWh).toBeCloseTo((2.8 * 0.5 * 30) / 365, 5);
    expect(data.wind.confidenceTier).toBe("T3-modelled");
  });
});
