import { describe, it, expect, beforeAll } from "vitest";
import { parseEnerginetPayload, buildPerFuelRegion, type DenmarkOutput } from "../../src/data/denmark.json";

// Mock JSON data for Energinet (similar to the structure returned by fetchJSON)
const MOCK_ENERGINET_RESPONSE: { records: Array<Record<string, string | number | null>> } = {
  records: Array.from({ length: 24 }, (_, hour) => {
    const isDay = hour >= 6 && hour <= 18; // Daytime for solar

    const windMwh = 800 + Math.sin(hour / 24 * Math.PI * 2) * 200; // Fluctuating wind
    const solarMwh = isDay ? (100 + Math.sin((hour - 6) / 12 * Math.PI) * 1000) : 0; // Solar during day

    const record: Record<string, string | number | null> = {
      HourUTC: `2026-04-26T${String(hour).padStart(2, "0")}:00:00`,
      OffshoreWindLt100MW_MWh: windMwh * 0.1,
      OffshoreWindGe100MW_MWh: windMwh * 0.4,
      OnshoreWindLt50kW_MWh: windMwh * 0.2,
      OnshoreWindGe50kW_MWh: windMwh * 0.3,
      SolarPowerLt10kW_MWh: solarMwh * 0.25,
      SolarPowerGe10Lt40kW_MWh: solarMwh * 0.25,
      SolarPowerGe40kW_MWh: solarMwh * 0.25,
      SolarPowerSelfConMWh: solarMwh * 0.25,
    };
    return record;
  }),
};

describe("denmark loader (per-fuel split)", () => {
  let result: DenmarkOutput;

  beforeAll(() => {
    // Direct unit test of the per-fuel construction path: parse payload →
    // build per-fuel region. We bypass `run()` because it touches network;
    // the integration of fetchJSON + run is exercised by the live build.
    const { windPoints, solarPoints } = parseEnerginetPayload(MOCK_ENERGINET_RESPONSE);

    const SOLAR_RATE = 0.04; // As defined in denmark.json.ts
    const WIND_RATE = 0.04; // As defined in denmark.json.ts

    result = {
      "denmark-solar": buildPerFuelRegion(
        "denmark-solar",
        solarPoints,
        SOLAR_RATE,
        "Energinet solar data × 4% calibrated curtailment (Denmark 2024)",
      ),
      "denmark-wind": buildPerFuelRegion(
        "denmark-wind",
        windPoints,
        WIND_RATE,
        "Energinet wind data × 4% calibrated curtailment (Denmark 2024)",
      ),
    };
  });

  it("emits denmark-solar and denmark-wind keys", () => {
    expect(result["denmark-solar"]).toBeDefined();
    expect(result["denmark-wind"]).toBeDefined();
  });

  it("each region has a 24-value profile", () => {
    expect(result["denmark-solar"].profile.length).toBe(24);
    expect(result["denmark-wind"].profile.length).toBe(24);
  });

  it("regionId fields match keys", () => {
    expect(result["denmark-solar"].regionId).toBe("denmark-solar");
    expect(result["denmark-wind"].regionId).toBe("denmark-wind");
  });

  it("produces non-negative GW values for both fuels", () => {
    for (const gw of result["denmark-solar"].profile) expect(gw).toBeGreaterThanOrEqual(0);
    for (const gw of result["denmark-wind"].profile) expect(gw).toBeGreaterThanOrEqual(0);
  });

  it("fuelShare is hard-set to 100% for the assigned fuel", () => {
    expect(result["denmark-solar"].fuelShare).toEqual({ solar: 1, wind: 0 });
    expect(result["denmark-wind"].fuelShare).toEqual({ solar: 0, wind: 1 });
  });

  it("sourceNote mentions the per-fuel calibration rate", () => {
    expect(result["denmark-solar"].sourceNote).toContain("4% calibrated curtailment");
    expect(result["denmark-solar"].sourceNote).toContain("solar");
    expect(result["denmark-wind"].sourceNote).toContain("4% calibrated curtailment");
    expect(result["denmark-wind"].sourceNote).toContain("wind");
  });

  it("solar profile is near-zero overnight (sun-following)", () => {
    const solar = result["denmark-solar"].profile;
    const peak = Math.max(...solar);
    // Based on MOCK_ENERGINET_RESPONSE, solar is 0 between hours 0-5 and 19-23.
    const nightHours = [...solar.slice(0, 6), ...solar.slice(19, 24)];
    const nightMax = Math.max(...nightHours);
    expect(nightMax).toBeLessThanOrEqual(peak * 0.05); // Should be very low compared to peak
  });

  it("wind profile is decoupled from solar (overnight non-zero allowed)", () => {
    const wind = result["denmark-wind"].profile;
    // Based on MOCK_ENERGINET_RESPONSE, wind is active all 24 hours.
    expect(wind[0]).toBeGreaterThan(0);
    expect(wind[12]).toBeGreaterThan(0);
    expect(wind[23]).toBeGreaterThan(0);
  });
});
