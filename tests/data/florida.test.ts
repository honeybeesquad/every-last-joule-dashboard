import { describe, expect, it } from "vitest";
import { buildFloridaData } from "../../src/data/florida.json";

describe("florida loader", () => {
  it("returns a conservative T3 solar-shaped fallback", () => {
    const data = buildFloridaData();
    expect(data.regionId).toBe("florida");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.confidenceTier).toBe("T3-modelled");
    expect(data.totalTWh).toBeCloseTo((0.5 * 30) / 365, 8);
    expect(data.peakGW).toBeGreaterThan(0);
    expect(Math.min(...data.profile)).toBeCloseTo(0, 8);
  });

  it("produces a non-flat diurnal solar shape peaking near UTC 17", () => {
    const data = buildFloridaData();
    const peakIdx = data.profile.indexOf(Math.max(...data.profile));
    // Florida lon −81.2°E → localSolarPeakUTC ≈ 17; allow ±1h rounding.
    expect(peakIdx).toBeGreaterThanOrEqual(16);
    expect(peakIdx).toBeLessThanOrEqual(18);
    // Solar profile must be non-flat (max > 2× average).
    const avg = data.profile.reduce((a, b) => a + b, 0) / 24;
    expect(Math.max(...data.profile)).toBeGreaterThan(avg * 2);
  });
});
