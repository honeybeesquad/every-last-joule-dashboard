import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseCoesGeneration } from "../../src/data/peru.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(__dirname, "../fixtures/peru-sample.json"), "utf8"),
);

describe("peru parser (COES proxy)", () => {
  it("returns non-empty hydro+solar+wind points", () => {
    const result = parseCoesGeneration(fixture);
    const total = result.hydroPoints.length + result.solarPoints.length + result.windPoints.length;
    expect(total).toBeGreaterThan(0);
  });

  it("produces non-negative curtailed MW values across all fuels", () => {
    const result = parseCoesGeneration(fixture);
    for (const pt of result.hydroPoints) expect(pt.mw).toBeGreaterThanOrEqual(0);
    for (const pt of result.solarPoints) expect(pt.mw).toBeGreaterThanOrEqual(0);
    for (const pt of result.windPoints) expect(pt.mw).toBeGreaterThanOrEqual(0);
  });

  it("contains some non-zero renewable signal across at least one fuel", () => {
    const result = parseCoesGeneration(fixture);
    const hasSignal =
      result.hydroPoints.some((p) => p.mw > 0) ||
      result.solarPoints.some((p) => p.mw > 0) ||
      result.windPoints.some((p) => p.mw > 0);
    expect(hasSignal).toBe(true);
  });
});