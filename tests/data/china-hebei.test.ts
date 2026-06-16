import { describe, expect, it } from "vitest";
import { buildChinaHebeiData } from "../../src/data/china-hebei.json";

describe("china-hebei loader", () => {
  it("returns T3 wind+solar fallback data", async () => {
    const data = await buildChinaHebeiData();
    expect(data).toHaveProperty("wind");
    expect(data).toHaveProperty("solar");
    expect(data.wind.regionId).toBe("china-hebei-wind");
    expect(data.wind.profile).toHaveLength(24);
    expect(data.wind.totalTWh).toBeCloseTo((2.0 * 30) / 365, 8);
    expect(data.wind.confidenceTier).toBe("T3-modelled");
    expect(data.solar.regionId).toBe("china-hebei-solar");
    expect(data.solar.profile).toHaveLength(24);
    expect(data.solar.totalTWh).toBeCloseTo((0.5 * 30) / 365, 8);
    expect(data.solar.confidenceTier).toBe("T3-modelled");
  });
});
