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
});
