import { describe, expect, it } from "vitest";
import { buildGansuData } from "../../src/data/gansu.json";

describe("gansu loader", () => {
  it("returns per-fuel fallback data with wind and solar entries", async () => {
    const data = await buildGansuData();
    expect(data.wind.regionId).toBe("gansu-wind");
    expect(data.solar.regionId).toBe("gansu-solar");
    expect(data.wind.profile).toHaveLength(24);
    expect(data.solar.profile).toHaveLength(24);
    expect(data.wind.totalTWh).toBeCloseTo(0.286685, 4);
    expect(data.wind.confidenceTier).toBe("T3-modelled");
    expect(data.wind.sourceProvenance).toBe("modelled-fallback");
    expect(data.wind.sourceStatus).toBe("cached");
    expect(data.solar.totalTWh).toBeCloseTo(0.303452, 4);
    expect(data.solar.confidenceTier).toBe("T3-modelled");
    expect(data.solar.sourceProvenance).toBe("modelled-fallback");
    expect(data.solar.sourceStatus).toBe("cached");
  });
});
