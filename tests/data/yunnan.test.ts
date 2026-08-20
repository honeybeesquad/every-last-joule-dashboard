import { describe, expect, it } from "vitest";
import { buildYunnanData } from "../../src/data/yunnan.json";

describe("yunnan loader", () => {
  it("returns per-fuel data with wind and solar entries, refreshed from the store", async () => {
    const data = await buildYunnanData();
    expect(data.wind.regionId).toBe("yunnan-wind");
    expect(data.solar.regionId).toBe("yunnan-solar");
    expect(data.wind.profile).toHaveLength(24);
    expect(data.solar.profile).toHaveLength(24);
    expect(data.wind.latestProfile).toBeNull();
    expect(data.solar.latestProfile).toBeNull();
    // Refreshed anchor (data/china-anchors.json) replaces the hardcoded fallback.
    expect(data.wind.confidenceTier).toBe("T3-modelled");
    expect(data.solar.confidenceTier).toBe("T3-modelled");
    expect(data.wind.totalTWh).toBeCloseTo((0.324 * 30) / 365, 5);
    expect(data.solar.totalTWh).toBeCloseTo((1.929 * 30) / 365, 5);
  });
});
