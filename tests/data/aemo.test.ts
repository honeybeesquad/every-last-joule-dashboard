import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const csv = readFileSync(join(__dirname, "../fixtures/aemo-daily-sample.csv"), "utf8");

let parseAemoDispatchCsv: any;

describe("aemo parser", () => {
  beforeAll(async () => {
    const module = await import("../../src/data/aemo.json.js");
    parseAemoDispatchCsv = module.parseAemoDispatchCsv;
  });

  it("clusters directly constrained DUID output into the five AEMO regions", () => {
    const { points } = parseAemoDispatchCsv(csv);
    expect(points["aemo-nsw"].length).toBeGreaterThan(0);
    expect(points["aemo-vic"].length).toBeGreaterThan(0);
    expect(points["aemo-qld"].length).toBeGreaterThan(0);
    expect(points["aemo-sa"].length).toBeGreaterThan(0);
    expect(points["aemo-tas"].length).toBeGreaterThan(0);
  });

  it("converts AEMO market timestamps to UTC ISO strings", () => {
    const { points } = parseAemoDispatchCsv(csv);
    expect(points["aemo-sa"][0].utcTimestamp).toBe("2026-04-21T18:05:00.000Z");
  });

  it("uses UIGF minus dispatch target only when SEMIDISPATCHCAP is set", () => {
    const { points } = parseAemoDispatchCsv(csv);
    expect(points["aemo-nsw"][0].mw).toBeCloseTo(54.99985, 5);
    expect(points["aemo-qld"][0].mw).toBeCloseTo(359.62836, 5);
  });

  it("accumulates per-state wind/solar MW totals from the fueltech map", () => {
    const { windMwhTotal, solarMwhTotal } = parseAemoDispatchCsv(csv);
    // At least one state should have non-zero wind OR solar in the sample.
    const anyWind = Object.values(windMwhTotal as Record<string, number>).some((v) => v > 0);
    const anySolar = Object.values(solarMwhTotal as Record<string, number>).some((v) => v > 0);
    expect(anyWind || anySolar).toBe(true);
  });

  it("keeps state wind and solar point streams separate", () => {
    const { points, windPoints, solarPoints } = parseAemoDispatchCsv(csv);
    const stateIds = ["aemo-nsw", "aemo-vic", "aemo-qld", "aemo-sa", "aemo-tas"];

    for (const stateId of stateIds) {
      const totalMw = points[stateId].reduce((sum: number, point: { mw: number }) => sum + point.mw, 0);
      const windMw = windPoints[stateId].reduce((sum: number, point: { mw: number }) => sum + point.mw, 0);
      const solarMw = solarPoints[stateId].reduce((sum: number, point: { mw: number }) => sum + point.mw, 0);
      expect(totalMw).toBeCloseTo(windMw + solarMw, 6);
    }
  });
});
