import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(__dirname, "../fixtures/uk-bmrs-agws.json"), "utf8")
);

let parseNorthSea: any;

describe("north-sea parser", () => {
  beforeAll(async () => {
    const module = await import("../../src/data/north-sea.json.js");
    parseNorthSea = module.parseNorthSea;
  });

  it("produces non-zero points from a 7-day fixture", () => {
    const points = parseNorthSea([fixture]);
    expect(points.length).toBeGreaterThan(100);
  });

  it("combines wind-onshore + wind-offshore + solar per timestamp", () => {
    const points = parseNorthSea([fixture]);
    const ts = new Set(points.map((p: any) => p.utcTimestamp));
    expect(ts.size).toBe(points.length);
  });

  it("applies 6.9% calibration (total_curtailment / total_raw_gen ~= 0.069)", () => {
    const points = parseNorthSea([fixture]);
    const rawTotal = fixture.data.reduce(
      (s: number, r: any) => s + Math.max(0, r.quantity),
      0
    );
    const calibratedTotal = points.reduce((s: number, p: any) => s + p.mw, 0);
    expect(calibratedTotal / rawTotal).toBeCloseTo(0.069, 2);
  });

  it("timestamps are chronologically ordered", () => {
    const points = parseNorthSea([fixture]);
    for (let i = 1; i < points.length; i++) {
      expect(new Date(points[i].utcTimestamp).getTime()).toBeGreaterThanOrEqual(
        new Date(points[i - 1].utcTimestamp).getTime()
      );
    }
  });
});
