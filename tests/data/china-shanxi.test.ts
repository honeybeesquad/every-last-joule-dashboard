import { describe, expect, it } from "vitest";
import { buildChinaShanxiData } from "../../src/data/china-shanxi.json";

describe("china-shanxi loader", () => {
  it("returns T3 mixed fallback data", async () => {
    const data = await buildChinaShanxiData();
    expect(data.regionId).toBe("china-shanxi");
    expect(data.profile).toHaveLength(24);
    expect(data.totalTWh).toBeCloseTo((1.4 * 30) / 365, 8);
    expect(data.confidenceTier).toBe("T3-modelled");
    expect(data.fuelShare?.wind).toBeCloseTo(0.6, 2);
    expect(data.fuelShare?.solar).toBeCloseTo(0.4, 2);
  });
});
