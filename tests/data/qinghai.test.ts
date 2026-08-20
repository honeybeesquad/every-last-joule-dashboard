import { describe, expect, it } from "vitest";
import { buildQinghaiData } from "../../src/data/qinghai.json";

describe("qinghai loader", () => {
  it("returns per-fuel data with wind and solar entries, refreshed from the store", async () => {
    const data = await buildQinghaiData();
    expect(data.wind.regionId).toBe("qinghai-wind");
    expect(data.solar.regionId).toBe("qinghai-solar");
    expect(data.wind.profile).toHaveLength(24);
    expect(data.solar.profile).toHaveLength(24);
    expect(data.wind.latestProfile).toBeNull();
    expect(data.solar.latestProfile).toBeNull();
    // Refreshed anchor (data/china-anchors.json) replaces the hardcoded fallback.
    expect(data.wind.confidenceTier).toBe("T3-modelled");
    expect(data.solar.confidenceTier).toBe("T3-modelled");
    expect(data.wind.totalTWh).toBeCloseTo((1.408 * 30) / 365, 5);
    expect(data.solar.totalTWh).toBeCloseTo((4.351 * 30) / 365, 5);
  });
});
