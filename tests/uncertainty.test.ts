import { describe, it, expect } from "vitest";
import {
  deriveTier,
  computeBounds,
  applyUncertainty,
  TIER_DEFAULT_FRACTION,
  TIER_LABEL,
} from "../src/lib/uncertainty";
import type { RegionData } from "../src/lib/types";

describe("uncertainty.deriveTier", () => {
  it("maps live → T1a-live-tso (own-jurisdiction TSO rate)", () => {
    expect(deriveTier({ regionTier: "live" })).toBe("T1a-live-tso");
  });

  it("maps live-domestic-anchored → T1b-live-domestic-anchored", () => {
    expect(deriveTier({ regionTier: "live-domestic-anchored" })).toBe(
      "T1b-live-domestic-anchored",
    );
  });

  it("maps live-neighbour-anchored → T1c-live-neighbour-anchored", () => {
    expect(deriveTier({ regionTier: "live-neighbour-anchored" })).toBe(
      "T1c-live-neighbour-anchored",
    );
  });

  it("maps flare → T2-annual-calibrated", () => {
    expect(deriveTier({ regionTier: "flare" })).toBe("T2-annual-calibrated");
  });

  it("maps static + flat → T2-annual-calibrated", () => {
    expect(
      deriveTier({ regionTier: "static", profileKind: "flat" }),
    ).toBe("T2-annual-calibrated");
  });

  it("maps static + solar → T3-modelled", () => {
    expect(
      deriveTier({ regionTier: "static", profileKind: "solar" }),
    ).toBe("T3-modelled");
  });

  it("maps static + hydro-seasonal → T3-modelled", () => {
    expect(
      deriveTier({ regionTier: "static", profileKind: "hydro-seasonal" }),
    ).toBe("T3-modelled");
  });

  it("maps static (no kind specified) → T2 (treated as flat)", () => {
    expect(deriveTier({ regionTier: "static" })).toBe("T2-annual-calibrated");
  });
});

describe("uncertainty.computeBounds", () => {
  it("T1a without observed std falls back to ±15%", () => {
    const { uncertaintyLowGW, uncertaintyHighGW } = computeBounds(10, "T1a-live-tso");
    expect(uncertaintyLowGW).toBeCloseTo(8.5, 5);
    expect(uncertaintyHighGW).toBeCloseTo(11.5, 5);
  });

  it("T1a with observed std uses 2σ", () => {
    const { uncertaintyLowGW, uncertaintyHighGW } = computeBounds(10, "T1a-live-tso", 0.5);
    expect(uncertaintyLowGW).toBeCloseTo(9, 5);
    expect(uncertaintyHighGW).toBeCloseTo(11, 5);
  });

  it("legacy T1-live-TSO label still falls back to ±15% (alias for T1a)", () => {
    const { uncertaintyLowGW, uncertaintyHighGW } = computeBounds(10, "T1-live-TSO");
    expect(uncertaintyLowGW).toBeCloseTo(8.5, 5);
    expect(uncertaintyHighGW).toBeCloseTo(11.5, 5);
  });

  it("legacy T1-live-TSO with observed std uses 2σ (alias for T1a)", () => {
    const { uncertaintyLowGW, uncertaintyHighGW } = computeBounds(10, "T1-live-TSO", 0.5);
    expect(uncertaintyLowGW).toBeCloseTo(9, 5);
    expect(uncertaintyHighGW).toBeCloseTo(11, 5);
  });

  it("T1b uses empirical ±50% even when observedStdGW is provided", () => {
    // T1b regions have systematic anchor-scope offset that 2σ does not
    // capture; the empirical fractional envelope is preferred.
    const { uncertaintyLowGW, uncertaintyHighGW } = computeBounds(
      10,
      "T1b-live-domestic-anchored",
      0.1,
    );
    expect(uncertaintyLowGW).toBeCloseTo(5, 5);
    expect(uncertaintyHighGW).toBeCloseTo(15, 5);
  });

  it("T1c uses empirical ±35.5% even when observedStdGW is provided", () => {
    const { uncertaintyLowGW, uncertaintyHighGW } = computeBounds(
      10,
      "T1c-live-neighbour-anchored",
      0.1,
    );
    expect(uncertaintyLowGW).toBeCloseTo(6.45, 5);
    expect(uncertaintyHighGW).toBeCloseTo(13.55, 5);
  });

  it("T2 uses ±20%", () => {
    const { uncertaintyLowGW, uncertaintyHighGW } = computeBounds(10, "T2-annual-calibrated");
    expect(uncertaintyLowGW).toBeCloseTo(8, 5);
    expect(uncertaintyHighGW).toBeCloseTo(12, 5);
  });

  it("T3 uses ±40%", () => {
    const { uncertaintyLowGW, uncertaintyHighGW } = computeBounds(10, "T3-modelled");
    expect(uncertaintyLowGW).toBeCloseTo(6, 5);
    expect(uncertaintyHighGW).toBeCloseTo(14, 5);
  });

  it("lower bound clamped to 0 when 2σ exceeds peak for T1a", () => {
    // Realistic scenario: noisy small-signal region where backfill σ > peak/2
    const { uncertaintyLowGW, uncertaintyHighGW } = computeBounds(0.5, "T1a-live-tso", 1.0);
    expect(uncertaintyLowGW).toBe(0);
    expect(uncertaintyHighGW).toBeCloseTo(2.5, 5);
  });

  it("T1b on a small-signal region still uses the 50% envelope (no 2σ shortcut)", () => {
    // At 0.5 GW, ±50% → low 0.25, high 0.75. The 2σ branch must not fire
    // for T1b even when observedStdGW is supplied.
    const { uncertaintyLowGW, uncertaintyHighGW } = computeBounds(
      0.5,
      "T1b-live-domestic-anchored",
      0.01,
    );
    expect(uncertaintyLowGW).toBeCloseTo(0.25, 5);
    expect(uncertaintyHighGW).toBeCloseTo(0.75, 5);
  });

  it("handles peakGW = 0 safely", () => {
    const { uncertaintyLowGW, uncertaintyHighGW } = computeBounds(0, "T2-annual-calibrated");
    expect(uncertaintyLowGW).toBe(0);
    expect(uncertaintyHighGW).toBe(0);
  });

  it("T4 returns zero envelope", () => {
    const { uncertaintyLowGW, uncertaintyHighGW } = computeBounds(5, "T4-structural-gap");
    expect(uncertaintyLowGW).toBe(0);
    expect(uncertaintyHighGW).toBe(0);
  });

  it("upper bound is always ≥ peak even on degenerate input", () => {
    const { uncertaintyHighGW } = computeBounds(1, "T1a-live-tso", 0);
    expect(uncertaintyHighGW).toBeGreaterThanOrEqual(1);
  });
});

describe("uncertainty.applyUncertainty", () => {
  const base: RegionData = {
    regionId: "test-region",
    profile: new Array(24).fill(0.5).map((_, h) => (h === 12 ? 2 : 0.5)),
    latestProfile: null,
    totalTWh: 4.5,
    peakGW: 2,
    lastUpdated: "2024-12",
    lastSuccessAt: "2024-12-01T00:00:00.000Z",
  };

  it("enriches a RegionData with tier + bounds", () => {
    const out = applyUncertainty(base, { regionTier: "static", profileKind: "solar" });
    expect(out.confidenceTier).toBe("T3-modelled");
    expect(out.uncertaintyLowGW).toBeCloseTo(1.2, 5); // 2 * 0.6
    expect(out.uncertaintyHighGW).toBeCloseTo(2.8, 5); // 2 * 1.4
    // Pure — doesn't mutate original
    expect(base.confidenceTier).toBeUndefined();
  });

  it("preserves all original fields", () => {
    const out = applyUncertainty(base, { regionTier: "static", profileKind: "flat" });
    expect(out.regionId).toBe("test-region");
    expect(out.peakGW).toBe(2);
    expect(out.totalTWh).toBe(4.5);
    expect(out.profile).toEqual(base.profile);
  });
});

describe("uncertainty.TIER_LABEL", () => {
  it("has a label for every tier", () => {
    for (const tier of Object.keys(TIER_DEFAULT_FRACTION)) {
      expect(TIER_LABEL[tier as keyof typeof TIER_LABEL]).toBeDefined();
      expect(TIER_LABEL[tier as keyof typeof TIER_LABEL].length).toBeGreaterThan(0);
    }
  });
});
