// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { beamGlyph } from "../src/components/beam-glyph.js";

function parse(svg: string): SVGSVGElement {
  const host = document.createElement("div");
  host.innerHTML = svg;
  return host.querySelector("svg") as SVGSVGElement;
}

describe("beam glyph: the dark legend's key (redesign plan 6.1)", () => {
  it("is decorative: the legend's text carries the meaning", () => {
    expect(parse(beamGlyph()).getAttribute("aria-hidden")).toBe("true");
  });

  it("dims with the quality bucket, as the beams do", () => {
    const core = (bucket: string) => parse(beamGlyph({ bucket })).querySelectorAll("line")[1].getAttribute("opacity");
    expect(core("measured")).toBe("1");
    expect(core("anchored")).toBe("0.8");
    expect(core("estimated")).toBe("0.62");
  });

  it("dashes the estimated core, by shape as well as brightness", () => {
    expect(parse(beamGlyph({ bucket: "estimated" })).querySelectorAll("line")[1].hasAttribute("stroke-dasharray")).toBe(true);
    expect(parse(beamGlyph({ bucket: "measured" })).querySelectorAll("line")[1].hasAttribute("stroke-dasharray")).toBe(false);
  });

  it("rings a stale feed with a dashed warning ring at the base", () => {
    const ring = parse(beamGlyph({ stale: true })).querySelector(".beam-glyph-stale");
    expect(ring).not.toBeNull();
    expect(ring?.getAttribute("stroke-dasharray")).toBeTruthy();
    expect(parse(beamGlyph()).querySelector(".beam-glyph-stale")).toBeNull();
  });
});
