import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseEskomDataPortal } from "../../src/data/south-africa.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(__dirname, "../fixtures/south-africa-sample.html"), "utf8");

describe("south africa parser (Eskom portal)", () => {
  it("extracts the portal title", () => {
    const result = parseEskomDataPortal(fixture);
    expect(result.title).toContain("Eskom Data Portal");
  });
});
