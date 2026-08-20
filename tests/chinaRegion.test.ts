import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildChinaRegionFromAnchor } from "../src/lib/chinaParse.js";

const dir = mkdtempSync(join(tmpdir(), "china-build-"));
const store = join(dir, "china-anchors.json");
afterAll(() => rmSync(dir, { recursive: true, force: true }));

// RegionData stores 30d totalTWh; annual = totalTWh * 365/30.
const annual = (r: { totalTWh: number }) => (r.totalTWh * 365) / 30;

describe("buildChinaRegionFromAnchor", () => {
  it("falls back to estimated tier when the store is absent", () => {
    const r = buildChinaRegionFromAnchor("xinjiang-wind", "wind", 15, 5.0, "fallback note", store);
    expect(r.confidenceTier).toBe("T3-modelled");
    expect(annual(r)).toBeCloseTo(5.0, 1);
  });

  it("promotes to T1b when a live anchor exists", () => {
    writeFileSync(
      store,
      JSON.stringify({
        generatedAt: "2026-08-20T00:00:00Z",
        anchors: [{ regionId: "xinjiang-wind", annualTWh: 5.031, latestMonth: "2024-12", source: "ember x" }],
      }),
    );
    const r = buildChinaRegionFromAnchor("xinjiang-wind", "wind", 15, 5.0, "fallback note", store);
    expect(r.confidenceTier).toBe("T1b-live-domestic-anchored");
    expect(r.sourceProvenance).toBe("verified");
    expect(r.sourceStatus).toBe("live");
    expect(annual(r)).toBeCloseTo(5.031, 3);
    expect(r.totalTWh).toBeCloseTo((5.031 * 30) / 365, 4);
  });
});
