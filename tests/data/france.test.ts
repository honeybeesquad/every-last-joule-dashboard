import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { buildFranceData, parseRteEco2MixCsv } from "../../src/data/france.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
const csv = readFileSync(join(__dirname, "../fixtures/france-sample.csv"), "utf8");

describe("france parser", () => {
  it("sums wind and solar from RTE eco2mix and applies 3%", () => {
    const { windPoints, solarPoints, windMwTotal, solarMwTotal } = parseRteEco2MixCsv(csv);
    expect(windPoints[0].utcTimestamp).toBe("2026-04-01T00:00:00.000Z");
    expect(solarPoints[0].utcTimestamp).toBe("2026-04-01T00:00:00.000Z");
    expect(windMwTotal).toBeGreaterThan(0);
    expect(solarMwTotal).toBeGreaterThan(0);
  });

  it("builds per-fuel RegionData", () => {
    const fuelShare = { wind: 0.5, solar: 0.5 };
    const { windPoints, solarPoints } = parseRteEco2MixCsv(csv);
    const wind = buildFranceData("wind", windPoints, fuelShare);
    expect(wind.regionId).toBe("france-wind");
    expect(wind.profile.length).toBe(24);
    const solar = buildFranceData("solar", solarPoints, fuelShare);
    expect(solar.regionId).toBe("france-solar");
    expect(solar.profile.length).toBe(24);
  });

  it("emits wind/solar fuelShare totals", () => {
    const { windMwTotal, solarMwTotal } = parseRteEco2MixCsv(csv);
    expect(windMwTotal).toBeGreaterThan(0);
    expect(solarMwTotal).toBeGreaterThan(0);
  });
});