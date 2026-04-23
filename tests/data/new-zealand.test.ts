import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { buildNewZealandData, parseEmiGenerationCsv } from "../../src/data/new-zealand.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
const csv = readFileSync(join(__dirname, "../fixtures/new-zealand-sample.csv"), "utf8");

describe("new zealand parser", () => {
  it("aggregates wind/solar/geothermal trading periods and applies 1.3%", () => {
    const points = parseEmiGenerationCsv(csv);
    expect(points[0].utcTimestamp).toBe("2026-03-31T12:00:00.000Z");
    expect(points[0].mw).toBeCloseTo(((1000 + 2000 + 5000 + 5000) / 1000) * 0.013, 6);
  });

  it("builds RegionData", () => {
    expect(buildNewZealandData(parseEmiGenerationCsv(csv)).regionId).toBe("new-zealand");
  });
});
