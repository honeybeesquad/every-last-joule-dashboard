import { describe, expect, it } from "vitest";
import { buildSouthKoreaData } from "../../src/data/south-korea.json";

// Anchored constants (must stay in sync with src/data/south-korea.json.ts).
// Curtailed = Ember/OWID 2025 generation × published 2024 rate (MDPI/IEA).
const SOLAR_GEN_TWH = 37.80;
const SOLAR_RATE = 0.032;
const WIND_GEN_TWH = 3.64;
const WIND_RATE = 0.041;
const SOLAR_CURTAILED_TWH = Math.round(SOLAR_GEN_TWH * SOLAR_RATE * 1000) / 1000; // 1.210
const WIND_CURTAILED_TWH = Math.round(WIND_GEN_TWH * WIND_RATE * 1000) / 1000; // 0.149

describe("south-korea loader", () => {
  it("returns valid positive solar + wind RegionData (mainland anchor)", async () => {
    const { solar, wind } = await buildSouthKoreaData();

    expect(solar.regionId).toBe("south-korea-solar");
    expect(solar.profile).toHaveLength(24);
    expect(solar.latestProfile).toBeNull();
    expect(solar.totalTWh).toBeGreaterThan(0);
    expect(solar.peakGW).toBeGreaterThan(0);
    expect(solar.sourceNote).toContain("mainland");
    // Forensic honesty check: solar must read 0 at local night (KST midnight = 15 UTC).
    expect(solar.profile[15]).toBe(0);
    // Curtailed energy must equal generation × published rate (annualised from 30d window).
    expect(solar.totalTWh * 365 / 30).toBeCloseTo(SOLAR_CURTAILED_TWH, 3);

    expect(wind.regionId).toBe("south-korea-wind");
    expect(wind.profile).toHaveLength(24);
    expect(wind.totalTWh).toBeGreaterThan(0);
    expect(wind.peakGW).toBeGreaterThan(0);
    expect(wind.sourceNote).toContain("mainland");
    expect(wind.totalTWh * 365 / 30).toBeCloseTo(WIND_CURTAILED_TWH, 3);
  });
});
