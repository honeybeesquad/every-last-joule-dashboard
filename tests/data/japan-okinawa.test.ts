import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAreaCsv } from "../../src/lib/japan-area-csv.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Okinawa (area 10) was already reading direct eria_jukyu curtailment columns.
 * Folded onto the shared runJapanAreaLoader in Phase 2 (2026-06-07) for
 * consistency. No behaviour change; snapshot and region record unchanged.
 */
describe("okinawa loader (japan-okinawa, via shared eria_jukyu parser)", () => {
  it("parses the 22-col Shift-JIS fixture (Okinawa layout) via shared parser", () => {
    const text = readFileSync(join(__dirname, "../fixtures/japan-area-22col.csv"), "utf8");
    const r = parseAreaCsv(text, { dateFormat: "slash" });
    expect(r.sampleCount).toBe(2);
    expect(r.solarCurtMwSum).toBeGreaterThan(0);
    expect(r.points[0].intervalHours).toBeCloseTo(0.5, 6);
    for (const p of r.points) expect(p.mw).toBeGreaterThanOrEqual(0);
  });
});
