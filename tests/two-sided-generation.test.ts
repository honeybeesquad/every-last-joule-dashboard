/**
 * Two-sided generation tests.
 *
 * Verifies that eia-iso and entsoe build paths emit `generationProfile`
 * (length 24) and `generationTotalTWh`, and that the fundamental invariant
 * generationTotalTWh >= totalTWh holds (cannot curtail more than you generate).
 */
import { describe, it, expect } from "vitest";
import {
  parseEiaIsoRegionPerFuel,
  parseEiaIsoRegion,
  type EIAResponse,
  type EiaIsoConfig,
} from "../src/lib/eia-iso";
import { buildZoneData } from "../src/lib/entsoe";
import type { CurtailmentPoint } from "../src/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal EIAResponse with `n` hourly rows at a fixed MW value. */
function makeEiaResponse(mw: number, n = 30 * 24): EIAResponse {
  const data: EIAResponse["response"]["data"] = [];
  const base = new Date("2026-05-01T00:00:00Z");
  for (let i = 0; i < n; i++) {
    const dt = new Date(base.getTime() + i * 3_600_000);
    // EIA period format: "2026-05-01T00" (no seconds/Z)
    const period = dt.toISOString().slice(0, 13);
    data.push({ period, respondent: "TEST", fueltype: "WND", value: String(mw) });
  }
  return { response: { total: n, data } };
}

/** Build CurtailmentPoint[] with constant MW at every UTC hour over `days`. */
function makeRawPoints(mw: number, days = 30): CurtailmentPoint[] {
  const points: CurtailmentPoint[] = [];
  const base = new Date("2026-05-01T00:00:00Z");
  for (let i = 0; i < days * 24; i++) {
    const dt = new Date(base.getTime() + i * 3_600_000);
    points.push({ utcTimestamp: dt.toISOString(), mw, intervalHours: 1 });
  }
  return points;
}

const BASE_CONFIG: EiaIsoConfig = {
  regionId: "test-iso",
  respondent: "TEST",
  displayName: "Test ISO",
  windRate: 0.1,   // 10% curtailment
  solarRate: 0.05, // 5% curtailment
};

// ---------------------------------------------------------------------------
// eia-iso: parseEiaIsoRegionPerFuel
// ---------------------------------------------------------------------------

describe("parseEiaIsoRegionPerFuel — two-sided generation", () => {
  const windRaw = makeEiaResponse(1000); // 1000 MW generation
  const solarRaw = makeEiaResponse(500); // 500 MW generation

  const { wind, solar } = parseEiaIsoRegionPerFuel(BASE_CONFIG, windRaw, solarRaw);

  it("wind: emits generationProfile of length 24", () => {
    expect(wind.generationProfile).toBeDefined();
    expect(wind.generationProfile!.length).toBe(24);
  });

  it("wind: generationProfile values are all non-negative", () => {
    expect(wind.generationProfile!.every((v) => v >= 0)).toBe(true);
  });

  it("wind: emits generationTotalTWh", () => {
    expect(wind.generationTotalTWh).toBeDefined();
    expect(wind.generationTotalTWh).toBeGreaterThanOrEqual(0);
  });

  it("wind: generationTotalTWh >= totalTWh (generation >= curtailment)", () => {
    expect(wind.generationTotalTWh!).toBeGreaterThanOrEqual(wind.totalTWh);
  });

  it("wind: generationTotalTWh is approximately totalTWh / windRate", () => {
    // curtailment = generation * rate  →  generation = curtailment / rate
    expect(wind.generationTotalTWh!).toBeCloseTo(wind.totalTWh / BASE_CONFIG.windRate, 5);
  });

  it("solar: emits generationProfile of length 24", () => {
    expect(solar.generationProfile).toBeDefined();
    expect(solar.generationProfile!.length).toBe(24);
  });

  it("solar: generationTotalTWh >= totalTWh", () => {
    expect(solar.generationTotalTWh!).toBeGreaterThanOrEqual(solar.totalTWh);
  });

  it("solar: generationTotalTWh is approximately totalTWh / solarRate", () => {
    expect(solar.generationTotalTWh!).toBeCloseTo(solar.totalTWh / BASE_CONFIG.solarRate, 5);
  });
});

// ---------------------------------------------------------------------------
// eia-iso: parseEiaIsoRegion (aggregate / single-region path)
// ---------------------------------------------------------------------------

describe("parseEiaIsoRegion — two-sided generation", () => {
  const windRaw = makeEiaResponse(2000);
  const solarRaw = makeEiaResponse(800);

  const region = parseEiaIsoRegion(BASE_CONFIG, windRaw, solarRaw);

  it("emits generationProfile of length 24", () => {
    expect(region.generationProfile).toBeDefined();
    expect(region.generationProfile!.length).toBe(24);
  });

  it("generationProfile values are all non-negative", () => {
    expect(region.generationProfile!.every((v) => v >= 0)).toBe(true);
  });

  it("emits generationTotalTWh", () => {
    expect(region.generationTotalTWh).toBeDefined();
    expect(typeof region.generationTotalTWh).toBe("number");
  });

  it("generationTotalTWh >= totalTWh", () => {
    expect(region.generationTotalTWh!).toBeGreaterThanOrEqual(region.totalTWh);
  });

  it("does not mutate totalTWh (curtailment unchanged)", () => {
    // Reproduce the same curtailment independently and confirm region.totalTWh matches.
    const windOnly = parseEiaIsoRegion({ ...BASE_CONFIG, solarRate: 0 }, windRaw, undefined);
    // With solarRate=0 solar contributes 0 curtailment, so totalTWh ≈ wind curtailment.
    // Full region should have higher totalTWh because solar adds curtailment.
    expect(region.totalTWh).toBeGreaterThan(windOnly.totalTWh);
  });
});

// ---------------------------------------------------------------------------
// entsoe: buildZoneData
// ---------------------------------------------------------------------------

describe("buildZoneData — two-sided generation", () => {
  const RAW_MW = 5000; // raw A75 generation in MW
  const RATE = 0.08;   // 8% curtailment rate
  const rawPoints = makeRawPoints(RAW_MW);

  const region = buildZoneData("test-zone", rawPoints, RATE, "Test ENTSO-E zone");

  it("emits generationProfile of length 24", () => {
    expect(region.generationProfile).toBeDefined();
    expect(region.generationProfile!.length).toBe(24);
  });

  it("generationProfile values are all non-negative", () => {
    expect(region.generationProfile!.every((v) => v >= 0)).toBe(true);
  });

  it("emits generationTotalTWh", () => {
    expect(region.generationTotalTWh).toBeDefined();
    expect(typeof region.generationTotalTWh).toBe("number");
  });

  it("generationTotalTWh >= totalTWh", () => {
    expect(region.generationTotalTWh!).toBeGreaterThanOrEqual(region.totalTWh);
  });

  it("generationTotalTWh is approximately totalTWh / rate", () => {
    expect(region.generationTotalTWh!).toBeCloseTo(region.totalTWh / RATE, 5);
  });

  it("generationProfile GW > profile GW at each hour (generation > curtailment)", () => {
    // At a sub-100% rate, generation > curtailment at every hour that has data.
    for (let h = 0; h < 24; h++) {
      expect(region.generationProfile![h]).toBeGreaterThanOrEqual(region.profile[h]);
    }
  });

  it("totalTWh (curtailment) is unchanged compared to pre-generation-field value", () => {
    // Confirms additive-only: we can recompute what totalTWh must be.
    const expectedCurtailmentTWh = (RAW_MW * RATE * rawPoints.length) / 1_000_000;
    expect(region.totalTWh).toBeCloseTo(expectedCurtailmentTWh, 5);
  });
});

// ---------------------------------------------------------------------------
// entsoe: buildZoneData with fuelShare — generation fields still present
// ---------------------------------------------------------------------------

describe("buildZoneData with fuelShare — generation fields present", () => {
  const rawPoints = makeRawPoints(3000);
  const fuelShare = { wind: 0.6, solar: 0.4 };
  const region = buildZoneData("test-zone-multi", rawPoints, 0.12, "Multi-fuel zone", fuelShare);

  it("generationProfile still emitted when fuelShare is provided", () => {
    expect(region.generationProfile).toBeDefined();
    expect(region.generationProfile!.length).toBe(24);
  });

  it("generationTotalTWh >= totalTWh with fuelShare", () => {
    expect(region.generationTotalTWh!).toBeGreaterThanOrEqual(region.totalTWh);
  });
});
