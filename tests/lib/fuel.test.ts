// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { getFuelColor } from "../../src/lib/fuel.js";

describe("getFuelColor", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.setProperty("--fuel-solar", "#ffd05a");
    document.documentElement.style.setProperty("--fuel-wind",  "#67e8f9");
    document.documentElement.style.setProperty("--fuel-hydro", "#b8cdff");
  });

  it("reads --fuel-solar from the document element", () => {
    expect(getFuelColor("solar")).toBe("#ffd05a");
  });

  it("reads --fuel-wind from the document element", () => {
    expect(getFuelColor("wind")).toBe("#67e8f9");
  });

  it("reads --fuel-hydro from the document element", () => {
    expect(getFuelColor("hydro")).toBe("#b8cdff");
  });

  it("re-reads on subsequent calls (no caching)", () => {
    expect(getFuelColor("solar")).toBe("#ffd05a");
    document.documentElement.style.setProperty("--fuel-solar", "#fafafa");
    expect(getFuelColor("solar")).toBe("#fafafa");
  });
});