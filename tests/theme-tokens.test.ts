// @vitest-environment jsdom

import { describe, it, expect, afterEach } from "vitest";
import { cssRGB, parseHexToRGB, readGlobeTokens } from "../src/lib/theme-tokens";

describe("parseHexToRGB", () => {
  it("converts a 6-char hex with leading # to a comma-separated rgb tuple", () => {
    expect(parseHexToRGB("#ffd05a")).toBe("255,208,90");
  });

  it("converts a 6-char hex without leading # to a comma-separated rgb tuple", () => {
    expect(parseHexToRGB("fafafa")).toBe("250,250,250");
  });

  it("trims whitespace", () => {
    expect(parseHexToRGB("  #67e8f9  ")).toBe("103,232,249");
  });

  it("returns null for invalid input", () => {
    expect(parseHexToRGB("not-a-hex")).toBeNull();
    expect(parseHexToRGB("")).toBeNull();
    expect(parseHexToRGB("#abc")).toBeNull();      // 3-char form not supported
    expect(parseHexToRGB("#12345678")).toBeNull(); // 8-char form not supported
  });
});

describe("cssRGB", () => {
  it("reads hex, rgb() and rgba() as computed styles return them", () => {
    expect(cssRGB("#A0C8FF")).toBe("160,200,255");
    expect(cssRGB("rgb(22, 21, 15)")).toBe("22,21,15");
    expect(cssRGB("rgba(160, 200, 255, 0.16)")).toBe("160,200,255");
    expect(cssRGB(" rgba(160,200,255,0.16) ")).toBe("160,200,255");
  });

  it("returns null for anything else", () => {
    expect(cssRGB("")).toBeNull();
    expect(cssRGB("var(--ink)")).toBeNull();
    expect(cssRGB("color-mix(in srgb, red 50%, blue)")).toBeNull();
  });
});

describe("readGlobeTokens: the redesign's globe tokens", () => {
  const root = document.documentElement;
  afterEach(() => root.removeAttribute("style"));

  it("reads the light (Almanac) values, normalising r,g,b triples", () => {
    root.style.setProperty("--ink", "#16150F");
    root.style.setProperty("--globe-ink-rgb", "22, 21, 15");
    root.style.setProperty("--globe-paper", "#F1EEE6");
    root.style.setProperty("--globe-atmosphere-rgb", "22, 21, 15");
    root.style.setProperty("--globe-land-rgb", "22, 21, 15");
    const t = readGlobeTokens(root);
    expect(t.ink).toBe("#16150F");
    expect(t.inkRGB).toBe("22,21,15");
    expect(t.paper).toBe("#F1EEE6");
    expect(t.atmosphereRGB).toBe("22,21,15");
    expect(t.landRGB).toBe("22,21,15");
  });

  it("falls back to the dark (Horizon) values when the tokens are missing", () => {
    const t = readGlobeTokens(root);
    expect(t.ink).toBe("#F2F5F9");
    expect(t.inkRGB).toBe("242,245,249");
    expect(t.paper).toBe("#05070B");
    expect(t.atmosphereRGB).toBe("110,190,255");
    expect(t.landRGB).toBe("170,200,230");
  });

  it("reads the horizon's sky, stars and beam-tip tokens", () => {
    root.style.setProperty("--surface-bg-3", "#05070B");
    root.style.setProperty("--globe-star-rgb", "220, 235, 255");
    root.style.setProperty("--fuel-solar-tip", "#FFE7B8");
    root.style.setProperty("--fuel-wind-tip", "#DCE8FF");
    root.style.setProperty("--fuel-hydro-tip", "#D2FFF6");
    const t = readGlobeTokens(root);
    expect(t.bg).toBe("#05070B");
    expect(t.starRGB).toBe("220,235,255");
    expect(t.fuelTips).toEqual({ solar: "#FFE7B8", wind: "#DCE8FF", hydro: "#D2FFF6" });
  });

  it("leaves the tips empty where a theme defines none, for the caller to tint", () => {
    expect(readGlobeTokens(root).fuelTips).toEqual({ solar: "", wind: "", hydro: "" });
  });

  it("never returns an empty string for a token a renderer would paint with", () => {
    const t = readGlobeTokens(root);
    for (const [key, value] of Object.entries(t)) expect(value, key).not.toBe("");
  });
});
