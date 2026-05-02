import { describe, expect, it } from "vitest";
import { buildIndiaTamilNaduData } from "../../src/data/india-tamil-nadu.json";

describe("india-tamil-nadu loader", () => {
  it("returns a valid positive RegionData shape with T1a tier", async () => {
    const data = await buildIndiaTamilNaduData();
    expect(data.regionId).toBe("india-tamil-nadu");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
    expect(data.confidenceTier).toBe("T1a-live-tso");
  });

  it("wind profile is relatively flat with diurnal variation (peak UTC 08-10)", async () => {
    const data = await buildIndiaTamilNaduData();
    const peakHour = data.profile.indexOf(Math.max(...data.profile));
    expect(peakHour).toBeGreaterThanOrEqual(7);
    expect(peakHour).toBeLessThanOrEqual(11);
    // Wind profiles are much flatter than solar — min should be at least 60% of peak
    const minVal = Math.min(...data.profile);
    expect(minVal).toBeGreaterThan(data.peakGW * 0.6);
  });

  it("uncertainty bounds reflect ±15% T1a envelope", async () => {
    const data = await buildIndiaTamilNaduData();
    expect(data.uncertaintyLowGW).toBeGreaterThan(0);
    expect(data.uncertaintyHighGW).toBeGreaterThan(data.peakGW);
    expect(data.uncertaintyHighGW).toBeCloseTo(data.peakGW * 1.15, 4);
    expect(data.uncertaintyLowGW).toBeCloseTo(data.peakGW * 0.85, 4);
  });
});
