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
    expect(data.wind.totalTWh).toBeCloseTo((8.0 * 30) / 365, 5);
    expect(data.solar.totalTWh).toBeCloseTo((4.6 * 30) / 365, 5);
  });
});
