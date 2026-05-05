import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseSpp } from "../../src/data/spp.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(__dirname, "../fixtures/spp-eia.json"), "utf8"));

describe("spp parser (EIA proxy)", () => {
  it("returns valid RegionData with a 24-hour profile and dynamic fuelShare", () => {
    const result = parseSpp(fixture.wind, fixture.solar);
    expect(result.regionId).toBe("spp");
    expect(result.profile.length).toBe(24);
    expect(result.profile.every((gw) => Number.isFinite(gw) && gw >= 0)).toBe(true);
    expect(result.peakGW).toBeCloseTo(Math.max(...result.profile), 3);
    expect(result.totalTWh).toBeGreaterThan(0);
    expect((result.fuelShare?.wind ?? 0) + (result.fuelShare?.solar ?? 0)).toBeCloseTo(1, 6);
  });
});
