import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

// Both themes were dark until the light/dark redesign, so src/style.css was
// full of white written straight into rules: 70 rgba(255,255,255,…) literals
// and 64 more hex colours outside the theme blocks at 7f9c8a14. On paper those
// render white-on-paper. Every one is now a token (--ink, --ink-muted,
// --ink-soft, --hairline, --brand-text, …) or a colour-mix() of one.
//
// The rule this pins: a colour literal may appear only as the value of a
// custom property (that is what a token IS), or in ALLOWED below with a
// reason. A new `color: rgba(255,255,255,.6)` fails here, in light AND dark.

const CSS = readFileSync(join(process.cwd(), "src", "style.css"), "utf8");

/** Hex, rgb()/rgba()/hsl() with a literal first channel, or a named white/black. */
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*[\d.]|\bhsla?\(\s*[\d.]|(?<![\w-])(?:white|black)(?![\w-])/i;

/** Declarations allowed to paint a literal colour, keyed "selector | property". */
const ALLOWED: Record<string, string> = {
  ":root:not([data-theme]), html:not([data-theme]) body | background":
    "No-JS / pre-boot fallback: without data-theme no token block applies, so the page colour has to be literal.",
  ":root:not([data-theme]), html:not([data-theme]) body | color":
    "No-JS / pre-boot fallback, as above.",
};

interface Declaration { selector: string; property: string; value: string }

/** Every declaration in the sheet, with the selector of the block it sits in. */
function declarations(css: string): Declaration[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Declaration[] = [];
  // Innermost blocks only: a declaration block never contains braces, and an
  // @media / @keyframes wrapper is just the text around the blocks it holds.
  for (const m of text.matchAll(/([^{};]*)\{([^{}]*)\}/g)) {
    const selector = m[1].trim().replace(/\s+/g, " ");
    for (const raw of m[2].split(";")) {
      const i = raw.indexOf(":");
      if (i === -1) continue;
      const property = raw.slice(0, i).trim();
      const value = raw.slice(i + 1).trim();
      if (property) out.push({ selector, property, value });
    }
  }
  return out;
}

const ALL = declarations(CSS);

describe("src/style.css colour literals", () => {
  it("parses the sheet (sanity: the audit is looking at real declarations)", () => {
    expect(ALL.length).toBeGreaterThan(1500);
    expect(ALL.some((d) => d.selector === ':root[data-theme="light"]' && d.property === "--ink")).toBe(true);
    expect(ALL.some((d) => d.selector === ':root[data-theme="dark"]' && d.property === "--ink")).toBe(true);
  });

  it("paints no colour literal outside a token definition or the allowlist", () => {
    const offenders = ALL
      .filter((d) => !d.property.startsWith("--"))
      .filter((d) => COLOUR_LITERAL.test(d.value))
      .filter((d) => !(`${d.selector} | ${d.property}` in ALLOWED))
      .map((d) => `${d.selector} { ${d.property}: ${d.value} }`);
    expect(
      offenders,
      "use a token (--ink, --ink-muted, --ink-soft, --hairline, --brand-text, …) or a color-mix() of one",
    ).toEqual([]);
  });

  it("has no white literal anywhere outside token definitions and the allowlist", () => {
    // The specific failure the redesign fixed, stated on its own so the
    // message is unambiguous if it comes back.
    const WHITE = /rgba?\(\s*255\s*,\s*255\s*,\s*255|#fff(?:fff)?\b|(?<![\w-])white(?![\w-])/i;
    const whites = ALL
      .filter((d) => !d.property.startsWith("--") && WHITE.test(d.value))
      .filter((d) => !(`${d.selector} | ${d.property}` in ALLOWED));
    expect(whites).toEqual([]);
  });

  it("keeps every allowlist entry in use, so the allowlist cannot quietly grow stale", () => {
    for (const key of Object.keys(ALLOWED)) {
      const [selector, property] = key.split(" | ");
      const hit = ALL.find((d) => d.selector === selector && d.property === property && COLOUR_LITERAL.test(d.value));
      expect(hit, `stale allowlist entry: ${key}`).toBeDefined();
    }
  });

  it("does not count `white-space` or token references as colours", () => {
    expect(COLOUR_LITERAL.test("nowrap")).toBe(false);
    expect(ALL.some((d) => d.property === "white-space")).toBe(true);
    expect(COLOUR_LITERAL.test("rgba(var(--brand-rgb), 0.2)")).toBe(false);
    expect(COLOUR_LITERAL.test("color-mix(in srgb, var(--ink) 8%, transparent)")).toBe(false);
    expect(COLOUR_LITERAL.test("rgba(255,255,255,0.4)")).toBe(true);
    expect(COLOUR_LITERAL.test("#fff8e0")).toBe(true);
  });
});
