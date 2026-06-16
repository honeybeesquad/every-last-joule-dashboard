import { describe, expect, it } from "vitest";
import { buildChinaAnhuiData } from "../../src/data/china-anhui.json";

describe("china-anhui loader", () => {
  it("returns T3 wind+solar fallback data", async () => {
    const data = await buildChinaAnhuiData();
    expect(data).toHaveProperty("wind");
    expect(data).toHaveProperty("solar");
    expect(data.solar.regionId).toBe("china-anhui-solar");
    expect(data.solar.profile).toHaveLength(24);
    expect(data.solar.totalTWh).toBeCloseTo((2.1 * 30) / 365, 8);
    expect(data.solar.confidenceTier).toBe("T3-modelled");
    expect(data.wind.regionId).toBe("china-anhui-wind");
    expect(data.wind.profile).toHaveLength(24);
    expect(data.wind.totalTWh).toBeCloseTo((0.7 * 30) / 365, 8);
    expect(data.wind.confidenceTier).toBe("T3-modelled");
  });
});
