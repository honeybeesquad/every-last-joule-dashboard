import { describe, it, expect, beforeAll } from "vitest";
import { parseEliaCsv, buildPerFuelRegion, type BelgiumOutput } from "../../src/data/belgium.json";

// Mock CSV data for solar (values representing daytime generation)
const MOCK_SOLAR_CSV = `datetime;realtime;mostrecentforecast
2026-04-26T00:00:00.000Z;0;0
2026-04-26T01:00:00.000Z;0;0
2026-04-26T02:00:00.000Z;0;0
2026-04-26T03:00:00.000Z;0;0
2026-04-26T04:00:00.000Z;100;100
2026-04-26T05:00:00.000Z;500;500
2026-04-26T06:00:00.000Z;1000;1000
2026-04-26T07:00:00.000Z;1500;1500
2026-04-26T08:00:00.000Z;2000;2000
2026-04-26T09:00:00.000Z;2500;2500
2026-04-26T10:00:00.000Z;2800;2800
2026-04-26T11:00:00.000Z;3000;3000
2026-04-26T12:00:00.000Z;2900;2900
2026-04-26T13:00:00.000Z;2500;2500
2026-04-26T14:00:00.000Z;2000;2000
2026-04-26T15:00:00.000Z;1500;1500
2026-04-26T16:00:00.000Z;1000;1000
2026-04-26T17:00:00.000Z;500;500
2026-04-26T18:00:00.000Z;100;100
2026-04-26T19:00:00.000Z;0;0
2026-04-26T20:00:00.000Z;0;0
2026-04-26T21:00:00.000Z;0;0
2026-04-26T22:00:00.000Z;0;0
2026-04-26T23:00:00.000Z;0;0
`;

// Mock CSV data for wind (values representing consistent generation, including overnight)
const MOCK_WIND_CSV = `datetime;realtime;mostrecentforecast
2026-04-26T00:00:00.000Z;800;800
2026-04-26T01:00:00.000Z;850;850
2026-04-26T02:00:00.000Z;900;900
2026-04-26T03:00:00.000Z;920;920
2026-04-26T04:00:00.000Z;900;900
2026-04-26T05:00:00.000Z;880;880
2026-04-26T06:00:00.000Z;850;850
2026-04-26T07:00:00.000Z;800;800
2026-04-26T08:00:00.000Z;750;750
2026-04-26T09:00:00.000Z;700;700
2026-04-26T10:00:00.000Z;650;650
2026-04-26T11:00:00.000Z;600;600
2026-04-26T12:00:00.000Z;550;550
2026-04-26T13:00:00.000Z;500;500
2026-04-26T14:00:00.000Z;450;450
2026-04-26T15:00:00.000Z;400;400
2026-04-26T16:00:00.000Z;350;350
2026-04-26T17:00:00.000Z;300;300
2026-04-26T18:00:00.000Z;350;350
2026-04-26T19:00:00.000Z;400;400
2026-04-26T20:00:00.000Z;500;500
2026-04-26T21:00:00.000Z;600;600
2026-04-26T22:00:00.000Z;700;700
2026-04-26T23:00:00.000Z;750;750
`;

describe("belgium loader (per-fuel split)", () => {
  let result: BelgiumOutput;

  beforeAll(() => {
    // Direct unit test of the per-fuel construction path: parse CSV →
    // build per-fuel region. We bypass `run()` because it touches network;
    // the integration of fetchText + run is exercised by the live build.
    const solarPoints = parseEliaCsv(MOCK_SOLAR_CSV);
    const windPoints = parseEliaCsv(MOCK_WIND_CSV);
    const SOLAR_RATE = 0.02;
    const WIND_RATE = 0.02;

    result = {
      "belgium-solar": buildPerFuelRegion(
        "belgium-solar",
        solarPoints,
        SOLAR_RATE,
        "Elia solar realtime CSV × 2% calibrated curtailment (Belgium 2024)",
      ),
      "belgium-wind": buildPerFuelRegion(
        "belgium-wind",
        windPoints,
        WIND_RATE,
        "Elia wind realtime CSV × 2% calibrated curtailment (Belgium 2024)",
      ),
    };
  });

  it("emits belgium-solar and belgium-wind keys", () => {
    expect(result["belgium-solar"]).toBeDefined();
    expect(result["belgium-wind"]).toBeDefined();
  });

  it("each region has a 24-value profile", () => {
    expect(result["belgium-solar"].profile.length).toBe(24);
    expect(result["belgium-wind"].profile.length).toBe(24);
  });

  it("regionId fields match keys", () => {
    expect(result["belgium-solar"].regionId).toBe("belgium-solar");
    expect(result["belgium-wind"].regionId).toBe("belgium-wind");
  });

  it("produces non-negative GW values for both fuels", () => {
    for (const gw of result["belgium-solar"].profile) expect(gw).toBeGreaterThanOrEqual(0);
    for (const gw of result["belgium-wind"].profile) expect(gw).toBeGreaterThanOrEqual(0);
  });

  it("fuelShare is hard-set to 100% for the assigned fuel", () => {
    expect(result["belgium-solar"].fuelShare).toEqual({ solar: 1, wind: 0 });
    expect(result["belgium-wind"].fuelShare).toEqual({ solar: 0, wind: 1 });
  });

  it("sourceNote mentions the per-fuel calibration rate", () => {
    expect(result["belgium-solar"].sourceNote).toContain("2% calibrated curtailment");
    expect(result["belgium-solar"].sourceNote).toContain("solar");
    expect(result["belgium-wind"].sourceNote).toContain("2% calibrated curtailment");
    expect(result["belgium-wind"].sourceNote).toContain("wind");
  });

  it("solar profile is near-zero overnight (sun-following)", () => {
    const solar = result["belgium-solar"].profile;
    const peak = Math.max(...solar);
    // Assuming overnight hours are UTC 0-3 and 19-23 based on mock data
    const nightHours = [...solar.slice(0, 4), ...solar.slice(19, 24)];
    const nightMax = Math.max(...nightHours);
    expect(nightMax).toBeLessThanOrEqual(peak * 0.05); // Should be very low compared to peak
  });

  it("wind profile is decoupled from solar (overnight non-zero allowed)", () => {
    const wind = result["belgium-wind"].profile;
    // Check some overnight hours to ensure they are non-zero based on mock data
    expect(wind[0]).toBeGreaterThan(0);
    expect(wind[1]).toBeGreaterThan(0);
    expect(wind[22]).toBeGreaterThan(0);
    expect(wind[23]).toBeGreaterThan(0);
  });
});
