import { describe, expect, it } from "vitest";
import { buildChinaJiangsuData } from "../../src/data/china-jiangsu.json";

describe("china-jiangsu loader", () => {
  it("returns T3 mixed fallback data", async () => {
    const data = await buildChinaJiangsuData();
    expect(data.regionId).toBe("china-jiangsu");
    expect(data.profile).toHaveLength(24);
    expect(data.totalTWh).toBeCloseTo((2.8 * 30) / 365, 8);
    expect(data.confidenceTier).toBe("T3-modelled");
    expect(data.fuelShare?.wind).toBeCloseTo(0.5, 2);
    expect(data.fuelShare?.solar).toBeCloseTo(0.5, 2);
  });
});
