import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  parseEirgridDispatchDownSheet,
  parseEirgridRenewablesPage,
} from "../../src/data/ireland.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(__dirname, "../fixtures/ireland-sample.html"), "utf8");

describe("ireland parser (EirGrid page)", () => {
  it("extracts the page title", () => {
    const result = parseEirgridRenewablesPage(fixture);
    expect(result.title).toContain("Renewable");
    expect(result.dispatchDownWorkbookUrl).toContain("DD-HH-");
  });

  it("parses half-hourly dispatch-down MWh into MW points", () => {
    const sharedStrings = [
      "UT_TYPE",
      "JURISDICTION",
      "HH_TIMESTAMP",
      "GMT_OFFSET",
      "Sum of DD_MWH",
    ];
    const sheet = `
      <worksheet><sheetData>
        <row r="1">
          <c r="A1" t="s"><v>0</v></c>
          <c r="B1" t="s"><v>1</v></c>
          <c r="C1" t="s"><v>2</v></c>
          <c r="D1" t="s"><v>3</v></c>
          <c r="E1" t="s"><v>4</v></c>
        </row>
        <row r="2">
          <c r="A2" t="s"><v>0</v></c>
          <c r="B2" t="s"><v>1</v></c>
          <c r="C2"><v>46023</v></c>
          <c r="D2"><v>0</v></c>
          <c r="E2"><v>12.5</v></c>
        </row>
      </sheetData></worksheet>`;
    const points = parseEirgridDispatchDownSheet(sheet, sharedStrings);
    expect(points).toHaveLength(1);
    expect(points[0].mw).toBe(25);
    expect(points[0].intervalHours).toBe(0.5);
  });
});
