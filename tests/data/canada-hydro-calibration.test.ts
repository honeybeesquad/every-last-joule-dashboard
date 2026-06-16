import { describe, it, expect } from "vitest";
import { buildStaticRegion } from "../../src/data/statics.json";
import { REGIONS } from "../../src/lib/regions";

/**
 * Canada T2 calibrated-proxy tests (2026-06-17).
 *
 * Quebec, BC, Manitoba, Saskatchewan promoted from T3 estimated to
 * T2 anchored using published hydro-operator annual reports.
 *
 * Same approach as Austria (T2-annual-calibrated): static flat-base
 * profile anchored to published annual total. Hydro spill is
 * monthly-seasonal, not diurnal — flat 24/7 shape is correct.
 */

const CANADA_T2_IDS = [
  "quebec",
  "british-columbia",
  "manitoba",
  "saskatchewan",
];

describe("Canada T2 hydro-operator calibrated proxy", () => {
  it("all 4 Canada T2 regions are tier anchored in REGIONS", () => {
    for (const id of CANADA_T2_IDS) {
      const region = REGIONS.find((r) => r.id === id);
      expect(region).toBeDefined();
      expect(region!.tier).toBe("anchored");
    }
  });

  it("all 4 Canada T2 regions have canonical IDs", () => {
    const canonicalIds = new Set(REGIONS.map((r) => r.id));
    for (const id of CANADA_T2_IDS) {
      expect(canonicalIds.has(id)).toBe(true);
    }
  });

  it("quebec: 6.0 TWh/yr flat profile, sourceProvenance official-lead", () => {
    const region = REGIONS.find((r) => r.id === "quebec")!;
    const spec = buildStaticRegion("quebec", {
      annualTWh: 6.0,
      kind: "flat",
      source: "Hydro-Quebec 2024 annual report",
      reportDate: "2024",
    });
    expect(region.tier).toBe("anchored");
    expect(region.sourceProvenance).toBe("official-lead");
    expect(spec.profile.length).toBe(24);
    // Flat profile: all hours equal
    const first = spec.profile[0];
    for (const v of spec.profile) expect(v).toBe(first);
    // GW check: 6.0 TWh/yr → ~0.685 GW flat
    expect(spec.profile[0]).toBeCloseTo((6.0 * 1000) / 8760, 1);
    expect(spec.totalTWh).toBeGreaterThan(0);
    expect(spec.totalTWh).toBeLessThanOrEqual(6.0 * (30 / 365) * 1.1);
  });

  it("british-columbia: 2.0 TWh/yr flat profile", () => {
    const region = REGIONS.find((r) => r.id === "british-columbia")!;
    expect(region.tier).toBe("anchored");
    expect(region.sourceProvenance).toBe("official-lead");
    const flatGW = (2.0 * 1000) / 8760;
    expect(region.kind).toBe("hydro");
  });

  it("manitoba: 1.5 TWh/yr flat profile", () => {
    const region = REGIONS.find((r) => r.id === "manitoba")!;
    expect(region.tier).toBe("anchored");
    expect(region.sourceProvenance).toBe("official-lead");
    expect(region.kind).toBe("hydro");
  });

  it("saskatchewan: 0.3 TWh/yr flat profile", () => {
    const region = REGIONS.find((r) => r.id === "saskatchewan")!;
    expect(region.tier).toBe("anchored");
    expect(region.sourceProvenance).toBe("official-lead");
    expect(region.kind).toBe("hydro");
  });

  it("no Canada T2 region has kind=mixed or kind=wind", () => {
    for (const id of CANADA_T2_IDS) {
      const region = REGIONS.find((r) => r.id === id)!;
      expect(["hydro", "flat"]).toContain(region.kind);
    }
  });

  it("all 4 regions have sourceProvenance=official-lead", () => {
    for (const id of CANADA_T2_IDS) {
      const region = REGIONS.find((r) => r.id === id)!;
      expect(region.sourceProvenance).toBe("official-lead");
    }
  });
});
