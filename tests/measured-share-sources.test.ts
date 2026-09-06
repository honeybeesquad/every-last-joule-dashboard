/**
 * The two build paths that may honestly publish a share, exercised end to end
 * against committed fixtures.
 *
 *   Japan (OCCTO area CSV) — 太陽光発電実績 / 風力発電実績 (measured generation)
 *   sit one column before 太陽光出力制御量 / 風力出力制御量 (measured
 *   curtailment) on the same 30-minute row. Two separate measurements, so the
 *   ratio is an observation.
 *
 *   AEMO per-plant (NEMWEB DISPATCH UNIT_SOLUTION) — curtailment is
 *   UIGF - TOTALCLEARED on SEMIDISPATCHCAP intervals; generation is TOTALCLEARED
 *   across EVERY interval. The denominator is one unit's own metering, so
 *   unlike the state aggregates there is no registry-completeness gap in it.
 *
 * The AEMO test that matters most is the one asserting generation accumulates
 * on uncapped intervals: summing TOTALCLEARED only where SEMIDISPATCHCAP = 1
 * compiles, passes a naive smoke test, and yields a share inflated by orders of
 * magnitude.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { decodeAreaCsv, mergeWindowBuild, parseAreaCsv } from "../src/lib/japan-area-csv";
import { curtailmentShare, hasIndependentGeneration } from "../src/lib/generation-share";
import type { CurtailmentPoint } from "../src/lib/types";

const fixture = (name: string): string =>
  decodeAreaCsv(new Uint8Array(readFileSync(join(__dirname, "fixtures", name))));

describe("Japan OCCTO area CSV — measured curtailment over measured generation", () => {
  it("reads the generation columns alongside the curtailment columns (22-col)", () => {
    const r = parseAreaCsv(fixture("japan-area-22col.csv"), { dateFormat: "slash" });
    expect(r.points).toHaveLength(2);
    // Fixture row 1: solar gen 5000 MW, solar curtailment 100 MW.
    expect(r.points[0].solarGenMw).toBe(5000);
    expect(r.points[0].solarMw).toBe(100);
    expect(r.points[0].windGenMw).toBe(400);
    expect(r.points[0].windMw).toBe(10);
  });

  it("reads them in the 20-col layout too — resolved by name, not index", () => {
    const r = parseAreaCsv(fixture("japan-area-20col.csv"), { dateFormat: "slash" });
    expect(r.points.every((p) => p.solarGenMw > 0)).toBe(true);
  });

  it("reads them through quoted cells and the yyyymmdd date format", () => {
    const r = parseAreaCsv(fixture("japan-area-quoted-yyyymmdd.csv"), { dateFormat: "yyyymmdd" });
    expect(r.points.length).toBeGreaterThan(0);
    expect(r.points.every((p) => p.solarGenMw > 0)).toBe(true);
  });

  it("emits a measured-independent basis and a share that is NOT any fixed rate", () => {
    const parsed = parseAreaCsv(fixture("japan-area-22col.csv"), { dateFormat: "slash" });
    const now = new Date(parsed.points.at(-1)!.utcTimestamp);
    const rd = mergeWindowBuild([parsed], "japan-test", "note", now);

    expect(rd.generationBasis).toBe("measured-independent");
    expect(rd.generationProfile).toHaveLength(24);
    expect(hasIndependentGeneration(rd)).toBe(true);

    // Curtailment 100+10 then 200+0 MW; generation 5000+400 then 5200+380 MW.
    // Both sides come from the file; neither is the other times a constant.
    const share = curtailmentShare(rd)!;
    expect(share).not.toBeNull();
    expect(share).toBeCloseTo(rd.totalTWh / rd.generationTotalTWh!, 12);
    expect(share).toBeGreaterThan(0);
    expect(share).toBeLessThan(1);
  });

  it("honours the schema invariant: generation >= curtailment", () => {
    const parsed = parseAreaCsv(fixture("japan-area-22col.csv"), { dateFormat: "slash" });
    const now = new Date(parsed.points.at(-1)!.utcTimestamp);
    const rd = mergeWindowBuild([parsed], "japan-test", "note", now);
    expect(rd.generationTotalTWh!).toBeGreaterThanOrEqual(rd.totalTWh);
  });

  it("emits NO generation and NO basis when the layout has no generation columns", () => {
    // A curtailment-only layout must degrade to "no denominator", never to a
    // zero one — a zero denominator would surface as a missing share with the
    // wrong reason, or worse, as a division.
    const csv = [
      "DATE,TIME,太陽光出力制御量,風力出力制御量",
      "2026/5/1,12:00,100,10",
      "2026/5/1,12:30,200,0",
    ].join("\n");
    const parsed = parseAreaCsv(csv, { dateFormat: "slash" });
    expect(parsed.points).toHaveLength(2);
    expect(parsed.points[0].solarGenMw).toBe(0);

    const rd = mergeWindowBuild([parsed], "japan-test", "note", new Date("2026-05-01T03:30:00.000Z"));
    expect(rd.generationBasis).toBeUndefined();
    expect(rd.generationTotalTWh).toBeUndefined();
    expect(curtailmentShare(rd)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AEMO per-plant
// ---------------------------------------------------------------------------

const HEADER =
  "I,DISPATCH,UNIT_SOLUTION,6,SETTLEMENTDATE,RUNNO,DUID,TOTALCLEARED,AVAILABILITY,SEMIDISPATCHCAP,UIGF";

/**
 * BANGOWF1 (a PER_PLANT_DUIDS member) over four 5-minute intervals:
 *   two capped   — cleared 50 of 150 available, cleared 60 of 160  → 100 + 100 MW curtailed
 *   two uncapped — cleared 140 and 150, nothing curtailed
 * Generation must total 50 + 60 + 140 + 150 = 400 MW-intervals. Counting only
 * the capped ones would give 110 and a share nearly 4x too high.
 */
const CSV = [
  "C,NEMP.WORLD,NEXT_DAY_DISPATCH,AEMO,PUBLIC,2026/06/24,01:00:00,0000000514277200,NEXT_DAY_DISPATCH,0000000514277199",
  HEADER,
  'D,DISPATCH,UNIT_SOLUTION,6,"2026/06/24 04:05:00",1,BANGOWF1,50,120,1,150',
  'D,DISPATCH,UNIT_SOLUTION,6,"2026/06/24 04:10:00",1,BANGOWF1,60,130,1,160',
  'D,DISPATCH,UNIT_SOLUTION,6,"2026/06/24 04:15:00",1,BANGOWF1,140,150,0,140',
  'D,DISPATCH,UNIT_SOLUTION,6,"2026/06/24 04:20:00",1,BANGOWF1,150,160,0,150',
  "",
].join("\n");

interface ParsedEntry {
  points: CurtailmentPoint[];
  genPoints: CurtailmentPoint[];
  fueltech: "wind" | "solar";
  duid: string;
  regionCode: string;
}

let parsePerDuid: (csv: string) => Map<string, ParsedEntry>;
let buildPerPlantRegions: (
  acc: Map<string, {
    allPoints: CurtailmentPoint[];
    allGenPoints?: CurtailmentPoint[];
    fueltech: "wind" | "solar";
    duid: string;
    regionCode: string;
  }>,
  opts: { feedLatestUtc: string },
) => Record<string, {
  regionId: string;
  totalTWh: number;
  generationTotalTWh?: number;
  generationProfile?: number[];
  generationBasis?: string;
}>;

beforeAll(async () => {
  const mod = await import("../src/data/aemo-per-plant.json.js");
  parsePerDuid = mod.parseAemoDispatchCsvPerDuid;
  buildPerPlantRegions = mod.buildPerPlantRegions;
});

const MW_INTERVAL_TWH = (5 / 60) / 1_000_000;

describe("AEMO per-plant — measured curtailment over measured dispatch", () => {
  it("accumulates generation on UNCAPPED intervals, not only capped ones", () => {
    const bango = parsePerDuid(CSV).get("BANGOWF1")!;
    expect(bango.points).toHaveLength(2); // curtailment: capped intervals only
    expect(bango.genPoints).toHaveLength(4); // generation: every interval
    const genMw = bango.genPoints.reduce((s, p) => s + p.mw, 0);
    expect(genMw).toBe(400); // 50 + 60 + 140 + 150 — the capped-only sum is 110
  });

  it("bills generation points at the 5-minute dispatch interval, not 1 hour", () => {
    const bango = parsePerDuid(CSV).get("BANGOWF1")!;
    for (const p of bango.genPoints) expect(p.intervalHours).toBeCloseTo(5 / 60, 12);
  });

  it("emits a measured-independent share for a registry DUID", () => {
    const parsed = parsePerDuid(CSV);
    const acc = new Map(
      [...parsed].map(([duid, e]) => [duid, {
        allPoints: [...e.points],
        allGenPoints: [...e.genPoints],
        fueltech: e.fueltech,
        duid: e.duid,
        regionCode: e.regionCode,
      }]),
    );
    const out = buildPerPlantRegions(acc, { feedLatestUtc: "2026-06-24T04:20:00.000Z" });
    const region = out["aemo-bangowf1-wind"];

    expect(region.generationBasis).toBe("measured-independent");
    expect(region.generationTotalTWh).toBeCloseTo(400 * MW_INTERVAL_TWH, 15);
    expect(region.totalTWh).toBeCloseTo(200 * MW_INTERVAL_TWH, 15);
    // 200 curtailed against 400 dispatched = 50%. Capped-only generation (110)
    // would have produced 182%, which the gate would then have withheld.
    expect(curtailmentShare(region as never)).toBeCloseTo(0.5, 12);
  });

  it("emits no generation, and so no share, for a DUID with no dispatch in the window", () => {
    const out = buildPerPlantRegions(new Map(), { feedLatestUtc: "2026-06-24T04:20:00.000Z" });
    const region = out["aemo-bangowf1-wind"];
    expect(region.totalTWh).toBe(0); // measured zero — still a real region
    expect(region.generationBasis).toBeUndefined();
    expect(curtailmentShare(region as never)).toBeNull();
  });
});
