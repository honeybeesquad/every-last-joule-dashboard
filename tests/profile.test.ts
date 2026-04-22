import { describe, it, expect } from "vitest";
import { timeOfDayAverageGW, totalTWh30d, peakGW } from "../src/lib/profile";
import type { CurtailmentPoint } from "../src/lib/types";

function pointsAt(hour: number, mw: number, days = 30): CurtailmentPoint[] {
  // Emits one point at HH:00 UTC on each of the last `days` days.
  const now = new Date("2026-04-22T00:00:00Z");
  const out: CurtailmentPoint[] = [];
  for (let d = 0; d < days; d++) {
    const dt = new Date(now);
    dt.setUTCDate(now.getUTCDate() - d);
    dt.setUTCHours(hour, 0, 0, 0);
    out.push({ utcTimestamp: dt.toISOString(), mw });
  }
  return out;
}

describe("timeOfDayAverageGW", () => {
  it("returns 24 values", () => {
    const profile = timeOfDayAverageGW([]);
    expect(profile.length).toBe(24);
  });

  it("empty input yields all-zero profile", () => {
    const profile = timeOfDayAverageGW([]);
    expect(profile.every(v => v === 0)).toBe(true);
  });

  it("constant-MW at one hour yields matching GW only at that hour", () => {
    const points = pointsAt(12, 3000); // 3000 MW at 12:00 UTC, 30 days
    const profile = timeOfDayAverageGW(points);
    expect(profile[12]).toBeCloseTo(3.0, 3); // 3000 MW = 3 GW
    expect(profile[0]).toBe(0);
    expect(profile[23]).toBe(0);
  });

  it("averages across days correctly", () => {
    // 30 days, values alternating 1000 MW and 2000 MW at 12:00
    const points: CurtailmentPoint[] = [];
    for (let d = 0; d < 30; d++) {
      const dt = new Date("2026-04-22T12:00:00Z");
      dt.setUTCDate(dt.getUTCDate() - d);
      points.push({ utcTimestamp: dt.toISOString(), mw: d % 2 === 0 ? 1000 : 2000 });
    }
    const profile = timeOfDayAverageGW(points);
    expect(profile[12]).toBeCloseTo(1.5, 3); // avg of 1000 and 2000 = 1500 MW = 1.5 GW
  });
});

describe("totalTWh30d", () => {
  it("constant 1000 MW for 30 days at one hour each day ≈ 0.03 TWh", () => {
    const points = pointsAt(12, 1000); // 1 GW * 1 hour * 30 days = 30 GWh = 0.03 TWh
    const result = totalTWh30d(points);
    expect(result).toBeCloseTo(0.03, 3);
  });

  it("empty input yields 0", () => {
    expect(totalTWh30d([])).toBe(0);
  });
});

describe("peakGW", () => {
  it("returns max across profile", () => {
    const points = [
      ...pointsAt(0, 1000),
      ...pointsAt(12, 5000),
      ...pointsAt(18, 3000)
    ];
    expect(peakGW(points)).toBeCloseTo(5.0, 3);
  });

  it("empty input yields 0", () => {
    expect(peakGW([])).toBe(0);
  });
});
