// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from "vitest";
import { getFuelColor, getRegionFuelColor } from "../src/lib/fuel";
import type { Region, RegionData } from "../src/lib/types";

beforeEach(() => {
  document.documentElement.setAttribute("data-theme", "sunfire");
  // Inject the Sunfire fuel tokens onto the documentElement so
  // getComputedStyle returns deterministic values without loading the
  // full stylesheet.
  document.documentElement.style.setProperty("--fuel-solar", "#ffd05a");
  document.documentElement.style.setProperty("--fuel-wind",  "#67e8f9");
  document.documentElement.style.setProperty("--fuel-hydro", "#b8cdff");
  document.documentElement.style.setProperty("--data-flare", "#f7931a");
});

describe("getFuelColor", () => {
  it("returns the --fuel-solar token under sunfire", () => {
    expect(getFuelColor("solar")).toBe("#ffd05a");
  });

  it("returns the --fuel-wind token under sunfire", () => {
    expect(getFuelColor("wind")).toBe("#67e8f9");
  });

  it("returns the --fuel-hydro token under sunfire", () => {
    expect(getFuelColor("hydro")).toBe("#b8cdff");
  });

  it("returns the --data-flare token for the 'flare' bucket (locked across themes)", () => {
    expect(getFuelColor("flare")).toBe("#f7931a");
  });

  it("trims whitespace returned by getComputedStyle", () => {
    document.documentElement.style.setProperty("--fuel-solar", "  #abcdef  ");
    expect(getFuelColor("solar")).toBe("#abcdef");
  });

  it("returns Sunfire defaults when the token is missing on the documentElement", () => {
    document.documentElement.style.removeProperty("--fuel-solar");
    // Stylesheet not loaded in this test harness, so getComputedStyle
    // returns "" → getFuelColor falls back to the Sunfire default.
    expect(getFuelColor("solar")).toBe("#ffd05a");
  });
});

/**
 * Regression cover for issue #44 — flare regions used to render as
 * solar-yellow on the globe because `dominantFuel(flareRegion)` falls
 * through to `return "solar"`. Any caller that forgets the
 * `kind === "flare"` short-circuit silently mis-colours the pillar.
 *
 * `getRegionFuelColor` centralises that routing, so we lock it in with
 * a per-flare-region check that the resolved colour is the flare token
 * (`--data-flare`) and explicitly NOT the solar token (`--fuel-solar`).
 */
describe("getRegionFuelColor — flare regions never resolve to the solar colour", () => {
  const flare = (id: string): Region => ({
    id,
    name: id,
    country: "ZZZ",
    lat: 0,
    lon: 0,
    tier: "flare",
    kind: "flare",
    source: "",
    sourceUrl: "",
  });

  // Eight T2-flare basins + three offshore T3-static flare anchors. If any
  // of these regress to the solar colour, we want the test name to point
  // at the offending region.
  const FLARE_IDS = [
    "permian", "w-siberia", "s-iraq", "e-saudi",
    "qatar", "kuwait", "russia-yamal", "russia-e-siberia",
    "trinidad-tobago", "guyana", "suriname",
  ];

  for (const id of FLARE_IDS) {
    it(`${id} resolves to the flare token, not solar`, () => {
      const colour = getRegionFuelColor(flare(id));
      expect(colour).toBe(getFuelColor("flare"));
      expect(colour).not.toBe(getFuelColor("solar"));
    });
  }

  it("flare routing wins even when fuelShare leans solar (defensive)", () => {
    // A flare region that somehow has a misattributed solar-heavy
    // fuelShare (loader bug, future regression, malformed snapshot)
    // must STILL paint as flare. The kind discriminator is the source
    // of truth, not the per-fuel-shares vector.
    const data: Partial<RegionData> = { fuelShare: { solar: 0.9, wind: 0.1 } };
    expect(getRegionFuelColor(flare("permian"), data as RegionData))
      .toBe(getFuelColor("flare"));
    expect(getRegionFuelColor(flare("permian"), data as RegionData))
      .not.toBe(getFuelColor("solar"));
  });

  it("non-flare regions still route through dominantFuel", () => {
    const solarRegion: Region = {
      id: "test-solar", name: "test", country: "ZZZ",
      lat: 0, lon: 0, tier: "live", kind: "solar",
      source: "", sourceUrl: "",
    };
    expect(getRegionFuelColor(solarRegion)).toBe(getFuelColor("solar"));
  });
});
