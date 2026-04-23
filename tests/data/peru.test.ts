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
  it("returns non-empty hourly points", () => {
    const result = parseCoesGeneration(fixture);
    expect(result.length).toBeGreaterThan(0);
  });

  it("produces non-negative curtailed MW values", () => {
    const result = parseCoesGeneration(fixture);
    for (const point of result) {
      expect(point.mw).toBeGreaterThanOrEqual(0);
    }
  });

  it("contains some non-zero renewable signal", () => {
    const result = parseCoesGeneration(fixture);
    expect(result.some((point) => point.mw > 0)).toBe(true);
  });
});
