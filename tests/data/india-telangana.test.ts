import { describe, expect, it } from "vitest";
import { buildIndiaTelanganaData } from "../../src/data/india-telangana.json";

describe("india-telangana loader", () => {
  it("returns a valid positive RegionData shape with T3-modelled tier", async () => {
    const data = await buildIndiaTelanganaData();
    expect(data.regionId).toBe("india-telangana");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
    expect(data.confidenceTier).toBe("T3-modelled");
  });

  it("mixed profile has solar + wind components", async () => {
    const data = await buildIndiaTelanganaData();
    expect(data.fuelShare).toBeDefined();
    if (data.fuelShare) {
      expect(data.fuelShare.solar).toBeGreaterThan(0);
      expect(data.fuelShare.wind).toBeGreaterThan(0);
    }
  });

  it("uncertainty bounds reflect ±40% T3 envelope", async () => {
    const data = await buildIndiaTelanganaData();
    expect(data.uncertaintyLowGW).toBeGreaterThan(0);
    expect(data.uncertaintyHighGW).toBeGreaterThan(data.peakGW);
    expect(data.uncertaintyHighGW).toBeCloseTo(data.peakGW * 1.40, 4);
    expect(data.uncertaintyLowGW).toBeCloseTo(data.peakGW * 0.60, 4);
  });
});
