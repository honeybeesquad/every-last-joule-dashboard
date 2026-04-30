import { describe, expect, it } from "vitest";
import { buildPhilippinesData } from "../../src/data/philippines.json";

describe("philippines loader (fuel-split)", () => {
  it("emits two regions: philippines-solar and philippines-wind", () => {
    const data = buildPhilippinesData();
    expect(data["philippines-solar"]).toBeDefined();
    expect(data["philippines-wind"]).toBeDefined();
    expect(data["philippines"]).toBeUndefined();
  });

  it("solar region is T3 solar-shaped, peaking near UTC 4 (local noon UTC+8)", () => {
    const solar = buildPhilippinesData()["philippines-solar"];
    expect(solar.regionId).toBe("philippines-solar");
    expect(solar.confidenceTier).toBe("T3-modelled");
    expect(solar.profile).toHaveLength(24);
    expect(Math.max(...solar.profile)).toBeGreaterThan(0);
    expect(Math.min(...solar.profile)).toBeCloseTo(0, 8);
    const peakIdx = solar.profile.indexOf(Math.max(...solar.profile));
    expect(peakIdx).toBeGreaterThanOrEqual(3);
    expect(peakIdx).toBeLessThanOrEqual(5);
  });

  it("wind region is T3 with a non-zero profile", () => {
    const wind = buildPhilippinesData()["philippines-wind"];
    expect(wind.regionId).toBe("philippines-wind");
    expect(wind.confidenceTier).toBe("T3-modelled");
    expect(wind.profile).toHaveLength(24);
    expect(wind.peakGW).toBeGreaterThan(0);
  });

  it("anchors are conservative: solar ~0.04 TWh/yr, wind ~0.02 TWh/yr", () => {
    const data = buildPhilippinesData();
    expect(data["philippines-solar"].totalTWh).toBeCloseTo((0.04 * 30) / 365, 8);
    expect(data["philippines-wind"].totalTWh).toBeCloseTo((0.02 * 30) / 365, 8);
  });
});
