import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAreaCsv } from "../../src/lib/japan-area-csv.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * TEPCO (area 03) uses the shared eria_jukyu parser (UTF-8, 20-col, slash dates).
 * parseTepcoCsv / buildTepcoRegionData were retired when the loader migrated
 * from a 5-min proxy (×1% rate) to direct measured curtailment (2026-06-07).
 * Parser correctness for this layout is covered by japan-area-csv.test.ts
 * (the japan-area-20col.csv fixture). This file confirms the fixture loads
 * correctly via the shared parser with TEPCO's encoding/format.
 */
describe("tepco loader (japan-tepco, via shared eria_jukyu parser)", () => {
  it("parses the 20-col UTF-8 fixture used by TEPCO (shared parser smoke test)", () => {
    const text = readFileSync(join(__dirname, "../fixtures/japan-area-20col.csv"), "utf8");
    const r = parseAreaCsv(text, { dateFormat: "slash" });
    expect(r.sampleCount).toBe(2);
    expect(r.solarCurtMwSum).toBeGreaterThan(0);
    expect(r.points[0].intervalHours).toBeCloseTo(0.5, 6);
    for (const p of r.points) {
      expect(p.mw).toBeGreaterThanOrEqual(0);
    }
  });
});
