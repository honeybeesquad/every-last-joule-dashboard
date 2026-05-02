import { describe, expect, it } from "vitest";
import { buildIndiaGujaratData } from "../../src/data/india-gujarat.json";

describe("india-gujarat loader", () => {
  it("returns a valid positive RegionData shape with T1a tier", async () => {
    const data = await buildIndiaGujaratData();
    expect(data.regionId).toBe("india-gujarat");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
    expect(data.confidenceTier).toBe("T1a-live-tso");
  });

  it("solar profile peaks around UTC 06-07 (Gujarat ~70°E local noon)", async () => {
    const data = await buildIndiaGujaratData();
    const peakHour = data.profile.indexOf(Math.max(...data.profile));
    expect(peakHour).toBeGreaterThanOrEqual(5);
    expect(peakHour).toBeLessThanOrEqual(8);
  });

  it("uncertainty bounds reflect ±15% T1a envelope", async () => {
    const data = await buildIndiaGujaratData();
    expect(data.uncertaintyLowGW).toBeGreaterThan(0);
    expect(data.uncertaintyHighGW).toBeGreaterThan(data.peakGW);
    expect(data.uncertaintyHighGW).toBeCloseTo(data.peakGW * 1.15, 4);
    expect(data.uncertaintyLowGW).toBeCloseTo(data.peakGW * 0.85, 4);
  });
});
