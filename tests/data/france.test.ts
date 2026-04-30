import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { buildFranceData, parseRteEco2MixCsv } from "../../src/data/france.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
const csv = readFileSync(join(__dirname, "../fixtures/france-sample.csv"), "utf8");

describe("france parser", () => {
  it("sums wind and solar from RTE eco2mix and applies 3%", () => {
    const { points } = parseRteEco2MixCsv(csv);
    expect(points[0].utcTimestamp).toBe("2026-04-01T00:00:00.000Z");
    expect(points[0].mw).toBeCloseTo(((1500 * 0.03) + (1700 * 0.03)) / 2, 5);
  });

  it("builds RegionData", () => {
    expect(buildFranceData(parseRteEco2MixCsv(csv)).regionId).toBe("france");
  });

  it("emits wind/solar fuelShare totals", () => {
    const { windMwTotal, solarMwTotal } = parseRteEco2MixCsv(csv);
    expect(windMwTotal).toBeGreaterThan(0);
    expect(solarMwTotal).toBeGreaterThan(0);
  });
});
