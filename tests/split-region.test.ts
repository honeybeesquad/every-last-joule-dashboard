import { describe, expect, it } from "vitest";
import { splitRegion } from "../src/lib/split-region";
import type { RegionData } from "../src/lib/types";

describe("splitRegion", () => {
  it("propagates observedStdGW proportionally and keeps empirical T1 bounds", () => {
    const parent: RegionData = {
      regionId: "parent",
      profile: new Array(24).fill(10),
      latestProfile: new Array(24).fill(10),
      totalTWh: 30,
      peakGW: 10,
      lastUpdated: "2026-04-25T00:00:00.000Z",
      lastSuccessAt: "2026-04-25T00:00:00.000Z",
      confidenceTier: "T1-live-TSO",
      observedStdGW: 1.5,
      uncertaintyLowGW: 7,
      uncertaintyHighGW: 13,
    };

    const child1 = splitRegion(parent, "child-1", 0.6, "60% split");
    const child2 = splitRegion(parent, "child-2", 0.4, "40% split");

    expect(child1.peakGW).toBeCloseTo(6, 12);
    expect(child2.peakGW).toBeCloseTo(4, 12);
    expect(child1.observedStdGW).toBeCloseTo(0.9, 12);
    expect(child2.observedStdGW).toBeCloseTo(0.6, 12);

    expect(child1.uncertaintyHighGW).toBeCloseTo(7.8, 12);
    expect(child2.uncertaintyHighGW).toBeCloseTo(5.2, 12);
    expect(child1.uncertaintyHighGW).not.toBeCloseTo(6.9, 12);
    expect(child2.uncertaintyHighGW).not.toBeCloseTo(4.6, 12);
  });

  it("uses canonical child provenance when available and otherwise preserves parent provenance", () => {
    const parent: RegionData = {
      regionId: "parent",
      profile: new Array(24).fill(10),
      latestProfile: new Array(24).fill(10),
      totalTWh: 30,
      peakGW: 10,
      lastUpdated: "2026-04-25T00:00:00.000Z",
      lastSuccessAt: "2026-04-25T00:00:00.000Z",
      sourceProvenance: "modelled-fallback",
    };

    expect(splitRegion(parent, "nyiso-zones-d-e", 0.6, "60% split").sourceProvenance).toBe("verified");
    expect(splitRegion(parent, "child-1", 0.4, "40% split").sourceProvenance).toBe("modelled-fallback");
  });
});
