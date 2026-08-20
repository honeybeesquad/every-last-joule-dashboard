import { describe, expect, it } from "vitest";
import { buildNingxiaData } from "../../src/data/ningxia.json";

describe("ningxia loader", () => {
  it("returns per-fuel fallback data with wind and solar entries", async () => {
    const data = await buildNingxiaData();
    expect(data.wind.regionId).toBe("ningxia-wind");
    expect(data.solar.regionId).toBe("ningxia-solar");
    expect(data.wind.profile).toHaveLength(24);
    expect(data.solar.profile).toHaveLength(24);
    expect(data.wind.totalTWh).toBeCloseTo(0.062466, 4);
    expect(data.wind.confidenceTier).toBe("T3-modelled");
    expect(data.wind.sourceProvenance).toBe("modelled-fallback");
    expect(data.wind.sourceStatus).toBe("cached");
    expect(data.solar.totalTWh).toBeCloseTo(0.191836, 4);
    expect(data.solar.confidenceTier).toBe("T3-modelled");
    expect(data.solar.sourceProvenance).toBe("modelled-fallback");
    expect(data.solar.sourceStatus).toBe("cached");
  });
});
