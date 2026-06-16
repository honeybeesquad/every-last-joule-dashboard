import { describe, expect, it } from "vitest";
import { buildChinaLiaoningData } from "../../src/data/china-liaoning.json";

describe("china-liaoning loader", () => {
  it("returns T3 wind+solar fallback data", async () => {
    const data = await buildChinaLiaoningData();
    expect(data).toHaveProperty("wind");
    expect(data).toHaveProperty("solar");
    expect(data.wind.regionId).toBe("china-liaoning-wind");
    expect(data.wind.profile).toHaveLength(24);
    expect(data.wind.totalTWh).toBeCloseTo((1.6 * 30) / 365, 8);
    expect(data.wind.confidenceTier).toBe("T3-modelled");
    expect(data.solar.regionId).toBe("china-liaoning-solar");
    expect(data.solar.profile).toHaveLength(24);
    expect(data.solar.totalTWh).toBeCloseTo((0.5 * 30) / 365, 8);
    expect(data.solar.confidenceTier).toBe("T3-modelled");
  });
});
