import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAreaCsv } from "../../src/lib/japan-area-csv.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Kyushu (area 09) uses the shared eria_jukyu parser with dateFormat:"yyyymmdd"
 * (all fields double-quoted, dates as YYYYMMDD). The old ×10% calibration-rate
 * proxy (td_power_usages path) was retired 2026-06-07. Parser correctness for
 * this layout is fully covered by japan-area-csv.test.ts via
 * japan-area-quoted-yyyymmdd.csv.
 */
describe("kyushu loader (japan-kyushu, via shared eria_jukyu parser)", () => {
  it("parses the quoted+yyyymmdd fixture (Kyushu layout) via shared parser", () => {
    const text = readFileSync(join(__dirname, "../fixtures/japan-area-quoted-yyyymmdd.csv"), "utf8");
    const r = parseAreaCsv(text, { dateFormat: "yyyymmdd" });
    expect(r.sampleCount).toBe(2);
    expect(r.solarCurtMwSum).toBeGreaterThan(0);
    expect(r.points[0].intervalHours).toBeCloseTo(0.5, 6);
    for (const p of r.points) {
      expect(p.mw).toBeGreaterThanOrEqual(0);
    }
  });
});
