import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import {
  computeCurtailedEnergy,
  isPlausibleDailyGwh,
  MAX_PLAUSIBLE_DAILY_GWH,
  readStateCsvTotal,
} from "../../src/lib/india-gen-re.js";

const HIST = join(process.cwd(), "data", "historical");

describe("CEA daily GWh plausibility", () => {
  it("rejects the 2025-10-14 Excel serial date if treated as energy", () => {
    expect(isPlausibleDailyGwh(45944)).toBe(false);
    expect(isPlausibleDailyGwh(239.64)).toBe(true);
    expect(isPlausibleDailyGwh(MAX_PLAUSIBLE_DAILY_GWH)).toBe(true);
    expect(isPlausibleDailyGwh(MAX_PLAUSIBLE_DAILY_GWH + 0.01)).toBe(false);
  });

  it("drops an implausible solar cell from the trailing-365 sum", () => {
    const csv = [
      "date,wind_gwh,solar_gwh",
      "2026-01-01,1,2",
      ...Array.from({ length: 40 }, (_, i) => `2026-02-${String(i + 1).padStart(2, "0")},1,2`),
      "2025-10-14,8,45944",
    ].join("\n");
    const tmp = join(HIST, ".tmp-india-plausibility.csv");
    writeFileSync(tmp, csv);
    try {
      const tot = readStateCsvTotal(tmp, 365);
      expect(tot).not.toBeNull();
      expect(tot!.nRows).toBe(41);
      expect(tot!.solarTWh).toBeCloseTo(82 / 1000, 6);
    } finally {
      unlinkSync(tmp);
    }
  });
});

describe("committed India CEA CSVs", () => {
  it("has 12 dashboard states plus the east residual, none carrying 45944", () => {
    const keys = [
      "rajasthan", "gujarat", "tamil-nadu", "andhra-pradesh", "maharashtra",
      "karnataka", "madhya-pradesh", "telangana", "uttar-pradesh", "punjab",
      "odisha", "chhattisgarh", "east",
    ];
    for (const key of keys) {
      const path = join(HIST, `india-${key}-gen-daily.csv`);
      const tot = readStateCsvTotal(path, 365);
      expect(tot, key).not.toBeNull();
      expect(tot!.nRows, key).toBeGreaterThanOrEqual(365);
      const text = readFileSync(path, "utf-8");
      expect(text, key).not.toMatch(/45944/);
      const oct14 = text.split("\n").find((line) => line.startsWith("2025-10-14,"));
      expect(oct14, key).toBeTruthy();
      const solar = Number(oct14!.split(",")[2]);
      expect(solar, key).toBeLessThan(MAX_PLAUSIBLE_DAILY_GWH);
    }
  });

  it("Rajasthan trailing-365 solar is the clean ~71 TWh, not the 98 TWh serial-inflated figure", () => {
    const tot = readStateCsvTotal(join(HIST, "india-rajasthan-gen-daily.csv"), 365);
    expect(tot).not.toBeNull();
    expect(tot!.solarTWh).toBeGreaterThan(60);
    expect(tot!.solarTWh).toBeLessThan(80);
    const curtailed = computeCurtailedEnergy(tot!.solarTWh, 0.06);
    expect(curtailed).toBeGreaterThan(4);
    expect(curtailed).toBeLessThan(5);
  });

  it("Odisha CEA series is solar, not wind", () => {
    const tot = readStateCsvTotal(join(HIST, "india-odisha-gen-daily.csv"), 365);
    expect(tot).not.toBeNull();
    expect(tot!.windTWh).toBe(0);
    expect(tot!.solarTWh).toBeGreaterThan(0.4);
  });

  it("Karnataka CSV is present so the loader is not on the 0.5 TWh stub", () => {
    const tot = readStateCsvTotal(join(HIST, "india-karnataka-gen-daily.csv"), 365);
    expect(tot).not.toBeNull();
    expect(tot!.solarTWh).toBeGreaterThan(10);
  });
});
