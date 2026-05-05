import { describe, expect, it } from "vitest";
import { buildChinaHunanData } from "../../src/data/china-hunan.json";

describe("china-hunan loader", () => {
  it("returns per-fuel fallback data — wind/solar/hydro", async () => {
    const data = await buildChinaHunanData();
    expect(data.wind.regionId).toBe("china-hunan-wind");
    expect(data.solar.regionId).toBe("china-hunan-solar");
    expect(data.hydro.regionId).toBe("china-hunan-hydro");
    expect(data.wind.totalTWh).toBeCloseTo((1.9 * 0.5 * 30) / 365, 5);
    expect(data.solar.totalTWh).toBeCloseTo((1.9 * 0.3 * 30) / 365, 5);
    expect(data.hydro.totalTWh).toBeCloseTo((1.9 * 0.2 * 30) / 365, 5);
    expect(data.wind.confidenceTier).toBe("T3-modelled");
  });
});
