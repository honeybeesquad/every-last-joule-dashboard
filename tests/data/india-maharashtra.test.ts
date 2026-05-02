import { describe, expect, it } from "vitest";
import { buildIndiaMaharashtraData } from "../../src/data/india-maharashtra.json";

describe("india-maharashtra loader", () => {
  it("returns a valid positive RegionData shape with T1a tier", async () => {
    const data = await buildIndiaMaharashtraData();
    expect(data.regionId).toBe("india-maharashtra");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
    expect(data.confidenceTier).toBe("T1a-live-tso");
  });

  it("uncertainty bounds reflect ±15% T1a envelope", async () => {
    const data = await buildIndiaMaharashtraData();
    expect(data.uncertaintyLowGW).toBeGreaterThan(0);
    expect(data.uncertaintyHighGW).toBeGreaterThan(data.peakGW);
    expect(data.uncertaintyHighGW).toBeCloseTo(data.peakGW * 1.15, 4);
    expect(data.uncertaintyLowGW).toBeCloseTo(data.peakGW * 0.85, 4);
  });

  it("mixed profile has non-zero values across most hours (wind+solar blend)", async () => {
    const data = await buildIndiaMaharashtraData();
    const nonZeroHours = data.profile.filter((v) => v > 0).length;
    expect(nonZeroHours).toBeGreaterThan(18);
  });
});
