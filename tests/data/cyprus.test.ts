import { describe, expect, it } from "vitest";
import {
  buildCyprusRegion,
  SOURCE_NOTE_PREFIX,
} from "../../src/data/cyprus.json";
import type { CurtailmentPoint } from "../../src/lib/types";

/**
 * Synthetic ENTSO-E-shaped input. The real loader reads A75 actual solar
 * generation for the Cyprus bidding zone at PT30M; these fixtures reproduce
 * that cadence without touching the network, so the suite stays hermetic.
 */
function solarDay(dayIso: string, peakMw: number): CurtailmentPoint[] {
  const points: CurtailmentPoint[] = [];
  for (let hour = 0; hour < 24; hour++) {
    // Daylight bump centred on 10:00 UTC (Cyprus is UTC+3).
    const daylight = Math.max(0, Math.cos(((hour + 0.5 - 10) / 12) * Math.PI)) ** 1.8;
    for (const minute of [0, 30]) {
      points.push({
        utcTimestamp: `${dayIso}T${String(hour).padStart(2, "0")}:${minute === 0 ? "00" : "30"}:00.000Z`,
        mw: peakMw * daylight,
        intervalHours: 0.5,
      });
    }
  }
  return points;
}

function window(days: number, peakMw: number): CurtailmentPoint[] {
  const out: CurtailmentPoint[] = [];
  for (let d = 1; d <= days; d++) {
    out.push(...solarDay(`2026-08-${String(d).padStart(2, "0")}`, peakMw));
  }
  return out;
}

describe("cyprus loader", () => {
  const data = buildCyprusRegion(window(30, 700));

  it("returns a valid positive RegionData shape", () => {
    expect(data.regionId).toBe("cyprus");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
  });

  it("stays T3-modelled — the magnitude is an anchor, not a measurement", () => {
    expect(data.confidenceTier).toBe("T3-modelled");
    expect(data.sourceNote).toContain(SOURCE_NOTE_PREFIX);
    expect(data.sourceNote).toContain("T3-modelled");
  });

  it("integrates to the published 0.15 TWh/yr anchor", () => {
    const dailyGWh = data.profile.reduce((sum, gw) => sum + gw, 0);
    expect((dailyGWh * 365) / 1000).toBeCloseTo(0.15, 9);
    expect(data.totalTWh).toBeCloseTo((0.15 * 30) / 365, 12);
  });

  it("keeps a solar diurnal shape — night hours are effectively zero", () => {
    const peak = Math.max(...data.profile);
    expect(data.profile.indexOf(peak)).toBeGreaterThanOrEqual(5);
    expect(data.profile.indexOf(peak)).toBeLessThanOrEqual(14);
    for (const hour of [0, 1, 2, 22, 23]) {
      expect(data.profile[hour]).toBeLessThan(peak * 0.05);
    }
  });

  it("emits the measured generation companion and cannot curtail more than it generates", () => {
    expect(data.generationProfile).toHaveLength(24);
    expect(data.generationTotalTWh).toBeGreaterThanOrEqual(data.totalTWh);
  });

  it("throws on an empty window rather than emitting a flat profile", () => {
    expect(() => buildCyprusRegion([])).toThrow(/no points/);
  });

  it("throws when the window covers too few days", () => {
    expect(() => buildCyprusRegion(window(10, 700))).toThrow(/distinct days/);
  });

  it("throws on the near-zero feed months rather than shipping the collapse", () => {
    // 2026-02 / 2026-04 / 2026-07 reported peak hour-of-day means of
    // 20.5 / 8.9 / 11.3 MW against a fleet demonstrably capable of 761 MW.
    expect(() => buildCyprusRegion(window(30, 20))).toThrow(/plausibility floor/);
  });

  it("throws when the peak hour is not in the daylight band", () => {
    const nocturnal = window(30, 700).map((p) => ({
      ...p,
      // Shift every timestamp 12 hours so the peak lands near midnight UTC.
      utcTimestamp: new Date(new Date(p.utcTimestamp).getTime() + 12 * 3600 * 1000).toISOString(),
    }));
    expect(() => buildCyprusRegion(nocturnal)).toThrow(/daylight band/);
  });
});
