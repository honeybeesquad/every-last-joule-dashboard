import { describe, expect, it } from "vitest";
import { buildXinjiangData } from "../../src/data/xinjiang.json";

describe("xinjiang loader", () => {
  it("returns T3-modelled data with a refreshed anchor and honest provenance", async () => {
    const data = await buildXinjiangData();
    expect(data).toHaveProperty("wind");
    expect(data).toHaveProperty("solar");
    expect(data.wind.regionId).toBe("xinjiang-wind");
    expect(data.wind.profile).toHaveLength(24);
    // The store (data/china-anchors.json) refreshes the annual anchor from Ember
    // 2026 trailing-12mo generation, but the region stays T3-modelled (typical
    // shape scaled to a published anchor) — it is NOT promoted to live.
    expect(data.wind.confidenceTier).toBe("T3-modelled");
    expect(data.wind.sourceProvenance).toBe("modelled-fallback");
    expect(data.wind.sourceStatus).toBe("cached");
    // Anchor comes from the refreshed store (6.341 TWh), not the 5.0 fallback.
    expect(data.wind.totalTWh).toBeCloseTo((6.341 * 30) / 365, 4);
    expect(data.solar.regionId).toBe("xinjiang-solar");
    expect(data.solar.profile).toHaveLength(24);
    expect(data.solar.confidenceTier).toBe("T3-modelled");
    expect(data.solar.totalTWh).toBeCloseTo((5.94 * 30) / 365, 4);
    // Envelope in-band.
    expect(data.wind.peakGW).toBeGreaterThanOrEqual(data.wind.uncertaintyLowGW ?? 0);
    expect(data.wind.peakGW).toBeLessThanOrEqual(data.wind.uncertaintyHighGW ?? 0);
  });
});
