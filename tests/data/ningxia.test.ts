import { describe, expect, it } from "vitest";
import { buildNingxiaData } from "../../src/data/ningxia.json";

describe("ningxia loader", () => {
  it("returns per-fuel fallback data with wind and solar entries", async () => {
    const data = await buildNingxiaData();
    expect(data.wind.regionId).toBe("ningxia-wind");
    expect(data.solar.regionId).toBe("ningxia-solar");
    expect(data.wind.profile).toHaveLength(24);
    expect(data.solar.profile).toHaveLength(24);
    expect(data.wind.totalTWh).toBeCloseTo((0.5 * 30) / 365, 5);
    expect(data.solar.totalTWh).toBeCloseTo((0.5 * 30) / 365, 5);
  });
});
