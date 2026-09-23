import { describe, it, expect } from "vitest";
import { LABEL, MIN_GW_DRAWN, headRadius, needleLength, needleStyle, placeSelectionLabel } from "../src/lib/needles";

describe("needle length", () => {
  it("scales with the square root of GW, as the pillars always have", () => {
    // Four times the GW is twice the sqrt term (the constant 5 px aside).
    const k = 1, out = 1;
    const l1 = needleLength(1, k, out) - 5 * k;
    const l4 = needleLength(4, k, out) - 5 * k;
    expect(l4 / l1).toBeCloseTo(2, 9);
  });

  it("is shorter near the disc centre, where a needle points at the viewer", () => {
    expect(needleLength(2, 1, 0)).toBeLessThan(needleLength(2, 1, 1));
    expect(needleLength(2, 1, 0)).toBeGreaterThan(0);
  });

  it("scales with the globe (k = R / 345)", () => {
    expect(needleLength(2, 2, 1)).toBeCloseTo(needleLength(2, 1, 1) * 2, 9);
  });

  it("does not draw below 0.05 GW, and never takes a root of a negative", () => {
    expect(MIN_GW_DRAWN).toBe(0.05);
    expect(Number.isFinite(needleLength(-1, 1, 1))).toBe(true);
    expect(headRadius(-1, 1)).toBeCloseTo(1.6, 9);
  });
});

describe("quality encoding (redesign plan 6.1, D5)", () => {
  it("draws measured as a solid line and a solid head", () => {
    expect(needleStyle("measured", false)).toEqual({ dashed: false, hollowHead: false, staleRing: false });
  });
  it("gives anchored a hollow head", () => {
    expect(needleStyle("anchored", false)).toEqual({ dashed: false, hollowHead: true, staleRing: false });
  });
  it("dashes estimated", () => {
    expect(needleStyle("estimated", false)).toEqual({ dashed: true, hollowHead: false, staleRing: false });
  });
  it("rings a stale feed whatever its tier, by shape as well as colour", () => {
    for (const bucket of ["measured", "anchored", "estimated"] as const) {
      expect(needleStyle(bucket, true).staleRing).toBe(true);
    }
  });
});

describe("the selected label", () => {
  const box = { w: 664, h: 672, cx: 332 };

  it("sits up and out from the head, on the side the needle points to, as the mock draws it", () => {
    const head = { x: 400, y: 300 };
    const p = placeSelectionLabel(head, box);
    expect(p.side).toBe("right");
    expect(p.top).toBe(head.y - 104);           // the card's top is 104px above the head
    expect(p.leader[0]).toEqual([head.x + 5, head.y - 6]);
    expect(p.leader[1]).toEqual([head.x + 34, head.y - 60]);
    expect(p.left).toBe(p.leader[2][0]);        // the leader ends at the card's edge
  });

  it("goes left for a needle on the left of the globe", () => {
    const p = placeSelectionLabel({ x: 250, y: 300 }, box);
    expect(p.side).toBe("left");
    expect(p.left + LABEL.width).toBe(p.leader[2][0]);
  });

  it("flips side where the card would leave the canvas", () => {
    expect(placeSelectionLabel({ x: 600, y: 300 }, box).side).toBe("left");
    expect(placeSelectionLabel({ x: 60, y: 300 }, box).side).toBe("right");
  });

  it("drops below the head near the top edge", () => {
    const head = { x: 400, y: 50 };
    const p = placeSelectionLabel(head, box);
    expect(p.leader[1][1]).toBe(head.y + 60);
    expect(p.top).toBeGreaterThan(head.y);
  });

  it("tracks the head in both axes: moving the head moves the card by the same amount", () => {
    // Both heads keep the card on the right (neither crosses the flip edge).
    const a = placeSelectionLabel({ x: 360, y: 300 }, box);
    const b = placeSelectionLabel({ x: 390, y: 340 }, box);
    expect(a.side).toBe("right");
    expect(b.side).toBe("right");
    expect(b.left - a.left).toBe(30);
    expect(b.top - a.top).toBe(40);
  });

  it("stays on the canvas", () => {
    for (const head of [{ x: 5, y: 5 }, { x: 659, y: 667 }, { x: 332, y: 336 }]) {
      const p = placeSelectionLabel(head, box);
      expect(p.left).toBeGreaterThanOrEqual(0);
      expect(p.top).toBeGreaterThanOrEqual(0);
      expect(p.left + LABEL.width).toBeLessThanOrEqual(box.w);
      expect(p.top + LABEL.height).toBeLessThanOrEqual(box.h);
    }
  });
});
