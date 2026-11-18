import { describe, expect, it } from "vitest";
import { argentinaGenerationTWh, buildArgentinaData, CAMMESA_INTERVAL_HOURS } from "../../src/data/argentina.json";
import type { CurtailmentPoint } from "../../src/lib/types";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { relayFreshness, RELAY_STALENESS_THRESHOLD_DAYS } from "../../src/lib/freshness";

// The abed relay appends to this file daily, so derive what the loader should
// say from the file instead of pinning the June 2026 week.
function csvWindow(): { last: string; spanDays: number } {
  const stamps = readFileSync(join(process.cwd(), "data/historical/argentina-cammesa.csv"), "utf8")
    .trim().split("\n").slice(1).map((l) => Date.parse(l.split(",")[0])).filter(Number.isFinite);
  const max = stamps.reduce((m, t) => (t > m ? t : m), -Infinity);
  const inWindow = stamps.filter((t) => t > max - 30 * 86_400_000);
  return {
    last: new Date(max).toISOString().replace(".000Z", "Z"),
    spanDays: (max - inWindow.reduce((m, t) => (t < m ? t : m), Infinity)) / 86_400_000,
  };
}

describe("argentina loader", () => {
  it("returns unpublished waste and a 30-day generation figure from the relay file", async () => {
    const data = await buildArgentinaData();
    const win = csvWindow();
    expect(data.regionId).toBe("argentina");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBe(0);
    expect(data.profile.every((v) => v === 0)).toBe(true);
    expect(data.wasteStatus).toBe("unpublished");
    expect(data.generationProfile).toHaveLength(24);
    expect(data.confidenceTier).toBe("T3-modelled");
    expect(data.lastUpdated).toBe(win.last);
    expect(data.sourceStatus).toBe(relayFreshness(win.last, new Date(), RELAY_STALENESS_THRESHOLD_DAYS));
    // Treating each 5-minute row as an hour counted the June week at about 4.3 TWh;
    // a full month of Argentine wind is about 1.5 TWh.
    expect(data.generationTotalTWh!).toBeGreaterThan(0);
    expect(data.generationTotalTWh!).toBeLessThan(3);
    if (win.spanDays < 25) {
      const fromProfile = (data.generationProfile!.reduce((sum, gw) => sum + gw, 0) * 30) / 1000;
      expect(data.generationTotalTWh).toBeCloseTo(fromProfile, 6);
      expect(data.sourceNote).toMatch(/diurnal mean extended across 30 days/);
    } else {
      expect(data.sourceNote).not.toMatch(/diurnal mean extended/);
    }
  });

  it("sums a 30-day window at 5 minutes, not as one hour per row", () => {
    const points: CurtailmentPoint[] = [];
    const start = Date.parse("2026-01-01T00:00:00Z");
    // 30 days of 5-minute rows at a flat 1,200 MW. True energy is 1,200 MW × 720 h.
    const steps = 30 * 24 * 12;
    for (let i = 0; i < steps; i++) {
      points.push({
        utcTimestamp: new Date(start + i * 5 * 60 * 1000).toISOString(),
        mw: 1200,
      });
    }
    const twh = argentinaGenerationTWh(points);
    const trueTwh = (1200 * 30 * 24) / 1_000_000;
    const hourMiscount = trueTwh / CAMMESA_INTERVAL_HOURS;
    expect(twh).toBeCloseTo(trueTwh, 4);
    expect(hourMiscount / twh).toBeCloseTo(12, 4);
  });
});
