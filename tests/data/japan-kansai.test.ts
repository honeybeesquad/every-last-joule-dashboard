import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAreaCsv } from "../../src/lib/japan-area-csv.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Kansai (area 06) uses the shared eria_jukyu parser (Shift-JIS, 20-col, slash dates).
 * The old live-only daily juyo1_kansai.csv proxy (×1% rate) was retired 2026-06-07.
 */
describe("kansai loader (japan-kansai, via shared eria_jukyu parser)", () => {
  it("parses the 20-col Shift-JIS fixture (Kansai layout) via shared parser", () => {
    const text = readFileSync(join(__dirname, "../fixtures/japan-area-20col.csv"), "utf8");
    const r = parseAreaCsv(text, { dateFormat: "slash" });
    expect(r.sampleCount).toBe(2);
    expect(r.solarCurtMwSum).toBeGreaterThan(0);
    expect(r.points[0].intervalHours).toBeCloseTo(0.5, 6);
    for (const p of r.points) expect(p.mw).toBeGreaterThanOrEqual(0);
  });
});
