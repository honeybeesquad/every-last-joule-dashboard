import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseNorthSea, buildPerFuelRegion, type NorthSeaOutput } from "../../src/data/north-sea.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(__dirname, "../fixtures/uk-bmrs-agws.json"), "utf8")
);

describe("north-sea loader (per-fuel split)", () => {
  let result: NorthSeaOutput;

  beforeAll(() => {
    // Direct unit test of the per-fuel construction path: parse pages →
    // build per-fuel region. We bypass `run()` because it touches network;
    // the integration of fetchJSON + run is exercised by the live build.
    const { windPoints, solarPoints } = parseNorthSea([fixture]);
    const SOLAR_RATE = 0.069;
    const WIND_RATE = 0.069;
    result = {
      "north-sea-solar": buildPerFuelRegion(
        "north-sea-solar",
        solarPoints,
        SOLAR_RATE,
        "Elexon BMRS AGWS Solar × 6.9% calibrated curtailment (UK 2024 actuals: 6.6 TWh / 95 TWh)",
      ),
      "north-sea-wind": buildPerFuelRegion(
        "north-sea-wind",
        windPoints,
        WIND_RATE,
        "Elexon BMRS AGWS Wind Onshore+Offshore × 6.9% calibrated curtailment (UK 2024 actuals: 6.6 TWh / 95 TWh)",
      ),
    };
  });

  it("parser produces non-empty wind and solar point arrays", () => {
    const { windPoints, solarPoints } = parseNorthSea([fixture]);
    expect(windPoints.length).toBeGreaterThan(0);
    expect(solarPoints.length).toBeGreaterThan(0);
    // Each fuel array has unique timestamps
    expect(new Set(windPoints.map((p) => p.utcTimestamp)).size).toBe(windPoints.length);
    expect(new Set(solarPoints.map((p) => p.utcTimestamp)).size).toBe(solarPoints.length);
  });

  it("parser emits wind and solar separately (no double-counting)", () => {
    const { windPoints, solarPoints } = parseNorthSea([fixture]);
    const windRaw = windPoints.reduce((s, p) => s + p.mw, 0);
    const solarRaw = solarPoints.reduce((s, p) => s + p.mw, 0);
    // Sum should match the raw quantities of psrType filtered fixture rows
    const expectedWind = fixture.data
      .filter((r: { psrType: string; quantity: number }) =>
        r.psrType === "Wind Onshore" || r.psrType === "Wind Offshore",
      )
      .reduce((s: number, r: { quantity: number }) => s + Math.max(0, Number(r.quantity) || 0), 0);
    const expectedSolar = fixture.data
      .filter((r: { psrType: string; quantity: number }) => r.psrType === "Solar")
      .reduce((s: number, r: { quantity: number }) => s + Math.max(0, Number(r.quantity) || 0), 0);
    expect(windRaw).toBeCloseTo(expectedWind, 2);
    expect(solarRaw).toBeCloseTo(expectedSolar, 2);
  });

  it("parser timestamps are chronologically ordered per fuel", () => {
    const { windPoints, solarPoints } = parseNorthSea([fixture]);
    for (let i = 1; i < windPoints.length; i++) {
      expect(new Date(windPoints[i].utcTimestamp).getTime()).toBeGreaterThanOrEqual(
        new Date(windPoints[i - 1].utcTimestamp).getTime(),
      );
    }
    for (let i = 1; i < solarPoints.length; i++) {
      expect(new Date(solarPoints[i].utcTimestamp).getTime()).toBeGreaterThanOrEqual(
        new Date(solarPoints[i - 1].utcTimestamp).getTime(),
      );
    }
  });

  it("emits north-sea-solar and north-sea-wind keys", () => {
    expect(result["north-sea-solar"]).toBeDefined();
    expect(result["north-sea-wind"]).toBeDefined();
  });

  it("each region has a 24-value profile", () => {
    expect(result["north-sea-solar"].profile.length).toBe(24);
    expect(result["north-sea-wind"].profile.length).toBe(24);
  });

  it("regionId fields match keys", () => {
    expect(result["north-sea-solar"].regionId).toBe("north-sea-solar");
    expect(result["north-sea-wind"].regionId).toBe("north-sea-wind");
  });

  it("produces non-negative GW values for both fuels", () => {
    for (const gw of result["north-sea-solar"].profile) expect(gw).toBeGreaterThanOrEqual(0);
    for (const gw of result["north-sea-wind"].profile) expect(gw).toBeGreaterThanOrEqual(0);
  });

  it("fuelShare is hard-set to 100% for the assigned fuel", () => {
    expect(result["north-sea-solar"].fuelShare).toEqual({ solar: 1, wind: 0 });
    expect(result["north-sea-wind"].fuelShare).toEqual({ solar: 0, wind: 1 });
  });

  it("sourceNote mentions per-fuel calibration rate and the correct fuel", () => {
    expect(result["north-sea-solar"].sourceNote).toContain("6.9% calibrated curtailment");
    expect(result["north-sea-solar"].sourceNote).toContain("Solar");
    expect(result["north-sea-wind"].sourceNote).toContain("6.9% calibrated curtailment");
    expect(result["north-sea-wind"].sourceNote).toContain("Wind");
  });
});
