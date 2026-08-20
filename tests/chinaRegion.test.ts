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

  it("uses the refreshed anchor but stays T3-modelled with honest provenance (no live promotion)", () => {
    writeFileSync(
      store,
      JSON.stringify({
        generatedAt: "2026-08-20T00:00:00Z",
        anchors: [{ regionId: "xinjiang-wind", annualTWh: 5.031, latestMonth: "2026-06", source: "ember x" }],
      }),
    );
    const r = buildChinaRegionFromAnchor("xinjiang-wind", "wind", 15, 5.0, "fallback note", store);
    // No tier promotion: still T3-modelled (typical shape scaled to a published anchor).
    expect(r.confidenceTier).toBe("T3-modelled");
    // Provenance is modelled-fallback, NOT verified (guide §5: a typical-shape
    // profile scaled to a published anchor is T3, never "verified").
    expect(r.sourceProvenance).toBe("modelled-fallback");
    // sourceStatus is cached (committed refreshed file, not a live fetch this build).
    expect(r.sourceStatus).toBe("cached");
    // lastSuccessAt derives from latestMonth, not Date.now().
    expect(r.lastSuccessAt).toBe("2026-06-01T00:00:00.000Z");
    // Anchor is fresher than the 5.0 fallback.
    expect(annual(r)).toBeCloseTo(5.031, 3);
    // Uncertainty envelope is recomputed and in-band (low <= peakGW <= high).
    expect(r.peakGW).toBeGreaterThanOrEqual(r.uncertaintyLowGW ?? 0);
    expect(r.peakGW).toBeLessThanOrEqual(r.uncertaintyHighGW ?? 0);
  });
});
