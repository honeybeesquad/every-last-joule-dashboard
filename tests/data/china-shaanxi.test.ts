import { describe, expect, it } from "vitest";
import { buildChinaShaanxiData } from "../../src/data/china-shaanxi.json";

describe("china-shaanxi loader", () => {
  it("returns T3 wind+solar fallback data", async () => {
    const data = await buildChinaShaanxiData();
    expect(data).toHaveProperty("wind");
    expect(data).toHaveProperty("solar");
    expect(data.solar.regionId).toBe("china-shaanxi-solar");
    expect(data.solar.profile).toHaveLength(24);
    expect(data.solar.totalTWh).toBeCloseTo((1.1 * 30) / 365, 8);
    expect(data.solar.confidenceTier).toBe("T3-modelled");
    expect(data.wind.regionId).toBe("china-shaanxi-wind");
    expect(data.wind.profile).toHaveLength(24);
    expect(data.wind.totalTWh).toBeCloseTo((0.4 * 30) / 365, 8);
    expect(data.wind.confidenceTier).toBe("T3-modelled");
  });
});
