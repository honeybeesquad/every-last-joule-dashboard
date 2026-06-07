import { describe, expect, it } from "vitest";
import { extractTotals } from "../scripts/build-version-history.js";

// Single-region snapshot shape: top-level keys include regionId + profile.
const SINGLE: unknown = {
  regionId: "caiso-solar",
  profile: [],
  latestProfile: null,
  totalTWh: 1.23,
  peakGW: 0.45,
  lastUpdated: "2026-01-01T00:00:00.000Z",
  lastSuccessAt: "2026-01-01T01:00:00.000Z",
  confidenceTier: "T1a-live-tso",
  sourceProvenance: "verified",
};

// Multi-region Record snapshot: top-level keys are region IDs.
const MULTI: unknown = {
  "brazil-rn-wind": {
    regionId: "brazil-rn-wind",
    totalTWh: 2.0,
    peakGW: 0.9,
    confidenceTier: "T1a-live-tso",
    sourceProvenance: "verified",
  },
  "brazil-ce-solar": {
    regionId: "brazil-ce-solar",
    totalTWh: 0.5,
    peakGW: 0.2,
    confidenceTier: "T3-modelled",
    sourceProvenance: "modelled-fallback",
  },
};

// Missing tier/provenance — older snapshots before 2026-04-25 sweep.
const MISSING_FIELDS: unknown = {
  regionId: "old-region",
  profile: [],
  latestProfile: null,
  totalTWh: 0.7,
  peakGW: 0.1,
  lastUpdated: "2026-01-01T00:00:00.000Z",
  lastSuccessAt: "2026-01-01T01:00:00.000Z",
};

// cbeci.json shape — not a region snapshot.
const CBECI: unknown = {
  hashrateEHps: 600,
  annualisedConsumptionTWh: 130,
};

describe("extractTotals", () => {
  it("extracts one row from a single-region snapshot", () => {
    const rows = extractTotals("caiso.json", SINGLE, "1.3.2");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      version: "1.3.2",
      regionId: "caiso-solar",
      totalTWh: 1.23,
      peakGW: 0.45,
      confidenceTier: "T1a-live-tso",
      sourceProvenance: "verified",
    });
  });

  it("extracts one row per entry from a multi-region Record snapshot", () => {
    const rows = extractTotals("brazil-ne.json", MULTI, "1.3.2");
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.regionId).sort()).toEqual(["brazil-ce-solar", "brazil-rn-wind"]);
    expect(rows.find((r) => r.regionId === "brazil-rn-wind")?.totalTWh).toBe(2.0);
  });

  it("emits empty strings for missing confidenceTier / sourceProvenance", () => {
    const rows = extractTotals("old.json", MISSING_FIELDS, "1.0.0");
    expect(rows).toHaveLength(1);
    expect(rows[0].confidenceTier).toBe("");
    expect(rows[0].sourceProvenance).toBe("");
  });

  it("returns [] for cbeci.json (non-region file)", () => {
    expect(extractTotals("cbeci.json", CBECI, "1.3.2")).toEqual([]);
  });
});
