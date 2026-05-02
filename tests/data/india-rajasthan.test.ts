import { describe, expect, it } from "vitest";
import { buildIndiaRajasthanData } from "../../src/data/india-rajasthan.json";

describe("india-rajasthan loader", () => {
  it("returns a valid positive RegionData shape with T1a tier", async () => {
    const data = await buildIndiaRajasthanData();
    expect(data.regionId).toBe("india-rajasthan");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
    expect(data.confidenceTier).toBe("T1a-live-tso");
  });

  it("solar profile peaks around UTC 06-07 (Rajasthan ~73°E local noon)", async () => {
    const data = await buildIndiaRajasthanData();
    const peakHour = data.profile.indexOf(Math.max(...data.profile));
    expect(peakHour).toBeGreaterThanOrEqual(5);
    expect(peakHour).toBeLessThanOrEqual(8);
  });

  it("uncertainty bounds reflect ±15% T1a envelope", async () => {
    const data = await buildIndiaRajasthanData();
    expect(data.uncertaintyLowGW).toBeGreaterThan(0);
    expect(data.uncertaintyHighGW).toBeGreaterThan(data.peakGW);
    // T1a fallback is ±15%
    expect(data.uncertaintyHighGW).toBeCloseTo(data.peakGW * 1.15, 4);
    expect(data.uncertaintyLowGW).toBeCloseTo(data.peakGW * 0.85, 4);
  });
});
