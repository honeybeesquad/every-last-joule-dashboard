import { describe, it, expect } from "vitest";
import { timeOfDayAverageGW, totalTWh30d, peakGW } from "../src/lib/profile";
import { ehsFromGW, ASIC_JPER_TH } from "../src/lib/calc";
import type { CurtailmentPoint } from "../src/lib/types";

// All expected values below are exactly representable in float64 from the
// given inputs, so assertions use toBe (exact), not toBeCloseTo. A failure
// here means a conversion constant changed — a real accuracy bug, not a
// flaky test.

function hourPoint(hour: number, mw: number, intervalHours?: number): CurtailmentPoint {
  return {
    utcTimestamp: `2026-01-01T${String(hour).padStart(2, "0")}:00:00Z`,
    mw,
    ...(intervalHours !== undefined ? { intervalHours } : {}),
  };
}

describe("MW → GW (timeOfDayAverageGW)", () => {
  it("1000 MW in every hour is exactly 1.0 GW in every slot", () => {
    const points = Array.from({ length: 24 }, (_, h) => hourPoint(h, 1000));
    const profile = timeOfDayAverageGW(points);
    expect(profile).toHaveLength(24);
    for (const v of profile) expect(v).toBe(1);
  });

  it("sub-hourly points average within the hour bucket: (1000+2000)/2 MW = 1.5 GW", () => {
    const points = [hourPoint(0, 1000), hourPoint(0, 2000)];
    expect(timeOfDayAverageGW(points)[0]).toBe(1.5);
  });

  it("hours with no points are exactly 0", () => {
    const profile = timeOfDayAverageGW([hourPoint(5, 1000)]);
    expect(profile[4]).toBe(0);
    expect(profile[5]).toBe(1);
    expect(profile[6]).toBe(0);
  });
});

describe("MWh → TWh (totalTWh30d)", () => {
  it("24 points of 1000 MW × 1h = 24,000 MWh = 0.024 TWh exactly", () => {
    const points = Array.from({ length: 24 }, (_, h) => hourPoint(h, 1000));
    expect(totalTWh30d(points)).toBe(0.024);
  });

  it("intervalHours scales energy: 500 MW × 0.5h = 250 MWh = 0.00025 TWh exactly", () => {
    expect(totalTWh30d([hourPoint(0, 500, 0.5)])).toBe(0.00025);
  });

  it("defaultIntervalHours applies when points omit intervalHours", () => {
    // 1000 MW × 0.25h default = 250 MWh = 0.00025 TWh
    expect(totalTWh30d([hourPoint(0, 1000)], 0.25)).toBe(0.00025);
  });
});

describe("peakGW", () => {
  it("returns the max hourly bucket exactly", () => {
    const points = [hourPoint(0, 1000), hourPoint(1, 2000), hourPoint(2, 500)];
    expect(peakGW(points)).toBe(2);
  });
});

describe("GW → EH/s (ehsFromGW)", () => {
  it("1 GW at 16 J/TH = exactly 62.5 EH/s (derivation: GW × 1000/eff)", () => {
    expect(ehsFromGW(1, 16)).toBe(62.5);
  });

  it("2 GW at 20 J/TH = exactly 100 EH/s", () => {
    expect(ehsFromGW(2, 20)).toBe(100);
  });

  it("default efficiency is the headline ASIC assumption (16 J/TH)", () => {
    expect(ASIC_JPER_TH).toBe(16);
    expect(ehsFromGW(1)).toBe(62.5);
  });

  it("non-positive power yields exactly 0", () => {
    expect(ehsFromGW(0)).toBe(0);
    expect(ehsFromGW(-1)).toBe(0);
  });
});
