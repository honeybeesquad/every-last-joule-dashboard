import { describe, expect, it } from "vitest";
import { buildPhilippinesData } from "../../src/data/philippines.json";

describe("philippines loader", () => {
  it("emits a non-flat daylight solar-shaped T3 fallback", () => {
    const data = buildPhilippinesData();
    expect(data.regionId).toBe("philippines");
    expect(data.confidenceTier).toBe("T3-modelled");
    expect(data.totalTWh).toBeCloseTo((0.5 * 30) / 365, 8);
    expect(data.profile).toHaveLength(24);
    expect(Math.max(...data.profile)).toBeGreaterThan(0);
    expect(Math.min(...data.profile)).toBeCloseTo(0, 8);
    expect(data.profile.indexOf(Math.max(...data.profile))).toBeGreaterThanOrEqual(3);
    expect(data.profile.indexOf(Math.max(...data.profile))).toBeLessThanOrEqual(4);
  });
});
