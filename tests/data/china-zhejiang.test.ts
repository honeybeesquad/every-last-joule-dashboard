import { describe, expect, it } from "vitest";
import { buildChinaZhejiangData } from "../../src/data/china-zhejiang.json";

describe("china-zhejiang loader", () => {
  it("returns T3 mixed fallback data", async () => {
    const data = await buildChinaZhejiangData();
    expect(data.regionId).toBe("china-zhejiang");
    expect(data.profile).toHaveLength(24);
    expect(data.totalTWh).toBeCloseTo((0.8 * 30) / 365, 8);
    expect(data.confidenceTier).toBe("T3-modelled");
    expect(data.fuelShare?.wind).toBeCloseTo(0.5, 2);
    expect(data.fuelShare?.solar).toBeCloseTo(0.5, 2);
  });
});
