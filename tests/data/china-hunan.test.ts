import { describe, expect, it } from "vitest";
import { buildChinaHunanData } from "../../src/data/china-hunan.json";

describe("china-hunan loader", () => {
  it("returns per-fuel fallback data — wind/solar/hydro", async () => {
    const data = await buildChinaHunanData();
    expect(data.wind.regionId).toBe("china-hunan-wind");
    expect(data.solar.regionId).toBe("china-hunan-solar");
    expect(data.hydro.regionId).toBe("china-hunan-hydro");
    expect(data.wind.totalTWh).toBeCloseTo(0.049479, 4);
    expect(data.wind.confidenceTier).toBe("T3-modelled");
    expect(data.wind.sourceProvenance).toBe("modelled-fallback");
    expect(data.wind.sourceStatus).toBe("cached");
    expect(data.solar.totalTWh).toBeCloseTo(0.014137, 4);
    expect(data.solar.confidenceTier).toBe("T3-modelled");
    expect(data.solar.sourceProvenance).toBe("modelled-fallback");
    expect(data.solar.sourceStatus).toBe("cached");
    expect(data.hydro.totalTWh).toBeCloseTo((1.9 * 0.2 * 30) / 365, 5);
    expect(data.wind.confidenceTier).toBe("T3-modelled");
  });
});
