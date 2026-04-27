import { describe, it, expect } from "vitest";
import { parseHexToRGB, sanitisePillarAlpha } from "../src/lib/theme-tokens";

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

describe("sanitisePillarAlpha", () => {
  it("accepts a clean 2-char hex pair", () => {
    expect(sanitisePillarAlpha("aa")).toBe("aa");
    expect(sanitisePillarAlpha("ee")).toBe("ee");
    expect(sanitisePillarAlpha("99")).toBe("99");
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
    expect(sanitisePillarAlpha("not-a-hex")).toBe("99");
    expect(sanitisePillarAlpha("ggg")).toBe("99");
    expect(sanitisePillarAlpha("a")).toBe("99");
    expect(sanitisePillarAlpha("aaa")).toBe("99");
  });

  it("falls back on non-string", () => {
    expect(sanitisePillarAlpha(undefined)).toBe("99");
    expect(sanitisePillarAlpha(null)).toBe("99");
    expect(sanitisePillarAlpha(255)).toBe("99");
  });

  it("uses a custom fallback when provided", () => {
    expect(sanitisePillarAlpha("garbage", "ee")).toBe("ee");
  });
});
