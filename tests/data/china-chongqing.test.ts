import { describe, expect, it } from "vitest";
import { buildChinaChongqingData } from "../../src/data/china-chongqing.json";

describe("china-chongqing loader", () => {
  it("returns T3 mixed fallback data", async () => {
    const data = await buildChinaChongqingData();
    expect(data.regionId).toBe("china-chongqing");
    expect(data.profile).toHaveLength(24);
    expect(data.totalTWh).toBeCloseTo((0.22 * 30) / 365, 8);
    expect(data.confidenceTier).toBe("T3-modelled");
    expect(data.fuelShare?.hydro).toBeCloseTo(0.6, 2);
    expect(data.fuelShare?.solar).toBeCloseTo(0.4, 2);
  });
});
