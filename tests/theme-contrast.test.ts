import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

// The WCAG pairs the light/dark tokens were chosen for (redesign plan §9),
// computed from the values in src/style.css rather than restated, so a token
// edit that breaks legibility fails here. Text needs 4.5:1; graphics and
// large text need 3:1.

const CSS = readFileSync(join(process.cwd(), "src", "style.css"), "utf8");

function block(selector: string): Record<string, string> {
  const start = CSS.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`no ${selector} block`);
  const body = CSS.slice(start, CSS.indexOf("\n}", start));
  const tokens: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) tokens[m[1]] = m[2].trim();
  return tokens;
}

const LIGHT = block(':root[data-theme="light"]');
const DARK = block(':root[data-theme="dark"]');

type RGBA = [number, number, number, number];

function parse(value: string, tokens: Record<string, string>): RGBA {
  const ref = value.match(/^var\((--[\w-]+)\)$/);
  if (ref) return parse(tokens[ref[1]], tokens);
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgba = value.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/);
  if (rgba) return [+rgba[1], +rgba[2], +rgba[3], +rgba[4]];
  throw new Error(`cannot parse colour ${value}`);
}

/** Composite a (possibly translucent) colour over an opaque ground. */
function over([r, g, b, a]: RGBA, [R, G, B]: RGBA): RGBA {
  return [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a), 1];
}

function luminance([r, g, b]: RGBA): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(fgToken: string, bgToken: string, tokens: Record<string, string>): number {
  const bg = parse(tokens[bgToken], tokens);
  const fg = over(parse(tokens[fgToken], tokens), bg);
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = 4.5;
const GRAPHIC = 3;

describe("light (Almanac) contrast on paper (--surface-bg-3)", () => {
  it.each([
    ["--ink", TEXT, 15.8, "all light text"],
    ["--ink-muted", TEXT, 15.8, "is ink: no grey body copy on paper"],
    ["--ink-soft", TEXT, 4.9, "disabled and tertiary text only"],
    ["--brand-text", TEXT, 15.8, "accent text (links, eyebrows) is ink"],
    ["--brand", GRAPHIC, 3.2, "graphics and large text only, never small text"],
    ["--fuel-wind", TEXT, 5.8, "wind"],
    ["--fuel-hydro", GRAPHIC, 3.7, "hydro: graphics only"],
    ["--quality-warning", GRAPHIC, 4.3, "stale ring"],
  ])("%s clears %s:1 (measured %s:1 — %s)", (token, floor, measured) => {
    const ratio = contrast(token as string, "--surface-bg-3", LIGHT);
    expect(ratio).toBeGreaterThanOrEqual(floor as number);
    expect(ratio).toBeCloseTo(measured as number, 1);
  });
});

describe("dark (Horizon) contrast on the page (--surface-bg-3)", () => {
  it.each([
    ["--ink", TEXT, 18.4],
    ["--ink-muted", TEXT, 12.6],
    ["--ink-soft", TEXT, 5.2],
    ["--brand", TEXT, 11.5],
    ["--brand-text", TEXT, 11.5],
  ])("%s clears %s:1 (measured %s:1)", (token, floor, measured) => {
    const ratio = contrast(token as string, "--surface-bg-3", DARK);
    expect(ratio).toBeGreaterThanOrEqual(floor as number);
    expect(ratio).toBeCloseTo(measured as number, 1);
  });

  it("keeps the base --quality-warning (#f7931a) clear of a ring's 3:1 on the dark ground", () => {
    const tokens = { ...DARK, "--quality-warning": "#f7931a" };
    expect(contrast("--quality-warning", "--surface-bg-3", tokens)).toBeGreaterThanOrEqual(GRAPHIC);
  });
});

describe("why light overrides --quality-warning", () => {
  it("the base amber would be 2.0:1 on paper, under a ring's 3:1", () => {
    const tokens = { ...LIGHT, "--quality-warning": "#f7931a" };
    const ratio = contrast("--quality-warning", "--surface-bg-3", tokens);
    expect(ratio).toBeLessThan(GRAPHIC);
    expect(ratio).toBeCloseTo(2.0, 1);
  });
});
