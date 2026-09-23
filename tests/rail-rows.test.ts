// @vitest-environment jsdom

import { describe, it, expect } from "vitest";
import { hotspotRow, RAIL_LIST_LIMIT } from "../src/components/rail-rows.js";
import { needleGlyph } from "../src/components/needle-glyph.js";

const region = { name: "Sichuan" };

function li(html: string): HTMLLIElement {
  const ol = document.createElement("ol");
  ol.innerHTML = html;
  return ol.firstElementChild as HTMLLIElement;
}

describe("the rail rows", () => {
  it("renders ten rows (redesign plan 3)", () => {
    expect(RAIL_LIST_LIMIT).toBe(10);
  });

  it("carries rank, needle, name, bar and value, so each mode can show its parts", () => {
    const row = li(hotspotRow({ rank: 1, region, fuel: "hydro", bucket: "measured", value: "6.8", barPct: 100 }));
    expect(row.classList.contains("fuel-hydro")).toBe(true);
    expect(row.querySelector(".hs-rank")!.textContent).toBe("01");
    expect(row.querySelector(".hs-needle svg")).not.toBeNull();
    expect(row.querySelector(".hotspot-name")!.textContent).toBe("Sichuan");
    expect((row.querySelector(".hs-bar > span") as HTMLElement).style.width).toBe("100%");
    expect(row.querySelector(".hotspot-gw")!.textContent).toBe("6.8 GW");
  });

  // The tags are the list's non-colour statement of what the globe encodes by
  // shape (WCAG 1.4.1).
  it("tags an estimated region 'est.'", () => {
    const row = li(hotspotRow({ rank: 1, region, fuel: "hydro", bucket: "estimated", value: "6.8" }));
    expect(row.querySelector(".hotspot-name")!.textContent).toBe("Sichuan est.");
  });

  it("tags a stale feed 'stale', whatever its tier", () => {
    const row = li(hotspotRow({ rank: 1, region, fuel: "solar", bucket: "measured", stale: true, value: "1.2" }));
    expect(row.querySelector(".hotspot-name")!.textContent).toBe("Sichuan stale");
    const both = li(hotspotRow({ rank: 1, region, fuel: "solar", bucket: "estimated", stale: true, value: "1.2" }));
    expect(both.querySelector(".hotspot-name")!.textContent).toBe("Sichuan est. stale");
  });

  it("does not tag measured or anchored rows", () => {
    for (const bucket of ["measured", "anchored"]) {
      const row = li(hotspotRow({ rank: 3, region, fuel: "wind", bucket, value: "1.0" }));
      expect(row.querySelector(".hs-tag")).toBeNull();
    }
  });

  it("keeps the full name available where the row truncates it", () => {
    const long = { name: "Rio Grande do Norte Wind" };
    const row = li(hotspotRow({ rank: 4, region: long, fuel: "wind", bucket: "measured", value: "1.9" }));
    expect(row.querySelector(".hotspot-name")!.getAttribute("title")).toBe("Rio Grande do Norte Wind");
  });

  it("escapes what it interpolates", () => {
    const row = li(hotspotRow({ rank: 1, region: { name: "<b>x</b>" }, fuel: "wind", bucket: "measured", value: "1", title: '"q"' }));
    expect(row.querySelector("b")).toBeNull();
    expect(row.getAttribute("title")).toBe('"q"');
  });

  it("renders unranked rows (the share view's 'no measured share' list) with an empty rank", () => {
    const row = li(hotspotRow({ region, fuel: "hydro", bucket: "estimated", value: "circular", unit: "", extraClass: "hotspot-item-unavailable" }));
    expect(row.querySelector(".hs-rank")!.textContent).toBe("");
    expect(row.classList.contains("hotspot-item-unavailable")).toBe(true);
    expect(row.querySelector(".hotspot-gw")!.textContent).toBe("circular");
  });
});

describe("the needle glyph (the legend and rail key)", () => {
  function glyph(opts: Parameters<typeof needleGlyph>[0]) {
    const div = document.createElement("div");
    div.innerHTML = needleGlyph(opts);
    return div.querySelector("svg")!;
  }

  it("is decorative: the row or legend label names it", () => {
    expect(glyph({}).getAttribute("aria-hidden")).toBe("true");
  });

  it("dashes the line for estimated and only for estimated", () => {
    expect(glyph({ bucket: "estimated" }).querySelector("line")!.getAttribute("stroke-dasharray")).toBe("3 3");
    expect(glyph({ bucket: "measured" }).querySelector("line")!.hasAttribute("stroke-dasharray")).toBe(false);
    expect(glyph({ bucket: "anchored" }).querySelector("line")!.hasAttribute("stroke-dasharray")).toBe(false);
  });

  it("hollows the head for anchored", () => {
    const circles = [...glyph({ bucket: "anchored" }).querySelectorAll("circle")];
    expect(circles.some((c) => c.getAttribute("fill") === "none" && c.getAttribute("stroke") === "currentColor")).toBe(true);
  });

  it("adds a dashed warning ring for a stale feed", () => {
    const ring = glyph({ bucket: "measured", stale: true }).querySelector(".needle-glyph-stale")!;
    expect(ring).not.toBeNull();
    expect(ring.getAttribute("stroke-dasharray")).toBeTruthy();
    expect(glyph({ bucket: "measured" }).querySelector(".needle-glyph-stale")).toBeNull();
  });
});
