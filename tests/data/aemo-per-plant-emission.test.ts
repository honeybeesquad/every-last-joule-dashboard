/**
 * Regression tests: AEMO per-plant emission set + dispatch-interval energy.
 *
 * Two defects this locks down, both found 2026-09-06 against a live NEMWEB
 * build that emitted only 3 of the 10 registry DUIDs:
 *
 * 1. **Emission set.** `aemo.json.ts` excludes ALL of `PER_PLANT_DUIDS` from
 *    the state aggregates unconditionally, so every registry DUID the
 *    per-plant loader drops is curtailment deleted from the dataset (the
 *    aggregate-minus-named contract from #298). Registry membership must be
 *    the sole gate — no magnitude filter on top.
 * 2. **Dispatch-interval energy.** NEMWEB UNIT_SOLUTION rows are 5-minute
 *    dispatch intervals (288/day). Billing each at the 1-hour `totalTWh30d`
 *    default over-reported curtailed energy by exactly 12x.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { totalTWh30d } from "../../src/lib/profile.js";
import { PER_PLANT_DUIDS } from "../../src/data/aemo-unit-map.js";
import { REGIONS } from "../../src/lib/regions.js";
import type { CurtailmentPoint } from "../../src/lib/types.js";

const HEADER =
  "I,DISPATCH,UNIT_SOLUTION,6,SETTLEMENTDATE,RUNNO,DUID,TOTALCLEARED,AVAILABILITY,SEMIDISPATCHCAP,UIGF";

/**
 * BANGOWF1 curtails 100 MW for one 5-minute interval (UIGF 150 - cleared 50).
 * True energy = 100 MW x 5/60 h = 8.3333 MWh. The pre-fix loader scored this
 * as 100 MWh.
 */
const SYNTHETIC_CSV = [
  "C,NEMP.WORLD,NEXT_DAY_DISPATCH,AEMO,PUBLIC,2026/06/24,01:00:00,0000000514277200,NEXT_DAY_DISPATCH,0000000514277199",
  HEADER,
  'D,DISPATCH,UNIT_SOLUTION,6,"2026/06/24 04:05:00",1,BANGOWF1,50,120,1,150',
  'D,DISPATCH,UNIT_SOLUTION,6,"2026/06/24 04:10:00",1,BANGOWF1,60,130,1,160',
  'D,DISPATCH,UNIT_SOLUTION,6,"2026/06/24 04:05:00",1,BLAYNEY,10,80,1,90',
  "",
].join("\n");

type Accumulator = Map<
  string,
  { allPoints: CurtailmentPoint[]; fueltech: "wind" | "solar"; duid: string; regionCode: string }
>;

let parseAemoDispatchCsvPerDuid: (csv: string) => Map<
  string,
  { points: CurtailmentPoint[]; fueltech: "wind" | "solar"; duid: string; regionCode: string }
>;
let buildPerPlantRegions: (
  accumulator: Accumulator,
  opts: { feedLatestUtc: string },
) => Record<string, { regionId: string; profile: number[]; latestProfile: number[] | null; totalTWh: number; peakGW: number; lat: number; lon: number; duid: string; fueltech: string; lastUpdated: string; lastSuccessAt: string; sourceNote?: string }>;

beforeAll(async () => {
  const module = await import("../../src/data/aemo-per-plant.json.js");
  parseAemoDispatchCsvPerDuid = module.parseAemoDispatchCsvPerDuid;
  buildPerPlantRegions = module.buildPerPlantRegions;
});

/** Canonical `aemo-*` per-plant region ids, derived from PER_PLANT_DUIDS. */
function canonicalPerPlantIds(): string[] {
  const lower = new Set([...PER_PLANT_DUIDS].map((d) => d.toLowerCase()));
  return REGIONS.filter((r) => {
    const m = /^aemo-([a-z0-9]+)-(wind|solar)$/.exec(r.id);
    return m !== null && lower.has(m[1]);
  }).map((r) => r.id);
}

function accumulatorFrom(csv: string): Accumulator {
  const acc: Accumulator = new Map();
  for (const [duid, entry] of parseAemoDispatchCsvPerDuid(csv)) {
    acc.set(duid, {
      allPoints: [...entry.points],
      fueltech: entry.fueltech,
      duid: entry.duid,
      regionCode: entry.regionCode,
    });
  }
  return acc;
}

describe("AEMO per-plant: 5-minute dispatch-interval energy", () => {
  it("stamps intervalHours = 5/60 on every parsed point", () => {
    const parsed = parseAemoDispatchCsvPerDuid(SYNTHETIC_CSV);
    const bango = parsed.get("BANGOWF1");
    expect(bango).toBeDefined();
    expect(bango!.points).toHaveLength(2);
    for (const p of bango!.points) {
      expect(p.intervalHours).toBeCloseTo(5 / 60, 10);
    }
  });

  it("totals curtailed energy at the true dispatch cadence, not 12x it", () => {
    const parsed = parseAemoDispatchCsvPerDuid(SYNTHETIC_CSV);
    const points = parsed.get("BANGOWF1")!.points;
    // 100 MW + 100 MW, each over 5 minutes = 16.6667 MWh = 1.66667e-5 TWh
    expect(totalTWh30d(points)).toBeCloseTo((200 * (5 / 60)) / 1_000_000, 12);
    // The pre-fix figure (200 MWh) must not come back.
    expect(totalTWh30d(points)).not.toBeCloseTo(200 / 1_000_000, 12);
  });
});

describe("AEMO per-plant: emission set is the registry, not a magnitude filter", () => {
  it("emits a region for every registry DUID even when only one carries signal", () => {
    const out = buildPerPlantRegions(accumulatorFrom(SYNTHETIC_CSV), {
      feedLatestUtc: "2026-06-23T18:10:00.000Z",
    });
    expect(Object.keys(out).sort()).toEqual(canonicalPerPlantIds().sort());
    expect(Object.keys(out)).toHaveLength(PER_PLANT_DUIDS.size);
  });

  it("emits a plant whose 30-day curtailment sits far below the old 0.01 TWh floor", () => {
    // 16.7 MWh over the window — three orders of magnitude under the old floor.
    const out = buildPerPlantRegions(accumulatorFrom(SYNTHETIC_CSV), {
      feedLatestUtc: "2026-06-23T18:10:00.000Z",
    });
    const bango = out["aemo-bangowf1-wind"];
    expect(bango).toBeDefined();
    expect(bango.totalTWh).toBeGreaterThan(0);
    expect(bango.totalTWh).toBeLessThan(0.01);
    expect(bango.peakGW).toBeGreaterThan(0);
  });

  it("never emits a non-registry DUID", () => {
    const out = buildPerPlantRegions(accumulatorFrom(SYNTHETIC_CSV), {
      feedLatestUtc: "2026-06-23T18:10:00.000Z",
    });
    expect(Object.keys(out)).not.toContain("aemo-blayney-wind");
  });
});

describe("AEMO per-plant: real-feed zeros are emitted, not dropped", () => {
  const out = () =>
    buildPerPlantRegions(accumulatorFrom(SYNTHETIC_CSV), {
      feedLatestUtc: "2026-06-23T18:10:00.000Z",
    });

  it("emits an all-zero region for a registry DUID with no curtailment in the window", () => {
    const rye = out()["aemo-ryepark1-wind"];
    expect(rye).toBeDefined();
    expect(rye.totalTWh).toBe(0);
    expect(rye.peakGW).toBe(0);
    expect(rye.profile).toHaveLength(24);
    expect(rye.profile.every((v) => v === 0)).toBe(true);
    expect(rye.latestProfile).toBeNull();
  });

  it("carries real plant metadata on the zero region", () => {
    const rye = out()["aemo-ryepark1-wind"];
    expect(rye.duid).toBe("RYEPARK1");
    expect(rye.fueltech).toBe("wind");
    // Rye Park Wind, NSW — OpenNEM coordinates, not a state centroid.
    expect(rye.lat).toBeCloseTo(-34.633, 2);
    expect(rye.lon).toBeCloseTo(148.954, 2);
  });

  it("dates the zero region's lastUpdated from the feed, not from wall-clock now", () => {
    const rye = out()["aemo-ryepark1-wind"];
    // lastUpdated is the field that carries source freshness downstream, and it
    // must never be Date.now() for a plant with no points. lastSuccessAt is set
    // here too, but withFallback's stampLive restamps it to build time at the
    // cache boundary — correctly, since it answers "when did the refresh
    // succeed", not "how fresh is the source data".
    expect(rye.lastUpdated).toBe("2026-06-23T18:10:00.000Z");
    expect(rye.lastSuccessAt).toBe("2026-06-23T18:10:00.000Z");
  });

  it("says in the source note that the zero is a measured reading", () => {
    const rye = out()["aemo-ryepark1-wind"];
    expect(rye.sourceNote).toMatch(/no curtailment/i);
  });
});
