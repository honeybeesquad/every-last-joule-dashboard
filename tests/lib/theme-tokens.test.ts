import { describe, it, expect } from "vitest";
import { parseColorToRgb, isGradientOverlay } from "../../src/lib/theme-tokens.js";

describe("parseColorToRgb", () => {
  it("parses 6-digit hex", () => {
    expect(parseColorToRgb("#ffd05a")).toBe("255,208,90");
  });
  it("parses 3-digit hex", () => {
    expect(parseColorToRgb("#fff")).toBe("255,255,255");
  });
  it("parses rgb()", () => {
    expect(parseColorToRgb("rgb(20, 175, 172)")).toBe("20,175,172");
  });
  it("parses rgba()", () => {
    expect(parseColorToRgb("rgba(255, 208, 90, 0.35)")).toBe("255,208,90");
  });
  it("returns null for gradient", () => {
    expect(parseColorToRgb("linear-gradient(135deg, #fff 0%, #000 100%)")).toBe(null);
  });
  it("returns null for empty/whitespace", () => {
    expect(parseColorToRgb("")).toBe(null);
    expect(parseColorToRgb("   ")).toBe(null);
  });
});

describe("isGradientOverlay", () => {
  it("detects linear-gradient", () => {
    expect(isGradientOverlay("linear-gradient(135deg, #fff, #000)")).toBe(true);
  });
  it("rejects plain colour", () => {
    expect(isGradientOverlay("rgba(20, 14, 5, 0.42)")).toBe(false);
  });
  it("rejects empty/undefined", () => {
    expect(isGradientOverlay("")).toBe(false);
    expect(isGradientOverlay(undefined)).toBe(false);
  });
});