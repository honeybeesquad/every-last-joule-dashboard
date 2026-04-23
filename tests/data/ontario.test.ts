import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseOntarioXml } from "../../src/data/ontario.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(__dirname, "../fixtures/ontario-sample.xml"), "utf8");

describe("ontario parser (IESO proxy)", () => {
  it("returns hourly wind points", () => {
    const result = parseOntarioXml(fixture);
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(24);
  });

  it("produces non-negative curtailed MW values", () => {
    const result = parseOntarioXml(fixture);
    for (const point of result) {
      expect(point.mw).toBeGreaterThanOrEqual(0);
    }
  });

  it("captures a real wind profile rather than all zeros", () => {
    const result = parseOntarioXml(fixture);
    expect(result.some((point) => point.mw > 0)).toBe(true);
  });
});
