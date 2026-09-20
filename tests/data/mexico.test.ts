import { describe, expect, it } from "vitest";
import { buildMexicoData, buildMexicoPoints } from "../../src/data/mexico.json";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CSV_PATH = join(process.cwd(), "data/historical/mexico-generacion.csv");

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
      expect(r.sourceStatus).toBe("cached");
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
