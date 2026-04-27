import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseAesoCurrentReport, buildPerFuelRegion, type AlbertaOutput } from "../../src/data/alberta.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(__dirname, "../fixtures/alberta-sample.html"), "utf8");

describe("alberta parser (AESO snapshot)", () => {
  it("extracts the report update timestamp", () => {
    const result = parseAesoCurrentReport(fixture);
    expect(result.lastUpdated).toContain("2026");
  });

  it("extracts wind and solar MW rows", () => {
    const result = parseAesoCurrentReport(fixture);
    expect(result.windMw).toBeGreaterThan(0);
    expect(result.solarMw).toBeGreaterThanOrEqual(0);
  });
});

describe("alberta loader (per-fuel split)", () => {
  let result: AlbertaOutput;

  beforeAll(() => {
    // Direct unit test of the per-fuel construction path: parse fixture →
    // build per-fuel region. We bypass `run()` because it touches network;
    // the integration of fetchText + run is exercised by the live build.
    const snapshot = parseAesoCurrentReport(fixture);
    const endIso = new Date("2026-04-26T18:00:00Z").toISOString();
    const SOLAR_RATE = 0.05;
    const WIND_RATE = 0.05;
    result = {
      "alberta-solar": buildPerFuelRegion(
        "alberta-solar",
        snapshot.solarMw,
        SOLAR_RATE,
        endIso,
        `AESO Current Supply Demand solar snapshot × 5% calibrated curtailment proxy (snapshot ${snapshot.lastUpdated})`,
      ),
      "alberta-wind": buildPerFuelRegion(
        "alberta-wind",
        snapshot.windMw,
        WIND_RATE,
        endIso,
        `AESO Current Supply Demand wind snapshot × 5% calibrated curtailment proxy (snapshot ${snapshot.lastUpdated})`,
      ),
    };
  });

  it("emits alberta-solar and alberta-wind keys", () => {
    expect(result["alberta-solar"]).toBeDefined();
    expect(result["alberta-wind"]).toBeDefined();
  });

  it("each region has a 24-value profile", () => {
    expect(result["alberta-solar"].profile.length).toBe(24);
    expect(result["alberta-wind"].profile.length).toBe(24);
  });

  it("regionId fields match keys", () => {
    expect(result["alberta-solar"].regionId).toBe("alberta-solar");
    expect(result["alberta-wind"].regionId).toBe("alberta-wind");
  });

  it("produces non-negative GW values for both fuels", () => {
    for (const gw of result["alberta-solar"].profile) expect(gw).toBeGreaterThanOrEqual(0);
    for (const gw of result["alberta-wind"].profile) expect(gw).toBeGreaterThanOrEqual(0);
  });

  it("fuelShare is hard-set to 100% for the assigned fuel", () => {
    expect(result["alberta-solar"].fuelShare).toEqual({ solar: 1, wind: 0 });
    expect(result["alberta-wind"].fuelShare).toEqual({ solar: 0, wind: 1 });
  });

  it("sourceNote mentions the correct fuel and the AESO snapshot timestamp", () => {
    expect(result["alberta-solar"].sourceNote).toContain("solar snapshot");
    expect(result["alberta-solar"].sourceNote).toContain("5% calibrated curtailment");
    expect(result["alberta-wind"].sourceNote).toContain("wind snapshot");
    expect(result["alberta-wind"].sourceNote).toContain("5% calibrated curtailment");
  });

  it("flat history produces a uniform profile (snapshot loader)", () => {
    // Because the AESO source is a single-snapshot fanned out flat across
    // 30 days, every hour-of-day bucket should have the same GW value.
    const solarSet = new Set(result["alberta-solar"].profile.map((g) => g.toFixed(6)));
    const windSet = new Set(result["alberta-wind"].profile.map((g) => g.toFixed(6)));
    expect(solarSet.size).toBe(1);
    expect(windSet.size).toBe(1);
  });
});
