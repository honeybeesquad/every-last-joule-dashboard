import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseRteEco2MixCsv, buildPerFuelRegion, type FranceOutput } from "../../src/data/france.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
const csv = readFileSync(join(__dirname, "../fixtures/france-sample.csv"), "utf8");

describe("france loader (per-fuel split)", () => {
  let result: FranceOutput;

  beforeAll(() => {
    // Direct unit test of the per-fuel construction path: parse CSV →
    // build per-fuel region. We bypass `run()` because it touches network;
    // the integration of fetchText + run is exercised by the live build.
    const { windPoints, solarPoints } = parseRteEco2MixCsv(csv);
    const SOLAR_RATE = 0.03;
    const WIND_RATE = 0.03;
    result = {
      "france-solar": buildPerFuelRegion(
        "france-solar",
        solarPoints,
        SOLAR_RATE,
        "RTE eco2mix solar (solaire) CSV × 3% calibrated curtailment (France 2024)",
      ),
      "france-wind": buildPerFuelRegion(
        "france-wind",
        windPoints,
        WIND_RATE,
        "RTE eco2mix wind (eolien_terrestre + eolien_offshore) CSV × 3% calibrated curtailment (France 2024)",
      ),
    };
  });

  it("parser separates wind and solar into distinct point arrays", () => {
    const { windPoints, solarPoints } = parseRteEco2MixCsv(csv);
    expect(windPoints.length).toBeGreaterThan(0);
    expect(solarPoints.length).toBeGreaterThan(0);
    // Hour 00 in fixture has wind = (1000+200)+(1100+200) = 2500 / 2 = 1250 avg MW
    expect(windPoints[0].utcTimestamp).toBe("2026-04-01T00:00:00.000Z");
    expect(windPoints[0].mw).toBeCloseTo(1250, 5);
    // Hour 00 in fixture has solar = (300+400)/2 = 350 avg MW
    expect(solarPoints[0].utcTimestamp).toBe("2026-04-01T00:00:00.000Z");
    expect(solarPoints[0].mw).toBeCloseTo(350, 5);
  });

  it("emits france-solar and france-wind keys", () => {
    expect(result["france-solar"]).toBeDefined();
    expect(result["france-wind"]).toBeDefined();
  });

  it("each region has a 24-value profile", () => {
    expect(result["france-solar"].profile.length).toBe(24);
    expect(result["france-wind"].profile.length).toBe(24);
  });

  it("regionId fields match keys", () => {
    expect(result["france-solar"].regionId).toBe("france-solar");
    expect(result["france-wind"].regionId).toBe("france-wind");
  });

  it("produces non-negative GW values for both fuels", () => {
    for (const gw of result["france-solar"].profile) expect(gw).toBeGreaterThanOrEqual(0);
    for (const gw of result["france-wind"].profile) expect(gw).toBeGreaterThanOrEqual(0);
  });

  it("fuelShare is hard-set to 100% for the assigned fuel", () => {
    expect(result["france-solar"].fuelShare).toEqual({ solar: 1, wind: 0 });
    expect(result["france-wind"].fuelShare).toEqual({ solar: 0, wind: 1 });
  });

  it("sourceNote mentions per-fuel calibration rate and the correct fuel", () => {
    expect(result["france-solar"].sourceNote).toContain("3% calibrated curtailment");
    expect(result["france-solar"].sourceNote).toContain("solar");
    expect(result["france-wind"].sourceNote).toContain("3% calibrated curtailment");
    expect(result["france-wind"].sourceNote).toContain("wind");
  });
});
