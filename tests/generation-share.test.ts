/**
 * The circularity guard.
 *
 * Most loaders compute curtailment as `generation x rate`. For those,
 * `totalTWh / generationTotalTWh` is identically the rate constant — an input,
 * not an observation. Several of them DO emit generation (eia-iso, entsoe,
 * peru-per-plant have since v1.0.0), so "both fields present" must never be
 * sufficient grounds to publish a share.
 *
 * These tests pin that: the share gate is `generationBasis`, the derived build
 * paths declare themselves derived, and a derived record yields no share even
 * though the arithmetic would happily produce one.
 */
import { describe, expect, it } from "vitest";
import {
  curtailmentShare,
  formatShare,
  hasIndependentGeneration,
  shareUnavailable,
} from "../src/lib/generation-share";
import { parseEiaIsoRegion, parseEiaIsoRegionPerFuel, type EIAResponse, type EiaIsoConfig } from "../src/lib/eia-iso";
import { buildZoneData } from "../src/lib/entsoe";
import type { CurtailmentPoint, Region, RegionData } from "../src/lib/types";

const REGION: Region = {
  id: "test-region",
  name: "Test",
  country: "TST",
  lat: 0,
  lon: 0,
  tier: "live",
  kind: "wind",
  source: "test",
  sourceUrl: "https://example.invalid",
};

const ESTIMATED_REGION: Region = { ...REGION, tier: "estimated" };

function record(over: Partial<RegionData>): RegionData {
  return {
    regionId: "test-region",
    profile: new Array(24).fill(0.1),
    latestProfile: null,
    totalTWh: 1,
    peakGW: 0.1,
    lastUpdated: "2026-09-01T00:00:00.000Z",
    lastSuccessAt: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

describe("curtailmentShare — the gate", () => {
  it("computes a share when the basis is measured-independent", () => {
    const share = curtailmentShare(
      record({ totalTWh: 2, generationTotalTWh: 50, generationBasis: "measured-independent" }),
    );
    expect(share).toBeCloseTo(0.04, 12);
  });

  it("REFUSES a share when curtailment was derived from that same generation", () => {
    // The arithmetic is available and would return 0.1 — the rate. That is the
    // number this repo must not publish as an observation.
    const derived = record({
      totalTWh: 5,
      generationTotalTWh: 50,
      generationBasis: "derived-from-generation",
    });
    expect(derived.totalTWh / derived.generationTotalTWh!).toBeCloseTo(0.1, 12);
    expect(curtailmentShare(derived)).toBeNull();
  });

  it("refuses a share when the magnitude is an annual anchor, not a measurement", () => {
    expect(
      curtailmentShare(record({ totalTWh: 1, generationTotalTWh: 20, generationBasis: "anchor-implied" })),
    ).toBeNull();
  });

  it("refuses when no basis is declared, even with both fields present", () => {
    expect(curtailmentShare(record({ totalTWh: 1, generationTotalTWh: 20 }))).toBeNull();
  });

  it("refuses on a missing, zero or negative denominator", () => {
    const base = { totalTWh: 1, generationBasis: "measured-independent" as const };
    expect(curtailmentShare(record(base))).toBeNull();
    expect(curtailmentShare(record({ ...base, generationTotalTWh: 0 }))).toBeNull();
    expect(curtailmentShare(record({ ...base, generationTotalTWh: -3 }))).toBeNull();
    expect(curtailmentShare(record({ ...base, generationTotalTWh: Number.NaN }))).toBeNull();
  });

  it("withholds rather than reporting >100% when the schema invariant is violated", () => {
    expect(
      curtailmentShare(
        record({ totalTWh: 9, generationTotalTWh: 4, generationBasis: "measured-independent" }),
      ),
    ).toBeNull();
  });

  it("returns null, never 0, for an absent record — zero share and no share differ", () => {
    expect(curtailmentShare(undefined)).toBeNull();
    expect(curtailmentShare(null)).toBeNull();
  });

  it("does report a genuine measured zero as 0, distinct from null", () => {
    expect(
      curtailmentShare(
        record({ totalTWh: 0, generationTotalTWh: 12, generationBasis: "measured-independent" }),
      ),
    ).toBe(0);
  });
});

describe("shareUnavailable — every reason is derived from declared fields", () => {
  it("names circularity for a derived record", () => {
    const why = shareUnavailable(REGION, record({ generationBasis: "derived-from-generation" }));
    expect(why.code).toBe("circular");
    expect(why.reason).toMatch(/calibrated rate/);
  });

  it("names the anchor for an anchor-implied record", () => {
    expect(shareUnavailable(REGION, record({ generationBasis: "anchor-implied" })).code)
      .toBe("anchor-implied");
  });

  it("names modelling for an estimated-tier region with no generation", () => {
    expect(shareUnavailable(ESTIMATED_REGION, record({})).code).toBe("modelled");
  });

  it("names the missing feed for a live-tier region with no generation", () => {
    expect(shareUnavailable(REGION, record({})).code).toBe("no-generation");
  });

  it("always returns a non-empty label and reason", () => {
    for (const data of [
      record({ generationBasis: "derived-from-generation" }),
      record({ generationBasis: "anchor-implied" }),
      record({}),
    ]) {
      for (const region of [REGION, ESTIMATED_REGION]) {
        const why = shareUnavailable(region, data);
        expect(why.label.length).toBeGreaterThan(0);
        expect(why.reason.length).toBeGreaterThan(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The real build paths must declare themselves derived.
// ---------------------------------------------------------------------------

function makeEiaResponse(mw: number, n = 30 * 24): EIAResponse {
  const data: EIAResponse["response"]["data"] = [];
  const base = new Date("2026-05-01T00:00:00Z");
  for (let i = 0; i < n; i++) {
    const period = new Date(base.getTime() + i * 3_600_000).toISOString().slice(0, 13);
    data.push({ period, respondent: "TEST", fueltype: "WND", value: String(mw) });
  }
  return { response: { total: n, data } };
}

const CONFIG: EiaIsoConfig = {
  regionId: "test-iso",
  respondent: "TEST",
  displayName: "Test ISO",
  windRate: 0.1,
  solarRate: 0.05,
};

describe("rate-derived build paths declare a derived basis", () => {
  it("eia-iso per-fuel: both records are derived, and neither yields a share", () => {
    const { wind, solar } = parseEiaIsoRegionPerFuel(CONFIG, makeEiaResponse(1000), makeEiaResponse(500));
    expect(wind.generationBasis).toBe("derived-from-generation");
    expect(solar.generationBasis).toBe("derived-from-generation");
    // The ratio these carry IS the config rate — proof the refusal matters.
    expect(wind.totalTWh / wind.generationTotalTWh!).toBeCloseTo(CONFIG.windRate, 10);
    expect(curtailmentShare(wind)).toBeNull();
    expect(curtailmentShare(solar)).toBeNull();
  });

  it("eia-iso combined: derived, no share", () => {
    const combined = parseEiaIsoRegion(CONFIG, makeEiaResponse(1000), makeEiaResponse(500));
    expect(combined.generationBasis).toBe("derived-from-generation");
    expect(curtailmentShare(combined)).toBeNull();
  });

  it("entsoe buildZoneData: derived, and the ratio is exactly the zone rate", () => {
    const raw: CurtailmentPoint[] = Array.from({ length: 30 * 24 }, (_, i) => ({
      utcTimestamp: new Date(Date.UTC(2026, 4, 1) + i * 3_600_000).toISOString(),
      mw: 800,
      intervalHours: 1,
    }));
    const zone = buildZoneData("test-zone", raw, 0.067, "note");
    expect(zone.generationBasis).toBe("derived-from-generation");
    expect(zone.totalTWh / zone.generationTotalTWh!).toBeCloseTo(0.067, 10);
    expect(curtailmentShare(zone)).toBeNull();
    expect(hasIndependentGeneration(zone)).toBe(false);
  });
});

describe("formatShare", () => {
  it("uses whole percent at or above 10%", () => {
    expect(formatShare(0.1234)).toBe("12%");
  });
  it("uses one decimal between 1% and 10%", () => {
    expect(formatShare(0.0412)).toBe("4.1%");
  });
  it("uses two decimals below 1% so small shares do not collapse to 0%", () => {
    expect(formatShare(0.0007)).toBe("0.07%");
    expect(formatShare(0)).toBe("0.00%");
  });
});
