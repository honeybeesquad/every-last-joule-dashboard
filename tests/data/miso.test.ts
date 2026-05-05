import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseMiso } from "../../src/data/miso.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(__dirname, "../fixtures/miso-eia.json"), "utf8"));

describe("miso parser (EIA proxy)", () => {
  it("returns wind and solar RegionData with 24-hour profiles", () => {
    const result = parseMiso(fixture.wind, fixture.solar);
    expect(result.wind.regionId).toBe("miso-wind");
    expect(result.solar.regionId).toBe("miso-solar");
    expect(result.wind.profile.length).toBe(24);
    expect(result.solar.profile.length).toBe(24);
    expect(result.wind.profile.every((gw) => Number.isFinite(gw) && gw >= 0)).toBe(true);
    expect(result.solar.profile.every((gw) => Number.isFinite(gw) && gw >= 0)).toBe(true);
    expect(result.wind.peakGW).toBeCloseTo(Math.max(...result.wind.profile), 3);
    expect(result.solar.peakGW).toBeCloseTo(Math.max(...result.solar.profile), 3);
    expect(result.wind.totalTWh).toBeGreaterThan(0);
    expect(result.solar.totalTWh).toBeGreaterThan(0);
    expect(result.wind.fuelShare).toBeUndefined();
    expect(result.solar.fuelShare).toBeUndefined();
  });
});
