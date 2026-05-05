// Regression cover for the "all three NZ pillars same colour" bug
// (Mar 2026): the loader was attaching the country-level fuelShare to all
// three per-fuel NZ regions, and dominantFuel ranks fuelShare ahead of
// region.kind, so wind/solar/geo all collapsed to whichever fuel
// dominated the country mix (geothermal). Two protections:
// 1. NZ loader no longer attaches country-level fuelShare to per-fuel regions.
// 2. dominantFuel + fuelShare map kind="geo" to the hydro bucket so a
//    geo region without fuelShare still gets a distinct colour from solar.

import { describe, expect, test } from "vitest";
import { dominantFuel, fuelShare } from "../src/lib/fuel";
import type { Region, RegionData } from "../src/lib/types";

const r = (id: string, kind: Region["kind"]): Region => ({
  id,
  name: id,
  country: "NZL",
  lat: 0,
  lon: 0,
  tier: "live",
  kind,
  source: "",
  sourceUrl: "",
});

describe("dominantFuel — canonical kinds", () => {
  test("kind=wind → wind", () => {
    expect(dominantFuel(r("nz-wind", "wind"))).toBe("wind");
  });
  test("kind=solar → solar", () => {
    expect(dominantFuel(r("nz-solar", "solar"))).toBe("solar");
  });
  test("kind=hydro → hydro", () => {
    expect(dominantFuel(r("nz-hydro", "hydro"))).toBe("hydro");
  });
  test("kind=geo → hydro (geo folds into the hydro bucket)", () => {
    expect(dominantFuel(r("nz-geo", "geo"))).toBe("hydro");
  });
});

describe("fuelShare — canonical kinds attribute 100% to their bucket", () => {
  test("kind=wind contributes 1 to wind, 0 to others", () => {
    const reg = r("x-wind", "wind");
    expect(fuelShare(reg, "wind")).toBe(1);
    expect(fuelShare(reg, "solar")).toBe(0);
    expect(fuelShare(reg, "hydro")).toBe(0);
  });
  test("kind=geo contributes 1 to hydro bucket, 0 to others", () => {
    const reg = r("nz-geo", "geo");
    expect(fuelShare(reg, "wind")).toBe(0);
    expect(fuelShare(reg, "solar")).toBe(0);
    expect(fuelShare(reg, "hydro")).toBe(1);
  });
});

describe("dominantFuel — kind=mixed uses fuelShare", () => {
  test("kind=mixed with fuelShare returns the dominant share", () => {
    const data: Partial<RegionData> = {
      fuelShare: { wind: 0.3, solar: 0.6, hydro: 0.1 },
    };
    expect(dominantFuel(r("blended", "mixed"), data as RegionData)).toBe("solar");
  });
});
