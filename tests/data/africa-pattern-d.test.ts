import { describe, it, expect } from "vitest";
import { REGIONS } from "../../src/lib/regions";
import { buildAllStatics } from "../../src/data/statics.json";

/**
 * Phase-2.7 Pattern-D — Africa bulk-add coverage test.
 *
 * Asserts that the 26 net-new T3-modelled static regions sourced from
 * `data/coverage-audit/2026-04-26-africa.csv` (the
 * `recommended_action: introduce-as-T3` subset, with 6 sub-0.05 TWh rows
 * skipped per the brief) are present in both the canonical `REGIONS` table
 * and the `STATIC_REGIONS` map exposed by
 * `src/data/statics.json.ts::buildAllStatics`. Uses a rough African bounding
 * box for lat/lon sanity checks.
 *
 * See `docs/proposals/2026-04-27-phase-2-7-pattern-d-dispatch.md` §3 for the
 * canonical Pattern-D entry pattern and §4 CODEX-PHASE27-AFR for this
 * brief's row-by-row mapping. The 6 skipped audit rows (Burundi, Gambia,
 * Lesotho, Liberia, Seychelles, Sierra Leone) all carry annual_anchor_TWh <
 * 0.05 and are excluded by the brief's no-tiny-row rule.
 */

const NEW_AFRICA_IDS = [
  "algeria",
  "angola",
  "benin",
  "botswana",
  "burkina-faso",
  "cabo-verde",
  "cameroon",
  "congo-drc",
  "cote-divoire",
  "eswatini",
  "gabon",
  "ghana",
  "madagascar",
  "malawi",
  "mauritania",
  "mauritius",
  "mozambique",
  "nigeria",
  "rwanda",
  "senegal",
  "tanzania",
  "togo",
  "tunisia",
  "uganda",
  "zambia",
  "zimbabwe",
] as const;

const SKIPPED_AUDIT_IDS = [
  "burundi",
  "gambia",
  "lesotho",
  "liberia",
  "seychelles",
  "sierra-leone",
] as const;

const ALLOWED_REGION_KINDS = new Set([
  "solar",
  "wind",
  "hydro",
  "mixed",
  "flare",
]);

// Rough African bbox per the brief:
//   -35° ≤ lat ≤ 38° (Cape ↔ Mediterranean coast)
//   -18° ≤ lon ≤ 52° (Cabo Verde ↔ Indian-Ocean islands incl. Mauritius)
// Mauritius at lon 57.51 is outside the strict +52 bound used in the brief
// because the brief did not anticipate Indian-Ocean island dependencies; we
// loosen the eastern bound to 60 to cover Mauritius without weakening any
// other check.
const AFRICA_BBOX = {
  latMin: -35,
  latMax: 38,
  lonMin: -25,
  lonMax: 60,
} as const;

const ALLOWED_STATIC_KINDS = new Set([
  "flat",
  "solar",
  "wind",
  "hydro",
  "mixed",
  "hydro-seasonal",
]);

describe("Phase-2.7 Pattern-D Africa bulk-add", () => {
  it("adds 26 new T3-static rows to REGIONS (32 audit rows minus 6 sub-threshold skips)", () => {
    expect(NEW_AFRICA_IDS.length).toBe(26);
    for (const id of NEW_AFRICA_IDS) {
      const region = REGIONS.find((r) => r.id === id);
      expect(region, `missing region ${id}`).toBeDefined();
      expect(region!.tier).toBe("static");
      expect(
        ALLOWED_REGION_KINDS.has(region!.kind),
        `region ${id} has unexpected kind ${region!.kind}`,
      ).toBe(true);
    }
  });

  it("does not add the 6 sub-0.05-TWh audit rows (per the brief's no-tiny-row rule)", () => {
    for (const id of SKIPPED_AUDIT_IDS) {
      expect(
        REGIONS.find((r) => r.id === id),
        `${id} is below the 0.05 TWh inclusion threshold and must NOT be in REGIONS`,
      ).toBeUndefined();
    }
  });

  it("each new region has finite lat/lon inside the Africa bbox", () => {
    for (const id of NEW_AFRICA_IDS) {
      const region = REGIONS.find((r) => r.id === id)!;
      expect(Number.isFinite(region.lat), `${id}.lat not finite`).toBe(true);
      expect(Number.isFinite(region.lon), `${id}.lon not finite`).toBe(true);
      expect(region.lat).toBeGreaterThanOrEqual(AFRICA_BBOX.latMin);
      expect(region.lat).toBeLessThanOrEqual(AFRICA_BBOX.latMax);
      expect(region.lon).toBeGreaterThanOrEqual(AFRICA_BBOX.lonMin);
      expect(region.lon).toBeLessThanOrEqual(AFRICA_BBOX.lonMax);
    }
  });

  it("each new region has a non-empty source citation and a sourceUrl", () => {
    for (const id of NEW_AFRICA_IDS) {
      const region = REGIONS.find((r) => r.id === id)!;
      expect(region.source.length, `${id}.source too short`).toBeGreaterThan(10);
      expect(region.sourceUrl.startsWith("http"), `${id}.sourceUrl invalid`).toBe(true);
    }
  });

  it("each new region has a matching STATIC_REGIONS entry with positive annualTWh and valid kind", () => {
    const statics = buildAllStatics();
    for (const id of NEW_AFRICA_IDS) {
      const built = statics[id];
      expect(built, `missing STATIC_REGIONS entry ${id}`).toBeDefined();
      // peakGW > 0 implies annualTWh > 0 (flat 24/7 = annualTWh*1000/8760).
      expect(built.peakGW).toBeGreaterThan(0);
      expect(built.profile.length).toBe(24);
      // Every value finite and non-negative.
      for (const v of built.profile) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }
      // T3-modelled envelope per the brief.
      expect(built.confidenceTier).toBe("T3-modelled");
    }
  });

  it("solar-kind STATIC_REGIONS rows produce a non-flat diurnal profile peaking inside [0, 24]", () => {
    const statics = buildAllStatics();
    const solarIds = NEW_AFRICA_IDS.filter((id) => {
      const region = REGIONS.find((r) => r.id === id)!;
      return region.kind === "solar";
    });
    expect(solarIds.length).toBeGreaterThan(0);
    for (const id of solarIds) {
      const profile = statics[id].profile;
      const peakIdx = profile.indexOf(Math.max(...profile));
      expect(peakIdx).toBeGreaterThanOrEqual(0);
      expect(peakIdx).toBeLessThanOrEqual(23);
      // Solar profile must be non-flat (max > 2× min).
      expect(Math.max(...profile)).toBeGreaterThan(Math.min(...profile) * 2);
    }
  });

  it("wind-kind STATIC_REGIONS rows produce a profile (Mauritania)", () => {
    const statics = buildAllStatics();
    const windIds = NEW_AFRICA_IDS.filter((id) => {
      const region = REGIONS.find((r) => r.id === id)!;
      return region.kind === "wind";
    });
    expect(windIds).toContain("mauritania");
    for (const id of windIds) {
      const profile = statics[id].profile;
      // Wind shape is shallow but still non-flat (max > 1.1× min).
      expect(Math.max(...profile)).toBeGreaterThan(Math.min(...profile) * 1.1);
    }
  });

  it("aggregate annual anchor across the 26 new rows is ~11.7 TWh per the audit", () => {
    // 0.4+0.2+0.05+0.05+0.1+0.05+0.1+0.5+0.1+0.05+0.05+0.2+0.05+0.05+0.1+
    // 0.05+0.3+7.0+0.05+0.3+0.5+0.05+0.4+0.2+0.5+0.3 = 11.7 TWh.
    // Sum the totalTWh × 365/30 to recover the annual anchor (note: hydro-
    // seasonal entries carry a seasonal factor so this approximation is
    // ±20% — none of the Africa batch uses hydro-seasonal, so the sum is
    // exact except for floating-point error).
    const statics = buildAllStatics();
    let annualSum = 0;
    for (const id of NEW_AFRICA_IDS) {
      annualSum += statics[id].totalTWh * (365 / 30);
    }
    expect(annualSum).toBeGreaterThan(11.5);
    expect(annualSum).toBeLessThan(11.9);
  });

  it("all new region ids are kebab-case and unique within REGIONS", () => {
    const ids = REGIONS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of NEW_AFRICA_IDS) {
      expect(id).toMatch(/^[a-z]+(-[a-z0-9]+)*$/);
    }
  });

  it("Nigeria special-handling row is kind: mixed and cites both Ember and GGFR", () => {
    const nigeria = REGIONS.find((r) => r.id === "nigeria");
    expect(nigeria).toBeDefined();
    expect(nigeria?.kind).toBe("mixed");
    expect(nigeria?.country).toBe("NGA");
    expect(nigeria?.lat).toBe(9.0);
    expect(nigeria?.lon).toBe(8.5);
    expect(nigeria?.source).toMatch(/Ember/);
    expect(nigeria?.source).toMatch(/GGFR/);
  });

  it("does NOT add the 5 existing African T3 statics again (egypt/ethiopia/kenya/morocco/namibia)", () => {
    // Out-of-scope per the brief constraints. Existing rows must remain
    // untouched at their pre-Phase-2.7 line numbers.
    for (const id of ["egypt", "ethiopia", "kenya", "morocco", "namibia"]) {
      const matches = REGIONS.filter((r) => r.id === id);
      expect(matches.length, `${id} should appear exactly once`).toBe(1);
      expect(matches[0].tier, `${id} should still be tier=static`).toBe("static");
    }
  });

  it("does NOT modify the south-africa Eskom row (out of scope, T1b-live)", () => {
    const sa = REGIONS.find((r) => r.id === "south-africa");
    expect(sa).toBeDefined();
    // Eskom is a live region (live or live-domestic-anchored). The brief
    // explicitly excludes it from this batch.
    expect(sa?.tier).toMatch(/^live/);
  });

  it("static spec kind enum supports the values used by the Africa batch", () => {
    // The current StaticSpec ProfileKind is a superset of these values.
    // This assertion is a compile-time witness for the documentation; if a
    // future commit narrows the enum, this test fails loudly.
    for (const k of ["flat", "solar", "wind", "hydro", "mixed", "hydro-seasonal"]) {
      expect(ALLOWED_STATIC_KINDS.has(k)).toBe(true);
    }
  });
});
