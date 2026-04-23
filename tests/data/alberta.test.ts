import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseAesoCurrentReport } from "../../src/data/alberta.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(__dirname, "../fixtures/alberta-sample.html"), "utf8");

describe("alberta parser (AESO snapshot)", () => {
  it("extracts the report update timestamp", () => {
    const result = parseAesoCurrentReport(fixture);
    expect(result.lastUpdated).toContain("2026");
  });

  it("extracts wind and solar MW rows", () => {
    const result = parseAesoCurrentReport(fixture);
    expect(result.windMw).toBeGreaterThan(0);
    expect(result.solarMw).toBeGreaterThanOrEqual(0);
  });
});
