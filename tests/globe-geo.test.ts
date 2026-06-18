import { describe, it, expect } from "vitest";
import { wrapLongitude, easeOutCubic } from "../src/lib/globe-geo";

describe("wrapLongitude", () => {
  it("leaves in-range longitudes unchanged", () => {
    expect(wrapLongitude(0)).toBe(0);
    expect(wrapLongitude(45)).toBe(45);
    expect(wrapLongitude(-90)).toBe(-90);
  });
  it("wraps past +180 into the negative half", () => {
    expect(wrapLongitude(190)).toBe(-170);
    expect(wrapLongitude(200)).toBe(-160);
  });
  it("wraps past -180 into the positive half", () => {
    expect(wrapLongitude(-190)).toBe(170);
  });
  it("maps the +180 boundary to -180", () => {
    expect(wrapLongitude(180)).toBe(-180);
  });
  it("normalizes full turns", () => {
    expect(wrapLongitude(360)).toBe(0);
    expect(wrapLongitude(370)).toBe(10);
  });
});

describe("easeOutCubic", () => {
  it("is pinned at the endpoints", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });
  it("eases out — most of the travel happens early", () => {
    expect(easeOutCubic(0.5)).toBe(0.875);
  });
});
