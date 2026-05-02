import { describe, expect, it } from "vitest";
import { buildChinaHubeiData } from "../../src/data/china-hubei.json";

describe("china-hubei loader", () => {
  it("returns T3 mixed fallback data", async () => {
    const data = await buildChinaHubeiData();
    expect(data.regionId).toBe("china-hubei");
    expect(data.profile).toHaveLength(24);
    expect(data.totalTWh).toBeCloseTo((1.5 * 30) / 365, 8);
    expect(data.confidenceTier).toBe("T3-modelled");
    expect(data.fuelShare?.solar).toBeCloseTo(0.4, 2);
    expect(data.fuelShare?.wind).toBeCloseTo(0.26, 2);
    expect(data.fuelShare?.hydro).toBeCloseTo(0.34, 2);
  });
});
