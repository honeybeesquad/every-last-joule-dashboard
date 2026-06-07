import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAreaCsv } from "../../src/lib/japan-area-csv.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Shikoku (area 08) uses the shared eria_jukyu parser (Shift-JIS, 20-col, slash dates).
 * The old current-day-only daily proxy (×7% rate) was retired 2026-06-07.
 */
describe("shikoku loader (japan-shikoku, via shared eria_jukyu parser)", () => {
  it("parses the 20-col Shift-JIS fixture (Shikoku layout) via shared parser", () => {
    const text = readFileSync(join(__dirname, "../fixtures/japan-area-20col.csv"), "utf8");
    const r = parseAreaCsv(text, { dateFormat: "slash" });
    expect(r.sampleCount).toBe(2);
    expect(r.solarCurtMwSum).toBeGreaterThan(0);
    expect(r.points[0].intervalHours).toBeCloseTo(0.5, 6);
    for (const p of r.points) expect(p.mw).toBeGreaterThanOrEqual(0);
  });
});
