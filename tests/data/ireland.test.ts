import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseEirgridRenewablesPage } from "../../src/data/ireland.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(__dirname, "../fixtures/ireland-sample.html"), "utf8");

describe("ireland parser (EirGrid page)", () => {
  it("extracts the page title", () => {
    const result = parseEirgridRenewablesPage(fixture);
    expect(result.title).toContain("Renewable");
  });
});
