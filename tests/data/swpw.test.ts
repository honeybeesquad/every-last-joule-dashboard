import { describe, it, expect } from "vitest";
import { unpublishedFallback } from "../../src/data/swpw.json";

const gen = (regionId: string) => ({
  regionId,
  profile: Array(24).fill(0),
  latestProfile: null,
  totalTWh: 0,
  peakGW: 0,
  lastUpdated: "2026-11-20T00:00:00.000Z",
  lastSuccessAt: "2026-11-20T00:00:00.000Z",
  sourceNote: "EIA-930 SWPW",
  generationProfile: Array(24).fill(0.3),
  generationTotalTWh: 0.2,
});

describe("SWPW fallback when the SPP report is unavailable", () => {
  it("keeps EIA-930 generation and marks waste unpublished, never measured zero", () => {
    const r = unpublishedFallback({ wind: gen("swpw-wind"), solar: gen("swpw-solar") }, "HTTP 403");
    for (const fuel of ["wind", "solar"] as const) {
      expect(r[fuel].regionId).toBe(`swpw-${fuel}`);
      expect(r[fuel].wasteStatus).toBe("unpublished");
      expect(r[fuel].generationTotalTWh).toBe(0.2);
      expect(r[fuel].sourceNote).toMatch(/report unavailable this build \(HTTP 403\)/);
      expect(r[fuel].sourceNote).toMatch(/missing ≠ zero/);
    }
  });

  it("serves empty unpublished regions when EIA-930 also failed", () => {
    const r = unpublishedFallback(null, "timeout");
    expect(r.wind.regionId).toBe("swpw-wind");
    expect(r.solar.regionId).toBe("swpw-solar");
    expect(r.wind.wasteStatus).toBe("unpublished");
    expect(r.solar.totalTWh).toBe(0);
  });
});
