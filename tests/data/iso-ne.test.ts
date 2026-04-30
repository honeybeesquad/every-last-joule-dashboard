import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseIsoNe } from "../../src/data/iso-ne.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(__dirname, "../fixtures/iso-ne-eia.json"), "utf8"));

describe("iso-ne parser (EIA proxy)", () => {
  it("returns valid RegionData with a 24-hour profile and dynamic fuelShare", () => {
    const result = parseIsoNe(fixture.wind, fixture.solar);
    expect(result.regionId).toBe("iso-ne");
    expect(result.profile.length).toBe(24);
    expect(result.profile.every((gw) => Number.isFinite(gw) && gw >= 0)).toBe(true);
    expect(result.peakGW).toBeCloseTo(Math.max(...result.profile), 3);
    expect(result.totalTWh).toBeGreaterThan(0);
    expect((result.fuelShare?.wind ?? 0) + (result.fuelShare?.solar ?? 0)).toBeCloseTo(1, 6);
  });
});
