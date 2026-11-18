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
    // Full-year 2024 Mengxi rate 6.3% (2026-11-19): 209.731 TWh × 0.063 = 13.213 TWh/yr × 30/365.
    expect(data.wind.totalTWh).toBeCloseTo(1.086, 4);
    expect(data.wind.confidenceTier).toBe("T3-modelled");
    expect(data.wind.sourceProvenance).toBe("modelled-fallback");
    expect(data.wind.sourceStatus).toBe("cached");
    // 79.119 TWh × 0.063 = 4.984 TWh/yr × 30/365.
    expect(data.solar.totalTWh).toBeCloseTo(0.409644, 4);
    expect(data.solar.confidenceTier).toBe("T3-modelled");
    expect(data.solar.sourceProvenance).toBe("modelled-fallback");
    expect(data.solar.sourceStatus).toBe("cached");
  });
});
