import { describe, expect, it } from "vitest";
import { buildChinaFujianData } from "../../src/data/china-fujian.json";

describe("china-fujian loader", () => {
  it("returns T3 mixed fallback data", async () => {
    const data = await buildChinaFujianData();
    expect(data.regionId).toBe("china-fujian");
    expect(data.profile).toHaveLength(24);
    expect(data.totalTWh).toBeCloseTo((0.6 * 30) / 365, 8);
    expect(data.confidenceTier).toBe("T3-modelled");
    expect(data.fuelShare?.wind).toBeCloseTo(0.55, 2);
    expect(data.fuelShare?.solar).toBeCloseTo(0.45, 2);
  });
});
