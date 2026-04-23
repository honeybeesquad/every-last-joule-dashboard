import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const csv = readFileSync(join(__dirname, "../fixtures/aemo-daily-sample.csv"), "utf8");

let parseAemoIntermittentCsv: any;

describe("aemo parser", () => {
  beforeAll(async () => {
    const module = await import("../../src/data/aemo.json.js");
    parseAemoIntermittentCsv = module.parseAemoIntermittentCsv;
  });

  it("clusters DUID output into the five AEMO regions", () => {
    const result = parseAemoIntermittentCsv(csv);
    expect(result["aemo-nsw"].length).toBeGreaterThan(0);
    expect(result["aemo-vic"].length).toBeGreaterThan(0);
    expect(result["aemo-qld"].length).toBeGreaterThan(0);
    expect(result["aemo-sa"].length).toBeGreaterThan(0);
    expect(result["aemo-tas"].length).toBeGreaterThan(0);
  });

  it("converts AEMO market timestamps to UTC ISO strings", () => {
    const result = parseAemoIntermittentCsv(csv);
    expect(result["aemo-sa"][0].utcTimestamp).toBe("2026-04-21T18:05:00.000Z");
  });

  it("applies the 3% calibration to LOCL output", () => {
    const result = parseAemoIntermittentCsv(csv);
    expect(result["aemo-nsw"][0].mw).toBeCloseTo((154.99985 + 0) * 0.03, 5);
    expect(result["aemo-qld"][0].mw).toBeCloseTo(359.62836 * 0.03, 5);
  });
});
