import { describe, expect, it } from "vitest";
import { buildGuangxiData } from "../../src/data/guangxi.json";

describe("guangxi loader", () => {
  it("returns per-fuel fallback data with wind and solar entries", async () => {
    const data = await buildGuangxiData();
    expect(data.wind.regionId).toBe("guangxi-wind");
    expect(data.solar.regionId).toBe("guangxi-solar");
    expect(data.wind.profile).toHaveLength(24);
    expect(data.solar.profile).toHaveLength(24);
    expect(data.wind.latestProfile).toBeNull();
    expect(data.solar.latestProfile).toBeNull();
    expect(data.wind.totalTWh).toBeCloseTo((0.2 * 30) / 365, 5);
    expect(data.solar.totalTWh).toBeCloseTo((0.3 * 30) / 365, 5);
  });
});
