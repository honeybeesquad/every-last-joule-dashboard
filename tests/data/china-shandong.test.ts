import { describe, expect, it } from "vitest";
import { buildChinaShandongData } from "../../src/data/china-shandong.json";

describe("china-shandong loader", () => {
  it("returns T3 wind+solar fallback data", async () => {
    const data = await buildChinaShandongData();
    expect(data).toHaveProperty("wind");
    expect(data).toHaveProperty("solar");
    expect(data.solar.regionId).toBe("china-shandong-solar");
    expect(data.solar.profile).toHaveLength(24);
    expect(data.solar.totalTWh).toBeCloseTo((4.025 * 30) / 365, 8);
    expect(data.solar.confidenceTier).toBe("T3-modelled");
    expect(data.wind.regionId).toBe("china-shandong-wind");
    expect(data.wind.profile).toHaveLength(24);
    expect(data.wind.totalTWh).toBeCloseTo((1.961 * 30) / 365, 8);
    expect(data.wind.confidenceTier).toBe("T3-modelled");
  });
});
