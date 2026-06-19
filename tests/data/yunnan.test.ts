import { describe, expect, it } from "vitest";
import { buildYunnanData } from "../../src/data/yunnan.json";

describe("yunnan loader", () => {
  it("returns per-fuel fallback data with wind and solar entries", async () => {
    const data = await buildYunnanData();
    expect(data.wind.regionId).toBe("yunnan-wind");
    expect(data.solar.regionId).toBe("yunnan-solar");
    expect(data.wind.profile).toHaveLength(24);
    expect(data.solar.profile).toHaveLength(24);
    expect(data.wind.latestProfile).toBeNull();
    expect(data.solar.latestProfile).toBeNull();
    expect(data.wind.totalTWh).toBeCloseTo((0.9 * 30) / 365, 5);
    expect(data.solar.totalTWh).toBeCloseTo((0.9 * 30) / 365, 5);
  });
});
