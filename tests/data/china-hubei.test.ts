import { describe, expect, it } from "vitest";
import { buildChinaHubeiData } from "../../src/data/china-hubei.json";

describe("china-hubei loader", () => {
  it("returns per-fuel fallback data — wind/solar/hydro (Three Gorges basin)", async () => {
    const data = await buildChinaHubeiData();
    expect(data.wind.regionId).toBe("china-hubei-wind");
    expect(data.solar.regionId).toBe("china-hubei-solar");
    expect(data.hydro.regionId).toBe("china-hubei-hydro");
    expect(data.wind.totalTWh).toBeCloseTo((1.5 * 0.26 * 30) / 365, 5);
    expect(data.solar.totalTWh).toBeCloseTo((1.5 * 0.40 * 30) / 365, 5);
    expect(data.hydro.totalTWh).toBeCloseTo((1.5 * 0.34 * 30) / 365, 5);
    expect(data.wind.confidenceTier).toBe("T3-modelled");
  });
});
