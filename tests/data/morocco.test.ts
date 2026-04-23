import { describe, expect, it } from "vitest";
import { buildMoroccoData } from "../../src/data/morocco.json";

describe("morocco (ANRE fallback)", () => {
  it("returns RegionData with a wind-dominant fuelShare", async () => {
    const d = await buildMoroccoData();
    expect(d.regionId).toBe("morocco");
    expect(d.profile).toHaveLength(24);
    expect(d.totalTWh).toBeGreaterThan(0);
    expect(d.fuelShare?.wind).toBeCloseTo(0.7, 2);
    expect(d.fuelShare?.solar).toBeCloseTo(0.3, 2);
  });
});
