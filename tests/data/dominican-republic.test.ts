import { describe, expect, it } from "vitest";
import { buildDominicanRepublicData } from "../../src/data/dominican-republic.json";

describe("dominican republic loader", () => {
  it("returns a conservative T3 solar-shaped fallback", () => {
    const data = buildDominicanRepublicData();
    expect(data.regionId).toBe("dominican-republic");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.confidenceTier).toBe("T3-modelled");
    expect(data.totalTWh).toBeCloseTo((0.5 * 30) / 365, 8);
    expect(data.peakGW).toBeGreaterThan(0);
    expect(Math.min(...data.profile)).toBeCloseTo(0, 8);
  });
});
