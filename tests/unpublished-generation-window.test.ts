import { describe, expect, it } from "vitest";
import { unpublishedGenerationRegion } from "../src/lib/waste-status";
import type { CurtailmentPoint } from "../src/lib/types";

// An append-only relay (PREPA's hourly snapshots) passes the whole file in.
// generationTotalTWh must stay a 30-day figure however long the file grows.
function hourly(startIso: string, hours: number, mw: number): CurtailmentPoint[] {
  return Array.from({ length: hours }, (_, i) => ({
    utcTimestamp: new Date(Date.parse(startIso) + i * 3_600_000).toISOString(),
    mw,
  }));
}

describe("unpublishedGenerationRegion", () => {
  it("sums only the trailing 30 days of a longer file", () => {
    const r = unpublishedGenerationRegion("test-region", "solar", hourly("2026-01-01T00:00:00Z", 200 * 24, 1000), "note");
    // 1,000 MW for 720 h = 0.72 TWh, not 200 days' 4.8 TWh.
    expect(r.generationTotalTWh).toBeCloseTo(0.72, 3);
    expect(r.lastUpdated).toBe("2026-07-19T23:00:00.000Z");
  });

  it("leaves a window shorter than 30 days unchanged", () => {
    const pts = hourly("2026-01-01T00:00:00Z", 26 * 24, 1000);
    const r = unpublishedGenerationRegion("test-region", "solar", pts, "note");
    expect(r.generationTotalTWh).toBeCloseTo((26 * 24 * 1000) / 1_000_000, 6);
  });
});
