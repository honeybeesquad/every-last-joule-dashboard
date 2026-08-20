import { describe, expect, it } from "vitest";
import { buildChinaHenanData } from "../../src/data/china-henan.json";

describe("china-henan loader", () => {
  it("returns T3 wind+solar fallback data", async () => {
    const data = await buildChinaHenanData();
    expect(data).toHaveProperty("wind");
    expect(data).toHaveProperty("solar");
    expect(data.solar.regionId).toBe("china-henan-solar");
    expect(data.solar.profile).toHaveLength(24);
    expect(data.solar.totalTWh).toBeCloseTo(0.084082, 4);
    expect(data.solar.confidenceTier).toBe("T3-modelled");
    expect(data.solar.sourceProvenance).toBe("modelled-fallback");
    expect(data.solar.sourceStatus).toBe("cached");
    expect(data.solar.confidenceTier).toBe("T3-modelled");
    expect(data.wind.regionId).toBe("china-henan-wind");
    expect(data.wind.profile).toHaveLength(24);
    expect(data.wind.totalTWh).toBeCloseTo(0.152630, 4);
    expect(data.wind.confidenceTier).toBe("T3-modelled");
    expect(data.wind.sourceProvenance).toBe("modelled-fallback");
    expect(data.wind.sourceStatus).toBe("cached");
    expect(data.wind.confidenceTier).toBe("T3-modelled");
  });
});
