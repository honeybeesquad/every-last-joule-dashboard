import { describe, expect, it } from "vitest";
import { buildMexicoData, buildMexicoPoints } from "../../src/data/mexico.json";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { relayFreshness, RELAY_STALENESS_THRESHOLD_DAYS } from "../../src/lib/freshness";

const CSV_PATH = join(process.cwd(), "data/historical/mexico-generacion.csv");

// The abed relay appends to this file, so derive the expected freshness from its
// last row instead of pinning the 2026-05-31 snapshot's "degraded".
function csvLastTimestamp(): string {
  const [date, hour] = readFileSync(CSV_PATH, "utf8").trim().split("\n").at(-1)!.split(",");
  return `${date}T${String(Number(hour)).padStart(2, "0")}:00:00Z`;
}

describe("mexico loader", () => {
  it("emits unpublished waste and measured CENACE generation", async () => {
    const data = await buildMexicoData();
    for (const [fuel, id] of [
      ["solar", "mexico-solar"],
      ["wind", "mexico-wind"],
    ] as const) {
      const r = data[fuel];
      expect(r.regionId).toBe(id);
      expect(r.profile).toHaveLength(24);
      expect(r.profile.every((v) => v === 0)).toBe(true);
      expect(r.totalTWh).toBe(0);
      expect(r.wasteStatus).toBe("unpublished");
      expect(r.generationProfile).toHaveLength(24);
      expect(r.generationTotalTWh).toBeGreaterThan(0);
      expect(r.confidenceTier).toBe("T3-modelled");
      const last = csvLastTimestamp();
      expect(r.lastUpdated).toBe(last);
      expect(r.sourceStatus).toBe(relayFreshness(last, new Date(), RELAY_STALENESS_THRESHOLD_DAYS));
      expect(r.sourceProvenance).toBe("official-lead");
    }
    expect(data.solar.generationTotalTWh).toBeGreaterThan(0);
  });

  it("throws (does not silently zero the region) on a degenerate zero-area shape", async () => {
    expect(() => buildMexicoPoints([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 0.8)).toThrow();
  });

  it("has a committed CENACE relay CSV", () => {
    expect(existsSync(CSV_PATH)).toBe(true);
    const lines = readFileSync(CSV_PATH, "utf8").trim().split("\n");
    expect(lines.length).toBeGreaterThan(168);
  });
});
