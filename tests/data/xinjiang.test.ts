import { describe, expect, it } from "vitest";
import { buildXinjiangData } from "../../src/data/xinjiang.json";

describe("xinjiang loader", () => {
  it("returns T3 wind+solar fallback data", async () => {
    const data = await buildXinjiangData();
    expect(data).toHaveProperty("wind");
    expect(data).toHaveProperty("solar");
    expect(data.wind.regionId).toBe("xinjiang-wind");
    expect(data.wind.profile).toHaveLength(24);
    expect(data.wind.totalTWh).toBeCloseTo((5.0 * 30) / 365, 8);
    expect(data.wind.confidenceTier).toBe("T3-modelled");
    expect(data.solar.regionId).toBe("xinjiang-solar");
    expect(data.solar.profile).toHaveLength(24);
    expect(data.solar.totalTWh).toBeCloseTo((3.2 * 30) / 365, 8);
    expect(data.solar.confidenceTier).toBe("T3-modelled");
  });
});
