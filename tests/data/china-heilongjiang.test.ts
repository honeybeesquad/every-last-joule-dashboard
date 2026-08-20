import { describe, expect, it } from "vitest";
import { buildChinaHeilongjiangData } from "../../src/data/china-heilongjiang.json";

describe("china-heilongjiang loader", () => {
  it("returns T3 wind+solar fallback data", async () => {
    const data = await buildChinaHeilongjiangData();
    expect(data).toHaveProperty("wind");
    expect(data).toHaveProperty("solar");
    expect(data.wind.regionId).toBe("china-heilongjiang-wind");
    expect(data.wind.profile).toHaveLength(24);
    expect(data.wind.totalTWh).toBeCloseTo(0.167096, 4);
    expect(data.wind.confidenceTier).toBe("T3-modelled");
    expect(data.wind.sourceProvenance).toBe("modelled-fallback");
    expect(data.wind.sourceStatus).toBe("cached");
    expect(data.wind.confidenceTier).toBe("T3-modelled");
    expect(data.solar.regionId).toBe("china-heilongjiang-solar");
    expect(data.solar.profile).toHaveLength(24);
    expect(data.solar.totalTWh).toBeCloseTo(0.028685, 4);
    expect(data.solar.confidenceTier).toBe("T3-modelled");
    expect(data.solar.sourceProvenance).toBe("modelled-fallback");
    expect(data.solar.sourceStatus).toBe("cached");
    expect(data.solar.confidenceTier).toBe("T3-modelled");
  });
});
