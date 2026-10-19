import { describe, expect, it } from "vitest";
import { argentinaGenerationTWh, buildArgentinaData, CAMMESA_INTERVAL_HOURS } from "../../src/data/argentina.json";
import type { CurtailmentPoint } from "../../src/lib/types";

describe("argentina loader", () => {
  it("returns unpublished waste and a 30-day generation scale of the short relay file", async () => {
    const data = await buildArgentinaData();
    expect(data.regionId).toBe("argentina");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBe(0);
    expect(data.profile.every((v) => v === 0)).toBe(true);
    expect(data.wasteStatus).toBe("unpublished");
    expect(data.generationProfile).toHaveLength(24);
    expect(data.confidenceTier).toBe("T3-modelled");
    // Committed CSV ends 2026-06-21, well past the 4-day relay threshold.
    expect(data.sourceStatus).toBe("degraded");
    const fromProfile = (data.generationProfile!.reduce((sum, gw) => sum + gw, 0) * 30) / 1000;
    expect(data.generationTotalTWh).toBeCloseTo(fromProfile, 6);
    // Treating each 5-minute row as an hour counted this file at about 4.3 TWh.
    expect(data.generationTotalTWh!).toBeGreaterThan(0);
    expect(data.generationTotalTWh!).toBeLessThan(3);
    expect(data.sourceNote).toMatch(/diurnal mean extended across 30 days/);
  });

  it("sums a 30-day window at 5 minutes, not as one hour per row", () => {
    const points: CurtailmentPoint[] = [];
    const start = Date.parse("2026-01-01T00:00:00Z");
    // 30 days of 5-minute rows at a flat 1,200 MW. True energy is 1,200 MW × 720 h.
    const steps = 30 * 24 * 12;
    for (let i = 0; i < steps; i++) {
      points.push({
        utcTimestamp: new Date(start + i * 5 * 60 * 1000).toISOString(),
        mw: 1200,
      });
    }
    const twh = argentinaGenerationTWh(points);
    const trueTwh = (1200 * 30 * 24) / 1_000_000;
    const hourMiscount = trueTwh / CAMMESA_INTERVAL_HOURS;
    expect(twh).toBeCloseTo(trueTwh, 4);
    expect(hourMiscount / twh).toBeCloseTo(12, 4);
  });
});
