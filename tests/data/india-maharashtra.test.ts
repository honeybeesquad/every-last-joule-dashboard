import { describe, expect, it } from "vitest";
import { buildIndiaMaharashtraData } from "../../src/data/india-maharashtra.json";

// 2026-08-03: promoted T3-modelled -> T2-annual-calibrated on measured MSLDC
// Monthly Curtailment Reports. The loader no longer applies a curtailment rate
// to a generation denominator; it reads the operator's own published curtailed
// energy. T2 rather than T1 because MSLDC publishes monthly, lags 1-2 months
// and skips months outright.
describe("india-maharashtra loader", () => {
  it("returns a valid positive RegionData shape with T2-annual-calibrated tier", async () => {
    const data = await buildIndiaMaharashtraData();
    expect(data.regionId).toBe("india-maharashtra");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
    expect(data.confidenceTier).toBe("T2-annual-calibrated");
  });

  it("uncertainty bounds reflect ±20% T2 envelope", async () => {
    const data = await buildIndiaMaharashtraData();
    expect(data.uncertaintyLowGW).toBeGreaterThan(0);
    expect(data.uncertaintyHighGW).toBeGreaterThan(data.peakGW);
    expect(data.uncertaintyHighGW).toBeCloseTo(data.peakGW * 1.20, 4);
    expect(data.uncertaintyLowGW).toBeCloseTo(data.peakGW * 0.80, 4);
  });

  it("emits a flat 24/7 profile — the source gives daily energy, no intraday shape", async () => {
    const data = await buildIndiaMaharashtraData();
    const distinct = new Set(data.profile.map((v) => v.toFixed(9)));
    expect(distinct.size).toBe(1);
    expect(data.profile.every((v) => v > 0)).toBe(true);
  });

  it("magnitude matches the measured MSLDC record, not the old Ember-rate estimate", async () => {
    const data = await buildIndiaMaharashtraData();
    // Measured: 33.28 GWh across 453 published days -> ~26.8 GWh/yr.
    // The superseded estimate emitted ~0.101 TWh/30d (~1230 GWh/yr), ~46x high.
    const annualisedGwh = data.totalTWh * (365 / 30) * 1000;
    expect(annualisedGwh).toBeGreaterThan(15);
    expect(annualisedGwh).toBeLessThan(60);
  });

  it("fuel split is measured and solar-dominated", async () => {
    const data = await buildIndiaMaharashtraData();
    expect(data.fuelShare?.solar).toBeGreaterThan(0.8);
    expect((data.fuelShare?.solar ?? 0) + (data.fuelShare?.wind ?? 0)).toBeCloseTo(1, 6);
  });
});
