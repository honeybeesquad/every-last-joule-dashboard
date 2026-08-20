import { describe, expect, it } from "vitest";
import { buildXinjiangData } from "../../src/data/xinjiang.json";

describe("xinjiang loader", () => {
  it("returns T1b live-domestic-anchored data from the refreshed China anchor store", async () => {
    const data = await buildXinjiangData();
    expect(data).toHaveProperty("wind");
    expect(data).toHaveProperty("solar");
    expect(data.wind.regionId).toBe("xinjiang-wind");
    expect(data.wind.profile).toHaveLength(24);
    // Anchor comes from data/china-anchors.json (Ember 2026-06 trailing-12mo ×
    // NEA rate), not the hardcoded 5.0 TWh fallback.
    expect(data.wind.confidenceTier).toBe("T1b-live-domestic-anchored");
    expect(data.wind.sourceProvenance).toBe("verified");
    expect(data.wind.sourceStatus).toBe("live");
    expect(data.wind.totalTWh).toBeCloseTo((6.341 * 30) / 365, 4);
    expect(data.solar.regionId).toBe("xinjiang-solar");
    expect(data.solar.profile).toHaveLength(24);
    expect(data.solar.confidenceTier).toBe("T1b-live-domestic-anchored");
    expect(data.solar.totalTWh).toBeCloseTo((5.94 * 30) / 365, 4);
  });
});
