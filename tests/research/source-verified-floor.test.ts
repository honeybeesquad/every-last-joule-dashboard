import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");

function parseCsv(text: string): Record<string, string>[] {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(",");
  return lines.map((line) => {
    const cells: string[] = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && quoted && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = !quoted;
      } else if (ch === "," && !quoted) {
        cells.push(cell);
        cell = "";
      } else {
        cell += ch;
      }
    }
    cells.push(cell);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

describe("source-verified annual floor", () => {
  const rows = parseCsv(readFileSync(join(ROOT, "data/source-verified-floor/2025.csv"), "utf8"));

  it("publishes only positive source-verified Brazil ONS and Chile CEN rows for 2025", () => {
    expect(rows).toHaveLength(18);
    expect(new Set(rows.map((row) => row.country))).toEqual(new Set(["BRA", "CHL"]));
    expect(rows.every((row) => row.year === "2025")).toBe(true);
    expect(rows.every((row) => Number(row.curtailed_energy_twh) > 0)).toBe(true);
    expect(rows.every((row) => row.source_tier === "source_verified_annual_floor")).toBe(true);
    expect(rows.some((row) => row.region_id === "chile-sen-solar")).toBe(true);
    expect(rows.some((row) => row.region_id === "chile-wind")).toBe(true);
    expect(rows.some((row) => row.region_id === "uruguay")).toBe(false);
  });

  it("uses frustrated generation rather than the limited-setpoint diagnostic", () => {
    const brazilRows = rows.filter((row) => row.country === "BRA");
    expect(brazilRows.every((row) => row.source_field_formula.includes("val_geracaoreferenciafinal - val_geracao"))).toBe(true);
    expect(brazilRows.every((row) => !row.source_field_formula.includes("val_geracaolimitada"))).toBe(true);
  });

  it("uses Chile CEN hourly MWh reductions without a proxy multiplier", () => {
    const chileRows = rows.filter((row) => row.country === "CHL");
    expect(chileRows).toHaveLength(2);
    expect(chileRows.every((row) => row.source_field_formula.includes("plant-level hourly MWh reductions"))).toBe(true);
    expect(chileRows.every((row) => row.calendar_coverage.includes("12 monthly CEN workbooks"))).toBe(true);
    expect(chileRows.every((row) => !row.notes.toLowerCase().includes("proxy"))).toBe(true);
  });

  it("matches the Brazil and Chile 2025 reconciliation totals", () => {
    const total = rows.reduce((sum, row) => sum + Number(row.curtailed_energy_twh), 0);
    const brazilTotal = rows
      .filter((row) => row.country === "BRA")
      .reduce((sum, row) => sum + Number(row.curtailed_energy_twh), 0);
    const chileTotal = rows
      .filter((row) => row.country === "CHL")
      .reduce((sum, row) => sum + Number(row.curtailed_energy_twh), 0);
    expect(brazilTotal).toBeCloseTo(3.807811, 6);
    expect(chileTotal).toBeCloseTo(6.025218, 6);
    expect(total).toBeCloseTo(9.833029, 6);
  });
});
