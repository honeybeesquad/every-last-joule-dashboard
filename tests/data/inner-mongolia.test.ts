import { describe, expect, it } from "vitest";
import { buildInnerMongoliaData } from "../../src/data/inner-mongolia.json";

describe("inner-mongolia loader", () => {
  it("returns per-fuel fallback data with wind and solar entries", async () => {
    const data = await buildInnerMongoliaData();
    expect(data.wind.regionId).toBe("inner-mongolia-wind");
    expect(data.solar.regionId).toBe("inner-mongolia-solar");
    expect(data.wind.profile).toHaveLength(24);
    expect(data.solar.profile).toHaveLength(24);
    expect(data.wind.latestProfile).toBeNull();
    expect(data.solar.latestProfile).toBeNull();
    // Trailing-12-month 蒙西 rate 9.66% on whole-province generation, curtailed = gen × r/(1−r): 22.648 TWh/yr × 30/365.
    expect(data.wind.totalTWh).toBeCloseTo(1.861479, 4);
    expect(data.wind.confidenceTier).toBe("T3-modelled");
    expect(data.wind.sourceProvenance).toBe("modelled-fallback");
    expect(data.wind.sourceStatus).toBe("cached");
    // 8.27% on whole-province generation: 7.665 TWh/yr × 30/365.
    expect(data.solar.totalTWh).toBeCloseTo(0.630000, 4);
    expect(data.solar.confidenceTier).toBe("T3-modelled");
    expect(data.solar.sourceProvenance).toBe("modelled-fallback");
    expect(data.solar.sourceStatus).toBe("cached");
  });
});
