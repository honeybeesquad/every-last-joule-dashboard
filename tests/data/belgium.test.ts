import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { buildBelgiumData, parseEliaCsv } from "../../src/data/belgium.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
const csv = readFileSync(join(__dirname, "../fixtures/belgium-sample.csv"), "utf8");

describe("belgium parser", () => {
  it("parses Elia semicolon CSV and applies 2% calibration", () => {
    const points = parseEliaCsv(csv);
    expect(points[0]).toEqual({ utcTimestamp: "2026-04-01T00:00:00.000Z", mw: 2 });
    expect(points[1].mw).toBe(1);
  });

  it("builds per-fuel RegionData", () => {
    const fuelShare = { wind: 0.17, solar: 0.83 };
    const data = buildBelgiumData("wind", parseEliaCsv(csv), fuelShare);
    expect(data.regionId).toBe("belgium-wind");
    expect(data.profile.length).toBe(24);
    const solar = buildBelgiumData("solar", parseEliaCsv(csv), fuelShare);
    expect(solar.regionId).toBe("belgium-solar");
    expect(solar.profile.length).toBe(24);
  });
});