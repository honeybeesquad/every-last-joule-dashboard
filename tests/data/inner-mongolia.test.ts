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
    expect(data.wind.totalTWh).toBeCloseTo(0.792986, 4);
    expect(data.wind.confidenceTier).toBe("T3-modelled");
    expect(data.wind.sourceProvenance).toBe("modelled-fallback");
    expect(data.wind.sourceStatus).toBe("cached");
    expect(data.solar.totalTWh).toBeCloseTo(0.344630, 4);
    expect(data.solar.confidenceTier).toBe("T3-modelled");
    expect(data.solar.sourceProvenance).toBe("modelled-fallback");
    expect(data.solar.sourceStatus).toBe("cached");
  });
});
