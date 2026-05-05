import { describe, expect, it } from "vitest";
import { buildChinaChongqingData } from "../../src/data/china-chongqing.json";

describe("china-chongqing loader", () => {
  it("returns per-fuel fallback data — hydro/solar (Yangtze basin)", async () => {
    const data = await buildChinaChongqingData();
    expect(data.hydro.regionId).toBe("china-chongqing-hydro");
    expect(data.solar.regionId).toBe("china-chongqing-solar");
    expect(data.hydro.totalTWh).toBeCloseTo((0.22 * 0.6 * 30) / 365, 5);
    expect(data.solar.totalTWh).toBeCloseTo((0.22 * 0.4 * 30) / 365, 5);
    expect(data.hydro.confidenceTier).toBe("T2-annual-calibrated");
  });
});
