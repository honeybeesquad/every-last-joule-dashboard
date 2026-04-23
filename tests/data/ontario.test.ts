import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseOntarioXml } from "../../src/data/ontario.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(__dirname, "../fixtures/ontario-sample.xml"), "utf8");

describe("ontario parser (IESO proxy)", () => {
  it("returns hourly points plus per-fuel MW totals", () => {
    const result = parseOntarioXml(fixture);
    expect(result.points.length).toBeGreaterThan(0);
    expect(result.points.length).toBeLessThanOrEqual(24);
    expect(result.windMwTotal).toBeGreaterThanOrEqual(0);
    expect(result.solarMwTotal).toBeGreaterThanOrEqual(0);
  });

  it("produces non-negative curtailed MW values", () => {
    const result = parseOntarioXml(fixture);
    for (const point of result.points) {
      expect(point.mw).toBeGreaterThanOrEqual(0);
    }
  });

  it("captures a real profile rather than all zeros", () => {
    const result = parseOntarioXml(fixture);
    expect(result.points.some((point) => point.mw > 0)).toBe(true);
  });
});
