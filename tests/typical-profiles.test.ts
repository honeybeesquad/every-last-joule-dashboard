import { describe, expect, it } from "vitest";
import {
  solarProfile,
  windProfile,
  hydroProfile,
  buildTypicalSolarRegion,
  buildTypicalWindRegion,
  buildTypicalHydroRegion,
  buildTypicalHydroSeasonalRegion,
  seasonalScaleFactor,
  hydroSeasonalProfile,
  HYDRO_SEASONAL_SHARES,
} from "../src/lib/typical-profiles";

describe("typical profiles", () => {
  it("scales solar profile area to the requested annual TWh", () => {
    const profile = solarProfile(16.5, 5.9);
    const annualTWh = (profile.reduce((sum, gw) => sum + gw, 0) * 365) / 1000;
    expect(annualTWh).toBeCloseTo(5.9, 6);
  });

  it("peaks around the configured UTC solar noon", () => {
    const profile = solarProfile(16.5, 5.9);
    const peakHour = profile.indexOf(Math.max(...profile));
    expect(peakHour).toBe(16);
  });

  it("builds a RegionData payload for the Atacama fallback", () => {
    const region = buildTypicalSolarRegion("atacama", 16.5, 5.9, "test source");
    expect(region.regionId).toBe("atacama");
    expect(region.profile).toHaveLength(24);
    expect(region.totalTWh).toBeCloseTo((5.9 * 30) / 365, 6);
    expect(region.peakGW).toBeGreaterThan(0);
  });

  it("scales wind and hydro profiles to annual TWh", () => {
    const wind = windProfile(3, 0.5);
    const hydro = hydroProfile(10);
    expect((wind.reduce((sum, gw) => sum + gw, 0) * 365) / 1000).toBeCloseTo(0.5, 6);
    expect((hydro.reduce((sum, gw) => sum + gw, 0) * 365) / 1000).toBeCloseTo(10, 6);
  });

  it("builds wind and hydro RegionData payloads with null latest profiles", () => {
    const wind = buildTypicalWindRegion("argentina", 3, 0.5, "test source");
    const hydro = buildTypicalHydroRegion("paraguay", 10, "test source");
    expect(wind.profile).toHaveLength(24);
    expect(hydro.profile).toHaveLength(24);
    expect(wind.latestProfile).toBeNull();
    expect(hydro.latestProfile).toBeNull();
    expect(hydro.profile.every((v) => v === hydro.profile[0])).toBe(true);
  });

  describe("overnight (geothermal) profile", () => {
    it("is zero outside the window and non-zero inside", async () => {
      const { overnightProfile } = await import("../src/lib/typical-profiles");
      const p = overnightProfile(23.5, 2.5, 0.669);
      // Hours outside [21, 02] should all be zero.
      for (const hr of [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]) {
        expect(p[hr]).toBe(0);
      }
      // Hours inside the window should have positive values.
      expect(p[23]).toBeGreaterThan(0);
      expect(p[0]).toBeGreaterThan(0);
    });

    it("scales the full 24-hour profile to the requested annual TWh", async () => {
      const { overnightProfile } = await import("../src/lib/typical-profiles");
      const p = overnightProfile(23.5, 2.5, 0.669);
      const annual = (p.reduce((s, v) => s + v, 0) * 365) / 1000;
      expect(annual).toBeCloseTo(0.669, 3);
    });
  });

  describe("seasonal hydro", () => {
    it("HYDRO_SEASONAL_SHARES all sum to approximately 1.0", () => {
      for (const [key, shares] of Object.entries(HYDRO_SEASONAL_SHARES)) {
        const sum = shares.reduce((a, b) => a + b, 0);
        expect(sum, `${key} shares sum`).toBeCloseTo(1.0, 2);
      }
    });

    it("Sichuan factor is < 1 in January (dry season) and > 1 in July (peak monsoon)", () => {
      const jan = seasonalScaleFactor(HYDRO_SEASONAL_SHARES.sichuan, new Date(Date.UTC(2026, 0, 15)));
      const jul = seasonalScaleFactor(HYDRO_SEASONAL_SHARES.sichuan, new Date(Date.UTC(2026, 6, 15)));
      expect(jan).toBeLessThan(1);
      expect(jul).toBeGreaterThan(1);
      expect(jul).toBeGreaterThan(jan);
    });

    it("Paraguay (SH) factor is > 1 in January and < 1 in July (inverted vs NH)", () => {
      const jan = seasonalScaleFactor(HYDRO_SEASONAL_SHARES.paraguay, new Date(Date.UTC(2026, 0, 15)));
      const jul = seasonalScaleFactor(HYDRO_SEASONAL_SHARES.paraguay, new Date(Date.UTC(2026, 6, 15)));
      expect(jan).toBeGreaterThan(1);
      expect(jul).toBeLessThan(1);
    });

    it("hydroSeasonalProfile produces a flat 24h shape scaled by seasonal factor", () => {
      const now = new Date(Date.UTC(2026, 6, 15));
      const profile = hydroSeasonalProfile(30, HYDRO_SEASONAL_SHARES.sichuan, now);
      expect(profile).toHaveLength(24);
      expect(profile.every((v) => v === profile[0])).toBe(true);
      // July = monsoon peak, should exceed flat annual of 30000/8760 ≈ 3.42 GW.
      expect(profile[0]).toBeGreaterThan(5);
    });

    it("buildTypicalHydroSeasonalRegion annotates the sourceNote with the seasonal factor", () => {
      const region = buildTypicalHydroSeasonalRegion(
        "sichuan",
        30,
        HYDRO_SEASONAL_SHARES.sichuan,
        "base note",
        "2025",
        new Date(Date.UTC(2026, 6, 15)),
      );
      expect(region.sourceNote).toMatch(/seasonal factor [0-9.]+×/);
    });
  });
});
