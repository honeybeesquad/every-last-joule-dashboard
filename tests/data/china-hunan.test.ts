import { describe, expect, it } from "vitest";
import { buildChinaHunanData } from "../../src/data/china-hunan.json";

describe("china-hunan loader", () => {
  it("returns T3 mixed fallback data", async () => {
    const data = await buildChinaHunanData();
    expect(data.regionId).toBe("china-hunan");
    expect(data.profile).toHaveLength(24);
    expect(data.totalTWh).toBeCloseTo((1.9 * 30) / 365, 8);
    expect(data.confidenceTier).toBe("T3-modelled");
    expect(data.fuelShare?.wind).toBeCloseTo(0.5, 2);
    expect(data.fuelShare?.solar).toBeCloseTo(0.3, 2);
    expect(data.fuelShare?.hydro).toBeCloseTo(0.2, 2);
  });
});
