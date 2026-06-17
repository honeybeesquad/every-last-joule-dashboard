import { describe, expect, it } from "vitest";
import { buildMexicoData } from "../../src/data/mexico.json";

describe("mexico loader", () => {
  it("returns per-fuel solar + wind T3 RegionData (no fabricated feed)", async () => {
    const data = await buildMexicoData();
    for (const [fuel, id] of [
      ["solar", "mexico-solar"],
      ["wind", "mexico-wind"],
    ] as const) {
      const r = data[fuel];
      expect(r.regionId).toBe(id);
      expect(r.profile).toHaveLength(24);
      expect(r.latestProfile).toBeNull();
      expect(r.totalTWh).toBeGreaterThan(0);
      expect(r.peakGW).toBeGreaterThan(0);
      expect(r.confidenceTier).toBe("T3-modelled");
    }
    // Solar is the larger share of the ~1.2 TWh anchor (0.8 vs 0.4 wind).
    expect(data.solar.totalTWh).toBeGreaterThan(data.wind.totalTWh);
  });
});
