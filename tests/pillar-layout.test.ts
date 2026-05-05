import { describe, expect, test } from "vitest";
import { buildPillarUnits, PILLAR_SEPARATION_PX } from "../src/lib/pillar-layout";

const r = (id: string, lat: number, lon: number, kind: string) => ({ id, lat, lon, kind });

describe("buildPillarUnits", () => {
  test("PILLAR_SEPARATION_PX is 0 — invariant: bar bases must stay inside country", () => {
    // Documented in pillar-layout.ts: the screen-x offset approach was
    // reverted in favour of per-fuel centroid differentiation in regions.ts.
    expect(PILLAR_SEPARATION_PX).toBe(0);
  });

  test("single region renders as one unit at offset 0", () => {
    const units = buildPillarUnits([r("germany-wind", 53.5, 9.5, "wind")]);
    expect(units).toHaveLength(1);
    expect(units[0].offsetPx).toBe(0);
    expect(units[0].regions.map((x) => x.id)).toEqual(["germany-wind"]);
  });

  test("co-located different-kind regions stack into one unit (offset 0)", () => {
    // Co-location is rare post-data-layer-fix but defensive: stacking at
    // the shared centroid is unconditionally inside-country, satisfying
    // the invariant.
    const units = buildPillarUnits([
      r("x-solar", 40.0, -3.5, "solar"),
      r("x-wind", 40.0, -3.5, "wind"),
    ]);
    expect(units).toHaveLength(1);
    expect(units[0].offsetPx).toBe(0);
    expect(units[0].regions).toHaveLength(2);
    // Deterministic order: wind before solar.
    expect(units[0].regions.map((u) => u.id)).toEqual(["x-wind", "x-solar"]);
  });

  test("distinct lat/lon keep their own bucket", () => {
    const units = buildPillarUnits([
      r("brazil-bahia-wind", -12.9, -41.0, "wind"),
      r("brazil-bahia-solar", -12.95, -41.05, "solar"),
    ]);
    expect(units).toHaveLength(2);
    expect(units.every((u) => u.offsetPx === 0)).toBe(true);
  });

  test("same-kind regions at same coord stack into one unit", () => {
    const units = buildPillarUnits([
      r("a-wind", 10, 20, "wind"),
      r("b-wind", 10, 20, "wind"),
    ]);
    expect(units).toHaveLength(1);
    expect(units[0].offsetPx).toBe(0);
    expect(units[0].regions).toHaveLength(2);
  });

  test("three-kind co-location stacks into one unit (offset 0, deterministic order)", () => {
    const units = buildPillarUnits([
      r("x-hydro", 0, 0, "hydro"),
      r("x-solar", 0, 0, "solar"),
      r("x-wind", 0, 0, "wind"),
    ]);
    expect(units).toHaveLength(1);
    expect(units[0].offsetPx).toBe(0);
    expect(units[0].regions.map((u) => u.id)).toEqual(["x-wind", "x-solar", "x-hydro"]);
  });

  test("realistic post-fix pair: spain-wind / spain-solar at distinct centroids", () => {
    // Reflects the actual coords post per-fuel differentiation sweep:
    // wind in Castilla y León, solar in Andalusia. Two separate units.
    const units = buildPillarUnits([
      r("spain-wind", 42.5, -4.5, "wind"),
      r("spain-solar", 37.5, -5.5, "solar"),
    ]);
    expect(units).toHaveLength(2);
    expect(units.every((u) => u.offsetPx === 0)).toBe(true);
  });
});
