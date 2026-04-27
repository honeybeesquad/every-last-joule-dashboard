import { describe, it, expect } from "vitest";
import { parseColorToRgb, isGradientOverlay, sanitisePillarAlpha } from "../../src/lib/theme-tokens.js";

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

describe("sanitisePillarAlpha", () => {
  it("accepts a clean 2-char hex pair", () => {
    expect(sanitisePillarAlpha("aa")).toBe("aa");
    expect(sanitisePillarAlpha("ee")).toBe("ee");
  });
  it("lowercases uppercase hex", () => {
    expect(sanitisePillarAlpha("AA")).toBe("aa");
    expect(sanitisePillarAlpha("FF")).toBe("ff");
  });
  it("strips a leading 0x", () => {
    expect(sanitisePillarAlpha("0xee")).toBe("ee");
    expect(sanitisePillarAlpha("0XEE")).toBe("ee");
  });
  it("trims surrounding whitespace", () => {
    expect(sanitisePillarAlpha("  cc  ")).toBe("cc");
  });
  it("falls back on garbage input", () => {
    expect(sanitisePillarAlpha("not-a-hex")).toBe("aa");
    expect(sanitisePillarAlpha("ggg")).toBe("aa");
    expect(sanitisePillarAlpha("a")).toBe("aa");
    expect(sanitisePillarAlpha("aaa")).toBe("aa");
  });
  it("falls back on non-string", () => {
    expect(sanitisePillarAlpha(undefined)).toBe("aa");
    expect(sanitisePillarAlpha(null)).toBe("aa");
    expect(sanitisePillarAlpha(255)).toBe("aa");
  });
  it("uses a custom fallback when provided", () => {
    expect(sanitisePillarAlpha("garbage", "ee")).toBe("ee");
  });
});