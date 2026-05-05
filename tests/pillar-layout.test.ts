import { describe, expect, test } from "vitest";
import { buildPillarUnits, PILLAR_SEPARATION_PX } from "../src/lib/pillar-layout";

const r = (id: string, lat: number, lon: number, kind: string) => ({ id, lat, lon, kind });

describe("buildPillarUnits", () => {
  test("single-kind bucket renders as one unit at offset 0", () => {
    const units = buildPillarUnits([r("germany-wind", 51.0, 10.0, "wind")]);
    expect(units).toHaveLength(1);
    expect(units[0].offsetPx).toBe(0);
    expect(units[0].regions.map((x) => x.id)).toEqual(["germany-wind"]);
  });

  test("co-located wind+solar split into two units >=40px apart", () => {
    const units = buildPillarUnits([
      r("spain-solar", 40.4168, -3.7038, "solar"),
      r("spain-wind", 40.4168, -3.7038, "wind"),
    ]);
    expect(units).toHaveLength(2);
    const wind = units.find((u) => u.regions[0].id === "spain-wind")!;
    const solar = units.find((u) => u.regions[0].id === "spain-solar")!;
    expect(Math.abs(solar.offsetPx - wind.offsetPx)).toBeGreaterThanOrEqual(40);
    expect(Math.abs(solar.offsetPx - wind.offsetPx)).toBe(PILLAR_SEPARATION_PX);
  });

  test("wind sorts left of solar in any pair (deterministic)", () => {
    const units = buildPillarUnits([
      r("spain-solar", 40.4168, -3.7038, "solar"),
      r("spain-wind", 40.4168, -3.7038, "wind"),
    ]);
    const wind = units.find((u) => u.regions[0].id === "spain-wind")!;
    const solar = units.find((u) => u.regions[0].id === "spain-solar")!;
    expect(wind.offsetPx).toBeLessThan(solar.offsetPx);
  });

  test("three-kind bucket spreads at 44px increments centred on 0", () => {
    const units = buildPillarUnits([
      r("x-hydro", 0, 0, "hydro"),
      r("x-solar", 0, 0, "solar"),
      r("x-wind", 0, 0, "wind"),
    ]);
    expect(units).toHaveLength(3);
    const offsets = units.map((u) => u.offsetPx).sort((a, b) => a - b);
    expect(offsets).toEqual([-PILLAR_SEPARATION_PX, 0, PILLAR_SEPARATION_PX]);
  });

  test("distinct lat/lon keep their own bucket (no false merge)", () => {
    const units = buildPillarUnits([
      r("brazil-bahia-wind", -12.9, -41.0, "wind"),
      r("brazil-bahia-solar", -12.95, -41.05, "solar"),
    ]);
    expect(units).toHaveLength(2);
    expect(units.every((u) => u.offsetPx === 0)).toBe(true);
  });

  test("same-kind regions at same coord stack into one unit (no offset)", () => {
    const units = buildPillarUnits([
      r("a-wind", 10, 20, "wind"),
      r("b-wind", 10, 20, "wind"),
    ]);
    expect(units).toHaveLength(1);
    expect(units[0].offsetPx).toBe(0);
    expect(units[0].regions).toHaveLength(2);
  });

  test("flare colocated with renewables splits like other kinds", () => {
    const units = buildPillarUnits([
      r("iraq-flare", 33, 44, "flare"),
      r("iraq-solar", 33, 44, "solar"),
    ]);
    expect(units).toHaveLength(2);
    const flare = units.find((u) => u.regions[0].id === "iraq-flare")!;
    const solar = units.find((u) => u.regions[0].id === "iraq-solar")!;
    expect(Math.abs(flare.offsetPx - solar.offsetPx)).toBe(PILLAR_SEPARATION_PX);
    // solar before flare in deterministic order
    expect(solar.offsetPx).toBeLessThan(flare.offsetPx);
  });
});
