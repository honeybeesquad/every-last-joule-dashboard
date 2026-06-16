import { describe, expect, it } from "vitest";
import { buildIndiaChhattisgarhData } from "../../src/data/india-chhattisgarh.json";

describe("india-chhattisgarh loader", () => {
  it("returns a valid positive RegionData shape with T3-modelled tier", async () => {
    const data = await buildIndiaChhattisgarhData();
    expect(data.regionId).toBe("india-chhattisgarh");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
    expect(data.confidenceTier).toBe("T3-modelled");
  });

  it("solar profile peaks around UTC 06-07 (Chhattisgarh ~81°E local noon)", async () => {
    const data = await buildIndiaChhattisgarhData();
    const peakHour = data.profile.indexOf(Math.max(...data.profile));
    expect(peakHour).toBeGreaterThanOrEqual(5);
    expect(peakHour).toBeLessThanOrEqual(8);
  });

  it("uncertainty bounds reflect ±40% T3 envelope", async () => {
    const data = await buildIndiaChhattisgarhData();
    expect(data.uncertaintyLowGW).toBeGreaterThan(0);
    expect(data.uncertaintyHighGW).toBeGreaterThan(data.peakGW);
    expect(data.uncertaintyHighGW).toBeCloseTo(data.peakGW * 1.40, 4);
    expect(data.uncertaintyLowGW).toBeCloseTo(data.peakGW * 0.60, 4);
  });
});
