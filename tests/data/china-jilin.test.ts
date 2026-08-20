import { describe, expect, it } from "vitest";
import { buildChinaJilinData } from "../../src/data/china-jilin.json";

describe("china-jilin loader", () => {
  it("returns T3 wind+solar fallback data", async () => {
    const data = await buildChinaJilinData();
    expect(data).toHaveProperty("wind");
    expect(data).toHaveProperty("solar");
    expect(data.wind.regionId).toBe("china-jilin-wind");
    expect(data.wind.profile).toHaveLength(24);
    expect(data.wind.totalTWh).toBeCloseTo(0.174575, 4);
    expect(data.wind.confidenceTier).toBe("T3-modelled");
    expect(data.wind.sourceProvenance).toBe("modelled-fallback");
    expect(data.wind.sourceStatus).toBe("cached");
    expect(data.wind.confidenceTier).toBe("T3-modelled");
    expect(data.solar.regionId).toBe("china-jilin-solar");
    expect(data.solar.profile).toHaveLength(24);
    expect(data.solar.totalTWh).toBeCloseTo(0.019315, 4);
    expect(data.solar.confidenceTier).toBe("T3-modelled");
    expect(data.solar.sourceProvenance).toBe("modelled-fallback");
    expect(data.solar.sourceStatus).toBe("cached");
    expect(data.solar.confidenceTier).toBe("T3-modelled");
  });
});
