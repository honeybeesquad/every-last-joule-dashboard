/**
 * Regression test: AEMO per-plant double-count fix.
 *
 * Verifies that named per-plant DUIDs (PER_PLANT_DUIDS) are excluded from the
 * state aggregate produced by parseAemoDispatchCsv, while non-named DUIDs in
 * the same state ARE included. This ensures the headline total doesn't
 * double-count DUIDs that also appear as first-class per-plant regions.
 */

import { describe, it, expect, beforeAll } from "vitest";

// Synthetic UNIT_SOLUTION CSV:
// - BANGOWF1: a named per-plant DUID (NSW, wind) — must NOT appear in aemo-nsw aggregate
// - SAPHWF1:  a named per-plant DUID (NSW, wind) — must NOT appear in aemo-nsw aggregate
// - BLAYNEY:  a non-named NSW wind DUID          — MUST appear in aemo-nsw aggregate
// SEMIDISPATCHCAP=1 on all rows so they're all candidates without the dedup filter.
// One BANGOWF1 row has SEMIDISPATCHCAP=0 to confirm that independent guard still works.
const SYNTHETIC_CSV = `C,NEMP.WORLD,NEXT_DAY_DISPATCH,AEMO,PUBLIC,2026/06/24,01:00:00,0000000514277200,NEXT_DAY_DISPATCH,0000000514277199
I,DISPATCH,UNIT_SOLUTION,6,SETTLEMENTDATE,RUNNO,DUID,TOTALCLEARED,AVAILABILITY,SEMIDISPATCHCAP,UIGF
D,DISPATCH,UNIT_SOLUTION,6,"2026/06/24 04:05:00",1,BANGOWF1,50,120,1,150
D,DISPATCH,UNIT_SOLUTION,6,"2026/06/24 04:05:00",1,SAPHWF1,30,100,1,120
D,DISPATCH,UNIT_SOLUTION,6,"2026/06/24 04:05:00",1,BLAYNEY,10,80,1,90
D,DISPATCH,UNIT_SOLUTION,6,"2026/06/24 04:10:00",1,BANGOWF1,60,130,0,130
`;
// Expected after fix:
// BANGOWF1 curtailment (SEMIDISPATCHCAP=1 row): 150 - 50 = 100 MW  → EXCLUDED from aemo-nsw
// SAPHWF1  curtailment:                         120 - 30 =  90 MW  → EXCLUDED from aemo-nsw
// BLAYNEY  curtailment:                          90 - 10 =  80 MW  → INCLUDED  in aemo-nsw
// BANGOWF1 (SEMIDISPATCHCAP=0 row):              skipped by semidispatch guard

let parseAemoDispatchCsv: (csv: string) => {
  points: Record<string, Array<{ utcTimestamp: string; mw: number }>>;
  windPoints: Record<string, Array<{ utcTimestamp: string; mw: number }>>;
  solarPoints: Record<string, Array<{ utcTimestamp: string; mw: number }>>;
  windMwhTotal: Record<string, number>;
  solarMwhTotal: Record<string, number>;
};

describe("AEMO aggregate-minus-named dedup (double-count fix)", () => {
  beforeAll(async () => {
    const module = await import("../../src/data/aemo.json.js");
    parseAemoDispatchCsv = module.parseAemoDispatchCsv;
  });

  it("excludes named per-plant DUID (BANGOWF1) from the NSW state aggregate", () => {
    const { points, windPoints } = parseAemoDispatchCsv(SYNTHETIC_CSV);
    // BANGOWF1 is in PER_PLANT_DUIDS — must not contribute to aemo-nsw
    const nswTotal = points["aemo-nsw"].reduce((sum, p) => sum + p.mw, 0);
    const nswWind  = windPoints["aemo-nsw"].reduce((sum, p) => sum + p.mw, 0);
    // Only BLAYNEY (80 MW) should appear, not BANGOWF1 (100 MW) or SAPHWF1 (90 MW)
    expect(nswTotal).toBeCloseTo(80, 5);
    expect(nswWind).toBeCloseTo(80, 5);
  });

  it("excludes named per-plant DUID (SAPHWF1) from the NSW state aggregate", () => {
    const { windPoints } = parseAemoDispatchCsv(SYNTHETIC_CSV);
    // SAPHWF1 is in PER_PLANT_DUIDS — 90 MW must not appear in aemo-nsw
    const nswWind = windPoints["aemo-nsw"].reduce((sum, p) => sum + p.mw, 0);
    expect(nswWind).toBeCloseTo(80, 5); // Only BLAYNEY
    expect(nswWind).not.toBeCloseTo(170, 5); // Not BLAYNEY + SAPHWF1
    expect(nswWind).not.toBeCloseTo(270, 5); // Not all three
  });

  it("includes non-named DUID (BLAYNEY) in the NSW state aggregate", () => {
    const { points, windPoints } = parseAemoDispatchCsv(SYNTHETIC_CSV);
    expect(points["aemo-nsw"].length).toBeGreaterThan(0);
    const nswTotal = points["aemo-nsw"].reduce((sum, p) => sum + p.mw, 0);
    expect(nswTotal).toBeCloseTo(80, 5);
    const nswWind = windPoints["aemo-nsw"].reduce((sum, p) => sum + p.mw, 0);
    expect(nswWind).toBeCloseTo(80, 5);
  });

  it("SEMIDISPATCHCAP=0 row for named DUID is also skipped (independent guard)", () => {
    const { points } = parseAemoDispatchCsv(SYNTHETIC_CSV);
    // The second BANGOWF1 row has SEMIDISPATCHCAP=0 — it would be skipped by the
    // semidispatch guard even without the PER_PLANT_DUIDS filter. The aggregate
    // should still only contain BLAYNEY's 80 MW.
    const nswTotal = points["aemo-nsw"].reduce((sum, p) => sum + p.mw, 0);
    expect(nswTotal).toBeCloseTo(80, 5);
  });
});
