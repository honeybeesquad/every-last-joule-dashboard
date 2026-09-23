// @vitest-environment jsdom

import { describe, it, expect, afterEach } from "vitest";
import { parseHexToRGB, readGlobeTokens } from "../src/lib/theme-tokens";

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

  it("never returns an empty string for a token a renderer would paint with", () => {
    const t = readGlobeTokens(root);
    for (const [key, value] of Object.entries(t)) expect(value, key).not.toBe("");
  });
});
