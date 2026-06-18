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

describe("getRegionFuelColor — routes through dominantFuel", () => {
  it("resolves a region to its dominant-fuel colour", () => {
    const solarRegion: Region = {
      id: "test-solar", name: "test", country: "ZZZ",
      lat: 0, lon: 0, tier: "live", kind: "solar",
      source: "", sourceUrl: "",
    };
    expect(getRegionFuelColor(solarRegion)).toBe(getFuelColor("solar"));
  });
});
