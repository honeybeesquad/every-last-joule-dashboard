import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseCaiso, parseCaisoOasisCurtailmentCsv } from "../../src/data/caiso.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(__dirname, "../fixtures/caiso-eia-solar.json"), "utf8")
);

describe("caiso parser (EIA proxy)", () => {
  it("returns profile of length 24", () => {
    const result = parseCaiso(fixture);
    expect(result.profile.length).toBe(24);
  });

  it("regionId is 'caiso'", () => {
    const result = parseCaiso(fixture);
    expect(result.regionId).toBe("caiso");
  });

  it("produces non-negative GW values", () => {
    const result = parseCaiso(fixture);
    for (const gw of result.profile) {
      expect(gw).toBeGreaterThanOrEqual(0);
    }
  });

  it("peakGW equals max of profile", () => {
    const result = parseCaiso(fixture);
    expect(result.peakGW).toBeCloseTo(Math.max(...result.profile), 3);
  });

  it("sourceNote mentions the 4.25% calibration", () => {
    const result = parseCaiso(fixture);
    expect(result.sourceNote).toContain("4.25");
  });

  it("applies the 4.25% rate, clamping negatives", () => {
    const result = parseCaiso(fixture);
    const fixtureData = fixture.response.data as Array<{ value: string }>;
    const totalSolarMWh = fixtureData.reduce(
      (sum, r) => sum + Math.max(0, Number(r.value)),
      0
    );
    const expectedCurtailmentTWh = (totalSolarMWh * 0.0425) / 1_000_000;
    expect(result.totalTWh).toBeCloseTo(expectedCurtailmentTWh, 3);
  });

  it("duck curve: midday profile exceeds overnight profile", () => {
    // CAISO solar curtailment peaks midday (UTC ~19-22 ≈ 11:00-14:00 Pacific)
    // and is zero overnight. Profile[20] should be well above profile[8].
    const result = parseCaiso(fixture);
    expect(result.profile[20]).toBeGreaterThan(result.profile[8]);
  });
});

describe("caiso parser (OASIS direct)", () => {
  const oasisCsv = readFileSync(join(__dirname, "../fixtures/caiso-oasis-curtailment.csv"), "utf8");

  it("parses direct wind+solar curtailment rows", () => {
    const result = parseCaisoOasisCurtailmentCsv(oasisCsv);
    expect(result.regionId).toBe("caiso");
    expect(result.sourceNote).toContain("direct");
    expect(result.totalTWh).toBeCloseTo(145 / 1_000_000, 6);
  });
});
