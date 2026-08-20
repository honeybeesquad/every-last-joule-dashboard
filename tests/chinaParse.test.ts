import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import {
  parseEmberMonthlyCsv,
  latestAnnualGeneration,
  regionIdFor,
  PROVINCE_TO_REGION,
  type Fuel,
} from "../src/lib/chinaParse.js";

const FIXTURE = join(process.cwd(), "tests", "fixtures", "china", "ember-monthly.csv");

// Hand-sum a (province, fuel) column straight from the fixture CSV so the
// parser's result is cross-checked against an independent read.
function sumFixtureColumn(province: string, fuelLabel: string): number {
  let sum = 0;
  for (const line of readFileSync(FIXTURE, "utf-8").split(/\r?\n/)) {
    const c = line.split(",");
    if (c[2] === province && c[5] === fuelLabel) sum += Number(c[7]);
  }
  return Math.round(sum * 1000) / 1000;
}

describe("chinaParse", () => {
  it("parses rows for the three fuels across provinces", () => {
    const rows = parseEmberMonthlyCsv(
      "Area,ISO 3 code,Province,Province code,Date,Electricity source,Is aggregated source,Generation (TWh)\n" +
        "China,CHN,Xinjiang,XJ,2024-01-01,Wind,False,5.0\n" +
        "China,CHN,Xinjiang,XJ,2024-01-01,Solar,False,3.2\n" +
        "China,CHN,Xinjiang,XJ,2024-02-01,Wind,False,4.8\n",
    );
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ province: "Xinjiang", fuel: "wind", generationTWh: 5.0 });
  });

  it("skips the header and unknown fuels", () => {
    const rows = parseEmberMonthlyCsv(
      "Area,ISO 3 code,Province,Province code,Date,Electricity source,Is aggregated source,Generation (TWh)\n" +
        "China,CHN,Xinjiang,XJ,2024-01-01,Wind,False,5.0\n" +
        "China,CHN,Xinjiang,XJ,2024-01-01,Total,False,99.0\n",
    );
    expect(rows).toHaveLength(1); // Total is not a dashboard fuel
  });

  it("annualises the trailing 12 months for a real fixture province", () => {
    const wind = latestAnnualGeneration(readFileSync(FIXTURE, "utf-8"), "Xinjiang", "wind" as Fuel);
    expect(wind).not.toBeNull();
    expect(wind!.annualTWh).toBeGreaterThan(0);
    expect(wind!.monthsCovered).toBe(12);
    expect(wind!.latestMonth).toBe("2024-12");
    expect(wind!.annualTWh).toBeCloseTo(sumFixtureColumn("Xinjiang", "Wind"), 3);
  });

  it("maps province+fuel to the dashboard region id", () => {
    expect(regionIdFor("Xinjiang", "wind" as Fuel)).toBe("xinjiang-wind");
    expect(regionIdFor("Shandong", "solar" as Fuel)).toBe("china-shandong-solar");
    expect(regionIdFor("Gansu", "hydro" as Fuel)).toBe("gansu-hydro");
  });

  it("throws on an unknown province", () => {
    expect(() => regionIdFor("Atlantis", "wind" as Fuel)).toThrow(/Unknown Ember province/);
  });

  it("returns null when no rows match", () => {
    expect(latestAnnualGeneration("", "Xinjiang", "wind" as Fuel)).toBeNull();
  });
});

void PROVINCE_TO_REGION;
