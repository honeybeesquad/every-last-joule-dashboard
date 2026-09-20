import { describe, it, expect } from "vitest";
import { parseHexToRGB } from "../src/lib/theme-tokens";

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
