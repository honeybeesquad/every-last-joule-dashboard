import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAreaCsv } from "../../src/lib/japan-area-csv.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Chubu (area 04) uses the shared eria_jukyu parser (Shift-JIS, 22-col, slash dates).
 * parseChubuCsv / buildChubuRegionData were retired when the loader migrated
 * from the dead juyo_cepco003.csv proxy to direct measured curtailment (2026-06-07).
 * Parser correctness for this layout is covered by japan-area-csv.test.ts
 * (the japan-area-22col.csv fixture). This file confirms the 22-col layout
 * parses correctly via the shared parser.
 */
describe("chubu loader (japan-chubu, via shared eria_jukyu parser)", () => {
  it("parses the 22-col Shift-JIS fixture used by Chubu (shared parser smoke test)", () => {
    const text = readFileSync(join(__dirname, "../fixtures/japan-area-22col.csv"), "utf8");
    const r = parseAreaCsv(text, { dateFormat: "slash" });
    expect(r.sampleCount).toBe(2);
    expect(r.solarCurtMwSum).toBeGreaterThan(0);
    expect(r.points[0].intervalHours).toBeCloseTo(0.5, 6);
    for (const p of r.points) {
      expect(p.mw).toBeGreaterThanOrEqual(0);
    }
  });
});
