import { describe, expect, it } from "vitest";
import { buildMalaysiaData, gsoSolarToCurtailmentPoints } from "../../src/data/malaysia.json";
import { totalTWh30d } from "../../src/lib/profile.js";

describe("malaysia loader", () => {
  it("returns a valid positive RegionData shape", async () => {
    const data = await buildMalaysiaData();
    expect(data.regionId).toBe("malaysia");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
  });

  it("tags 10-min points with intervalHours 1/6 so totalTWh is not 6x inflated", () => {
    // One hour of 10-min samples (6 points), each 600 MW solar → 6 MW curtailed (×1%).
    const gen = Array.from({ length: 6 }, (_, i) => ({
      DT: `2026-06-18T00:${String(i * 10).padStart(2, "0")}:00`,
      Coal: 0, Gas: 0, CoGen: 0, Oil: 0, Hydro: 0, Solar: 600,
    }));
    const points = gsoSolarToCurtailmentPoints(gen as any);
    expect(points).toHaveLength(6);
    for (const p of points) expect(p.intervalHours).toBeCloseTo(1 / 6, 12);
    // 6 MW held for one hour = 6 MWh = 6e-6 TWh. Pre-fix (1h/point) gave 36e-6.
    expect(totalTWh30d(points)).toBeCloseTo(6e-6, 12);
  });
});
