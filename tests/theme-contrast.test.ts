import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

// The WCAG pairs the light (Daylight) and dark (Nightgrid) tokens were chosen
// for, computed from the values in src/style.css rather than restated, so a
// token edit that breaks legibility fails here. Text needs 4.5:1; graphics
// and large text need 3:1.

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

describe("light (Daylight) contrast on paper (--surface-bg-3)", () => {
  it.each([
    ["--ink", TEXT, 16.5, "all light text"],
    ["--ink-muted", TEXT, 7.6, "secondary copy"],
    ["--ink-soft", TEXT, 5.05, "disabled and tertiary text only"],
    ["--brand-text", TEXT, 5.2, "accent text (links, eyebrows) is the deep gold"],
    ["--brand", TEXT, 5.2, "the deep gold carries small text on paper"],
    ["--fuel-wind", TEXT, 4.58, "wind"],
    ["--fuel-hydro", TEXT, 4.79, "hydro"],
    ["--fuel-solar", GRAPHIC, 3.3, "solar: graphics only"],
    ["--quality-warning", GRAPHIC, 4.55, "stale ring"],
  ])("%s clears %s:1 (measured %s:1 — %s)", (token, floor, measured) => {
    const ratio = contrast(token as string, "--surface-bg-3", LIGHT);
    expect(ratio).toBeGreaterThanOrEqual(floor as number);
    expect(ratio).toBeCloseTo(measured as number, 1);
  });
});

describe("dark (Nightgrid) contrast on the page (--surface-bg-3)", () => {
  it.each([
    ["--ink", TEXT, 18.65],
    ["--ink-muted", TEXT, 11.3],
    ["--ink-soft", TEXT, 6.9],
    ["--brand", TEXT, 13.6],
    ["--brand-text", TEXT, 13.6],
    ["--fuel-solar", GRAPHIC, 13.6],
    ["--fuel-wind", GRAPHIC, 13.7],
    ["--fuel-hydro", GRAPHIC, 7.2],
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

// Wind and hydro used to be cyan and periwinkle, which collapse to almost the
// same colour for a deuteranope (CIELAB distance 5). Violet hydro is why the
// pair holds. Machado et al. (2009) severity-1.0 matrices on linear RGB, then
// CIE76 distance in CIELAB.
const CVD = {
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
} as const;

function lab([r, g, b]: number[]): [number, number, number] {
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}

function simulatedDistance(a: string, b: string, tokens: Record<string, string>, m: readonly (readonly number[])[]): number {
  const toLinear = (token: string) =>
    parse(tokens[token], tokens).slice(0, 3).map((c) => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
  const simulate = (c: number[]) => m.map((row) => Math.min(1, Math.max(0, row[0] * c[0] + row[1] * c[1] + row[2] * c[2])));
  const [p, q] = [lab(simulate(toLinear(a))), lab(simulate(toLinear(b)))];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

describe("the fuel colours stay apart under simulated colour-vision deficiency", () => {
  const PAIRS = [["--fuel-wind", "--fuel-hydro"], ["--fuel-solar", "--fuel-wind"], ["--fuel-solar", "--fuel-hydro"]] as const;
  it.each([["light", LIGHT], ["dark", DARK]] as const)("%s: every pair is at least 30 apart in each simulation", (_mode, tokens) => {
    for (const [name, m] of Object.entries(CVD)) {
      for (const [a, b] of PAIRS) {
        expect(simulatedDistance(a, b, tokens, m), `${a} vs ${b}, ${name}`).toBeGreaterThanOrEqual(30);
      }
    }
  });
});
