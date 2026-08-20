import { describe, expect, it } from "vitest";
import { buildChinaJiangsuData } from "../../src/data/china-jiangsu.json";

describe("china-jiangsu loader", () => {
  it("returns per-fuel fallback data — wind 50% / solar 50%", async () => {
    const data = await buildChinaJiangsuData();
    expect(data.wind.regionId).toBe("china-jiangsu-wind");
    expect(data.solar.regionId).toBe("china-jiangsu-solar");
    expect(data.wind.profile).toHaveLength(24);
    expect(data.solar.profile).toHaveLength(24);
    expect(data.wind.totalTWh).toBeCloseTo(0.013808, 4);
    expect(data.wind.confidenceTier).toBe("T3-modelled");
    expect(data.wind.sourceProvenance).toBe("modelled-fallback");
    expect(data.wind.sourceStatus).toBe("cached");
    expect(data.solar.totalTWh).toBeCloseTo(0.007973, 4);
    expect(data.solar.confidenceTier).toBe("T3-modelled");
    expect(data.solar.sourceProvenance).toBe("modelled-fallback");
    expect(data.solar.sourceStatus).toBe("cached");
    expect(data.wind.confidenceTier).toBe("T3-modelled");
  });
});
