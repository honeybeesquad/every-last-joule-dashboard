import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseCaiso, parseCaisoOasisCurtailmentCsv } from "../../src/data/caiso.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
const solarFixture = JSON.parse(
  readFileSync(join(__dirname, "../fixtures/caiso-eia-solar.json"), "utf8")
);

// Synthesise a wind fixture by emitting a steady 1500 MWh/hr across all
// 24 hours. The test uses this to exercise the parseCaiso shape; per-fuel
// shape assertions are below. We don't have a real EIA wind-fixture file
// in the repo, and synthesising one keeps the test deterministic without
// adding ~50KB of historical wind data.
function makeWindFixture() {
  return {
    response: {
      total: 24,
      data: Array.from({ length: 24 }, (_, h) => ({
        period: `2026-04-25T${String(h).padStart(2, "0")}`,
        respondent: "CISO",
        fueltype: "WND",
        value: "1500",
      })),
    },
  };
}

describe("caiso parser (EIA proxy, per-fuel split)", () => {
  it("emits caiso-solar and caiso-wind keys", () => {
    const result = parseCaiso(solarFixture, makeWindFixture());
    expect(result["caiso-solar"]).toBeDefined();
    expect(result["caiso-wind"]).toBeDefined();
  });

  it("each region has a 24-value profile", () => {
    const result = parseCaiso(solarFixture, makeWindFixture());
    expect(result["caiso-solar"].profile.length).toBe(24);
    expect(result["caiso-wind"].profile.length).toBe(24);
  });

  it("regionId fields match keys", () => {
    const result = parseCaiso(solarFixture, makeWindFixture());
    expect(result["caiso-solar"].regionId).toBe("caiso-solar");
    expect(result["caiso-wind"].regionId).toBe("caiso-wind");
  });

  it("produces non-negative GW values for both fuels", () => {
    const result = parseCaiso(solarFixture, makeWindFixture());
    for (const gw of result["caiso-solar"].profile) expect(gw).toBeGreaterThanOrEqual(0);
    for (const gw of result["caiso-wind"].profile) expect(gw).toBeGreaterThanOrEqual(0);
  });

  it("fuelShare is hard-set to 100% for the assigned fuel", () => {
    const result = parseCaiso(solarFixture, makeWindFixture());
    expect(result["caiso-solar"].fuelShare).toEqual({ solar: 1, wind: 0 });
    expect(result["caiso-wind"].fuelShare).toEqual({ solar: 0, wind: 1 });
  });

  it("sourceNote mentions the per-fuel calibration rate", () => {
    const result = parseCaiso(solarFixture, makeWindFixture());
    expect(result["caiso-solar"].sourceNote).toContain("4.25");
    expect(result["caiso-solar"].sourceNote).toContain("solar");
    expect(result["caiso-wind"].sourceNote).toContain("4.20");
    expect(result["caiso-wind"].sourceNote).toContain("wind");
  });

  it("solar profile applies 4.25% rate to solar fixture", () => {
    const result = parseCaiso(solarFixture, makeWindFixture());
    const fixtureData = solarFixture.response.data as Array<{ value: string }>;
    const totalSolarMWh = fixtureData.reduce(
      (sum, r) => sum + Math.max(0, Number(r.value)),
      0
    );
    const expectedSolarTWh = (totalSolarMWh * 0.0425) / 1_000_000;
    expect(result["caiso-solar"].totalTWh).toBeCloseTo(expectedSolarTWh, 3);
  });

  it("solar duck curve: midday > overnight (sun-following)", () => {
    // Solar curtailment peaks midday (UTC ~19-22 ≈ 11:00-14:00 Pacific)
    // and is zero overnight. With per-fuel split, the solar profile MUST
    // be near-zero overnight (this was the original CAISO bug — wind
    // generation leaked under the solar label).
    const result = parseCaiso(solarFixture, makeWindFixture());
    const solar = result["caiso-solar"].profile;
    expect(solar[20]).toBeGreaterThan(solar[8]);
  });

  it("solar profile is near-zero overnight (no wind leak)", () => {
    // The point of the per-fuel split: solar curtailment SHOULD disappear
    // at California local night. Hours 8-13 UTC ≈ 1am-6am Pacific.
    // The fixture used here is a real EIA solar series, so overnight values
    // should be ≤ 5% of the daytime peak.
    const result = parseCaiso(solarFixture, makeWindFixture());
    const solar = result["caiso-solar"].profile;
    const peak = Math.max(...solar);
    const nightMax = Math.max(solar[8], solar[10], solar[12]);
    expect(nightMax).toBeLessThanOrEqual(peak * 0.05);
  });

  it("wind profile is decoupled from solar (overnight non-zero allowed)", () => {
    // Conversely, wind curtailment can be non-zero overnight — that's
    // CORRECT behaviour for wind, just wrong for solar. Synthetic fixture:
    // 1500 MWh per hour × 4.20% rate ≈ 63 MW per hour.
    const result = parseCaiso(solarFixture, makeWindFixture());
    const wind = result["caiso-wind"].profile;
    expect(wind[0]).toBeGreaterThan(0);
    expect(wind[12]).toBeGreaterThan(0);
  });
});

describe("caiso parser (OASIS direct, per-fuel split)", () => {
  const oasisCsv = readFileSync(join(__dirname, "../fixtures/caiso-oasis-curtailment.csv"), "utf8");

  it("parses solar and wind into separate region records", () => {
    const result = parseCaisoOasisCurtailmentCsv(oasisCsv);
    expect(result["caiso-solar"]).toBeDefined();
    expect(result["caiso-wind"]).toBeDefined();
    expect(result["caiso-solar"].regionId).toBe("caiso-solar");
    expect(result["caiso-wind"].regionId).toBe("caiso-wind");
  });

  it("solar totalTWh reflects only solar rows from fixture", () => {
    // Fixture has SOLAR rows totalling 50 + 75 = 125 MWh.
    const result = parseCaisoOasisCurtailmentCsv(oasisCsv);
    expect(result["caiso-solar"].totalTWh).toBeCloseTo(125 / 1_000_000, 6);
  });

  it("wind totalTWh reflects only wind rows from fixture", () => {
    // Fixture has WIND row totalling 20 MWh.
    const result = parseCaisoOasisCurtailmentCsv(oasisCsv);
    expect(result["caiso-wind"].totalTWh).toBeCloseTo(20 / 1_000_000, 6);
  });

  it("sourceNote describes the per-fuel direct path", () => {
    const result = parseCaisoOasisCurtailmentCsv(oasisCsv);
    expect(result["caiso-solar"].sourceNote).toContain("OASIS");
    expect(result["caiso-solar"].sourceNote).toContain("solar");
    expect(result["caiso-wind"].sourceNote).toContain("OASIS");
    expect(result["caiso-wind"].sourceNote).toContain("wind");
  });
});
