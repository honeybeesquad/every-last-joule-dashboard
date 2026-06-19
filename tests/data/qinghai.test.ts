import { describe, expect, it } from "vitest";
import { buildQinghaiData } from "../../src/data/qinghai.json";

describe("qinghai loader", () => {
  it("returns per-fuel fallback data with wind and solar entries", async () => {
    const data = await buildQinghaiData();
    expect(data.wind.regionId).toBe("qinghai-wind");
    expect(data.solar.regionId).toBe("qinghai-solar");
    expect(data.wind.profile).toHaveLength(24);
    expect(data.solar.profile).toHaveLength(24);
    expect(data.wind.latestProfile).toBeNull();
    expect(data.solar.latestProfile).toBeNull();
    expect(data.wind.totalTWh).toBeCloseTo((1.5 * 30) / 365, 5);
    expect(data.solar.totalTWh).toBeCloseTo((2.6 * 30) / 365, 5);
  });
});
