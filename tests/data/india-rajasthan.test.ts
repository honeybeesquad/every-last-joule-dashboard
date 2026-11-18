import { describe, expect, it } from "vitest";
import { buildIndiaRajasthanData } from "../../src/data/india-rajasthan.json";

// 2026-10-19: promoted T3-modelled -> T2-annual-calibrated on measured RRVPNL
// re-curtailment PDFs (0.052 TWh Jan–May 2026). Not annualised. T2 rather than
// T1 because the source is a partial PDF listing, not a live feed.
describe("india-rajasthan loader", () => {
  it("returns a valid positive RegionData shape with T2-annual-calibrated tier", async () => {
    const data = await buildIndiaRajasthanData();
    expect(data.regionId).toBe("india-rajasthan");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
    expect(data.confidenceTier).toBe("T2-annual-calibrated");
    expect(data.sourceProvenance).toBe("verified");
    expect(data.sourceNote).toMatch(/0\.052 TWh/);
    expect(data.sourceNote).toMatch(/not annualised/i);
    expect(data.sourceNote).toMatch(/issue #964/);
    expect(data.sourceNote).not.toMatch(/T1a/);
  });

  it("emits a flat 24/7 profile — events are not an hourly series", async () => {
    const data = await buildIndiaRajasthanData();
    const distinct = new Set(data.profile.map((v) => v.toFixed(9)));
    expect(distinct.size).toBe(1);
    expect(data.profile.every((v) => v > 0)).toBe(true);
  });

  it("uncertainty bounds reflect ±20% T2 envelope", async () => {
    const data = await buildIndiaRajasthanData();
    expect(data.uncertaintyLowGW).toBeGreaterThan(0);
    expect(data.uncertaintyHighGW).toBeGreaterThan(data.peakGW);
    expect(data.uncertaintyHighGW).toBeCloseTo(data.peakGW * 1.20, 4);
    expect(data.uncertaintyLowGW).toBeCloseTo(data.peakGW * 0.80, 4);
  });

  it("magnitude is the published Jan–May floor spread over 151 days, not CEA×Ember", async () => {
    const data = await buildIndiaRajasthanData();
    // 0.052326832 TWh × 30 / 151 ≈ 0.01040 TWh/30d. Old T3 was ~0.37 TWh/30d.
    expect(data.totalTWh).toBeGreaterThan(0.009);
    expect(data.totalTWh).toBeLessThan(0.012);
  });

  it("fuel split is measured and solar-dominated", async () => {
    const data = await buildIndiaRajasthanData();
    expect(data.fuelShare?.solar).toBeGreaterThan(0.9);
    expect((data.fuelShare?.solar ?? 0) + (data.fuelShare?.wind ?? 0)).toBeCloseTo(1, 6);
  });
});
