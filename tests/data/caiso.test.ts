import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseCaisoPerFuel } from "../../src/data/caiso.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(__dirname, "../fixtures/caiso-eia-solar.json"), "utf8")
);

describe("caiso parser (EIA proxy)", () => {
  it("returns separate wind and solar RegionData", () => {
    const result = parseCaisoPerFuel(fixture);
    expect(result.solar.regionId).toBe("caiso-solar");
    expect(result.wind.regionId).toBe("caiso-wind");
  });

  it("returns profile of length 24 for each fuel", () => {
    const result = parseCaisoPerFuel(fixture);
    expect(result.solar.profile.length).toBe(24);
    expect(result.wind.profile.length).toBe(24);
  });

  it("produces non-negative GW values", () => {
    const result = parseCaisoPerFuel(fixture);
    for (const gw of result.solar.profile) {
      expect(gw).toBeGreaterThanOrEqual(0);
    }
    for (const gw of result.wind.profile) {
      expect(gw).toBeGreaterThanOrEqual(0);
    }
  });

  it("peakGW equals max of profile for each fuel", () => {
    const result = parseCaisoPerFuel(fixture);
    expect(result.solar.peakGW).toBeCloseTo(Math.max(...result.solar.profile), 3);
    expect(result.wind.peakGW).toBeCloseTo(Math.max(...result.wind.profile), 3);
  });

  it("sourceNote mentions the per-fuel calibration rates", () => {
    const result = parseCaisoPerFuel(fixture);
    expect(result.solar.sourceNote).toContain("4.25");
    expect(result.wind.sourceNote).toContain("4.2");
  });

  it("applies the correct per-fuel rates", () => {
    const result = parseCaisoPerFuel(fixture);
    const fixtureData = fixture.response.data as Array<{ value: string }>;
    const totalSolarMWh = fixtureData.reduce(
      (sum, r) => sum + Math.max(0, Number(r.value)),
      0
    );
    const expectedSolarCurtailmentTWh = (totalSolarMWh * 0.0425) / 1_000_000;
    expect(result.solar.totalTWh).toBeCloseTo(expectedSolarCurtailmentTWh, 3);
  });
});