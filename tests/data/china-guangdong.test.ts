import { describe, expect, it } from "vitest";
import { buildChinaGuangdongData } from "../../src/data/china-guangdong.json";

describe("china-guangdong loader", () => {
  it("returns T3 mixed fallback data", async () => {
    const data = await buildChinaGuangdongData();
    expect(data.regionId).toBe("china-guangdong");
    expect(data.profile).toHaveLength(24);
    expect(data.totalTWh).toBeCloseTo((3.2 * 30) / 365, 8);
    expect(data.confidenceTier).toBe("T3-modelled");
    expect(data.fuelShare?.wind).toBeCloseTo(0.55, 2);
    expect(data.fuelShare?.solar).toBeCloseTo(0.45, 2);
  });
});
