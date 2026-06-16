import { describe, expect, it } from "vitest";
import { buildIndiaMadhyaPradeshData } from "../../src/data/india-madhya-pradesh.json";

describe("india-madhya-pradesh loader", () => {
  it("returns a valid positive RegionData shape with T3-modelled tier", async () => {
    const data = await buildIndiaMadhyaPradeshData();
    expect(data.regionId).toBe("india-madhya-pradesh");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
    expect(data.confidenceTier).toBe("T3-modelled");
  });

  it("solar profile peaks around UTC 06-07 (Madhya Pradesh ~78°E local noon)", async () => {
    const data = await buildIndiaMadhyaPradeshData();
    const peakHour = data.profile.indexOf(Math.max(...data.profile));
    expect(peakHour).toBeGreaterThanOrEqual(5);
    expect(peakHour).toBeLessThanOrEqual(8);
  });

  it("uncertainty bounds reflect ±40% T3 envelope", async () => {
    const data = await buildIndiaMadhyaPradeshData();
    expect(data.uncertaintyLowGW).toBeGreaterThan(0);
    expect(data.uncertaintyHighGW).toBeGreaterThan(data.peakGW);
    expect(data.uncertaintyHighGW).toBeCloseTo(data.peakGW * 1.40, 4);
    expect(data.uncertaintyLowGW).toBeCloseTo(data.peakGW * 0.60, 4);
  });
});
