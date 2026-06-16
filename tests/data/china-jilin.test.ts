import { describe, expect, it } from "vitest";
import { buildChinaJilinData } from "../../src/data/china-jilin.json";

describe("china-jilin loader", () => {
  it("returns T3 wind+solar fallback data", async () => {
    const data = await buildChinaJilinData();
    expect(data).toHaveProperty("wind");
    expect(data).toHaveProperty("solar");
    expect(data.wind.regionId).toBe("china-jilin-wind");
    expect(data.wind.profile).toHaveLength(24);
    expect(data.wind.totalTWh).toBeCloseTo((1.0 * 30) / 365, 8);
    expect(data.wind.confidenceTier).toBe("T3-modelled");
    expect(data.solar.regionId).toBe("china-jilin-solar");
    expect(data.solar.profile).toHaveLength(24);
    expect(data.solar.totalTWh).toBeCloseTo((0.2 * 30) / 365, 8);
    expect(data.solar.confidenceTier).toBe("T3-modelled");
  });
});
