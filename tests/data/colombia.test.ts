import { describe, expect, it } from "vitest";
import { buildColombiaData } from "../../src/data/colombia.json";

describe("colombia loader", () => {
  it("returns a valid positive RegionData shape with T1b tier", async () => {
    const data = await buildColombiaData();
    expect(data.regionId).toBe("colombia");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
    expect(data.confidenceTier).toBe("T1b-live-domestic-anchored");
  });

  it("hydro profile is flat within any 24h window (diurnal shape lives at monthly scale)", async () => {
    const data = await buildColombiaData();
    const first = data.profile[0];
    for (const v of data.profile) expect(v).toBeCloseTo(first, 10);
  });

  it("peakGW is in the plausible hydro-spillage range for Colombia (0.06–3 GW)", async () => {
    const data = await buildColombiaData();
    // peakGW = flat hydro GW = annualTWh * seasonalFactor * 1000/8760.
    // ENSO range 0.53–13.12 TWh/yr; extreme La Niña can push above baseline.
    expect(data.peakGW).toBeGreaterThan(0.06);
    expect(data.peakGW).toBeLessThan(3.0);
  });

  it("uncertainty bounds reflect ±50% T1b envelope", async () => {
    const data = await buildColombiaData();
    expect(data.uncertaintyLowGW).toBeGreaterThanOrEqual(0);
    expect(data.uncertaintyHighGW).toBeGreaterThan(data.peakGW);
    expect(data.uncertaintyHighGW).toBeCloseTo(data.peakGW * 1.5, 4);
  });
});
