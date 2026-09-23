import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

import {
  CYCLE,
  FALL_START,
  FALL_WINDOW,
  LEAD_SHARE,
  MARK_SVG_PALETTE,
  RISE_DUR,
  RISE_WINDOW,
  SPOKES,
  TICK_DUR,
  markAssets,
  markLoaderCss,
  markLoaderHtml,
  markStillHtml,
  pillars,
  renderMark,
} from "../scripts/lib/brand-mark.js";

// The brand assets under src/brand/ are generated and committed, because the
// page loader has to paint its mark from raw HTML before any script runs. The
// committed file is therefore the thing that ships, and nothing at build time
// regenerates it — so the only defence against a hand-edit (or a change to the
// generator that nobody re-ran) is this comparison.

const SRC = join(process.cwd(), "src");

describe("generated brand assets", () => {
  it("match what scripts/lib/brand-mark.ts renders today", () => {
    for (const [path, expected] of Object.entries(markAssets())) {
      const onDisk = readFileSync(join(SRC, path), "utf8");
      expect(onDisk, `src/${path} is stale — run \`npm run brand:assets\``).toBe(expected);
    }
  });

  it("still ship the SVG marks, which the avatars and any static use need", () => {
    expect(Object.keys(markAssets())).toEqual(
      expect.arrayContaining([
        "brand/mark-loop.svg",
        "brand/mark-still.svg",
        "brand/avatar-loop.svg",
        "brand/avatar-still.svg",
      ]),
    );
  });

  // The loading screen does NOT use those SVGs. SMIL inside an <img> is driven
  // by the main thread, and on this screen the main thread is saturated by the
  // data load — measured: during a 4s block the SVG rendered a bare disc the
  // whole time, then snapped to a full ring. The loader mark is HTML elements
  // and CSS transforms, which composite off-thread and keep running.
  it("drives the loading screen from generated CSS, not from an <img>", () => {
    const index = readFileSync(join(SRC, "index.md"), "utf8");
    const css = readFileSync(join(SRC, "style.css"), "utf8");

    expect(index).not.toContain("brand/mark-loop.svg");
    expect(css).not.toContain("brand/mark-still.svg");
    expect(index).toContain(markLoaderHtml());
    expect(css).toContain(markLoaderCss());
  });

  // The loader and the header mark follow the light/dark mode through the
  // --mark-* tokens. A colour literal in either generated block would pin one
  // mode's colour into both.
  it("colours the loader and the header mark only through --mark-* tokens", () => {
    const blocks = { "loader CSS": markLoaderCss(), "loader HTML": markLoaderHtml(), "header mark": markStillHtml() };
    for (const [name, text] of Object.entries(blocks)) {
      expect(text, `${name} carries a hex colour`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(text, `${name} carries an rgb() colour`).not.toMatch(/rgba?\(\s*\d/);
      for (const [, name_] of text.matchAll(/var\((--[\w-]+)\)/g)) {
        expect(name_, `${name} reads a non-mark token`).toMatch(/^--mark-/);
      }
    }
    expect(markLoaderCss()).toContain("var(--mark-disc)");
    expect(markLoaderCss()).toContain("var(--mark-lead)");
    expect(markLoaderCss()).toContain("var(--mark-rest)");
    expect(markLoaderCss()).toContain("var(--mark-rest-opacity)");
    expect(markLoaderCss()).toContain("var(--mark-tick)");
    expect(markLoaderCss()).toContain("var(--mark-glow)");
  });

  it("defines every --mark-* token the generated blocks read, in both modes", () => {
    const css = readFileSync(join(SRC, "style.css"), "utf8");
    const used = new Set(
      [markLoaderCss(), markStillHtml()].flatMap((t) => [...t.matchAll(/var\((--mark-[\w-]+)\)/g)].map((m) => m[1])),
    );
    for (const mode of ["light", "dark"]) {
      const start = css.indexOf(`:root[data-theme="${mode}"] {`);
      const body = css.slice(start, css.indexOf("\n}", start));
      for (const token of used) expect(body, `${mode} lacks ${token}`).toContain(`${token}:`);
    }
  });

  it("puts the header's still mark inline, from the generator, not as an <img>", () => {
    const index = readFileSync(join(SRC, "index.md"), "utf8");
    // An SVG inside an <img> cannot read custom properties.
    expect(index).not.toContain("/brand/mark-still.svg");
    expect(index).toContain(markStillHtml());
    const still = markStillHtml();
    expect(still.match(/<rect/g) ?? []).toHaveLength(SPOKES);
    expect(still).toContain('aria-hidden="true"'); // the wordmark beside it names the site
    expect(still).not.toContain("animate");
  });

  it("gives every pillar its own keyframes, which is what syncs the reset", () => {
    const css = markLoaderCss();
    for (let i = 0; i < SPOKES; i++) {
      expect(css).toContain(`@keyframes elj-p${i}{`);
      expect(css).toContain(`@keyframes elj-t${i}{`);
    }
    // One shared period with no per-element delay: every pillar's cycle starts
    // and restarts together. A shared keyframe plus animation-delay would shift
    // each pillar's cycle boundary and smear the reset into a second wave.
    expect(css).toContain(`animation-duration:${CYCLE}s`);
    expect(css).not.toContain("animation-delay");
  });

  it("holds the full ring under prefers-reduced-motion", () => {
    const css = markLoaderCss();
    const block = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(block).toContain("animation:none");
    expect(block).toContain("transform:scaleY(1)");
  });

  it("route every asset through config.dynamicPaths", () => {
    const config = readFileSync(join(process.cwd(), "observablehq.config.ts"), "utf8");
    for (const path of Object.keys(markAssets())) {
      expect(config, `/${path} is not emitted by the build`).toContain(`"/${path}"`);
    }
  });
});

describe("mark geometry", () => {
  it("is the Spectrum mark: 44 pillars, 26% of them curtailed", () => {
    const ps = pillars();
    expect(ps).toHaveLength(SPOKES);
    expect(ps.filter((p) => p.curtailed)).toHaveLength(Math.round(SPOKES * LEAD_SHARE));
    // Curtailed pillars are one contiguous arc starting at 12 o'clock.
    const firstRest = ps.findIndex((p) => !p.curtailed);
    expect(ps.slice(firstRest).some((p) => p.curtailed)).toBe(false);
  });

  it("draws the published SVGs in the dark (Horizon) mark palette (D6)", () => {
    // src/brand/*.svg are static files with no document to read tokens from,
    // so their colours are literals, and this pins each one to the dark
    // block's token so the two cannot drift.
    const css = readFileSync(join(SRC, "style.css"), "utf8");
    const start = css.indexOf(':root[data-theme="dark"] {');
    const dark = css.slice(start, css.indexOf("\n}", start));
    const token = (name: string) => dark.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();
    const hexToRgb = (hex: string) =>
      [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ");

    expect(token("--mark-disc")).toBe(MARK_SVG_PALETTE.disc);
    expect(token("--mark-lead")).toBe(MARK_SVG_PALETTE.lead);
    expect(token("--mark-rest")).toBe(MARK_SVG_PALETTE.rest);
    expect(Number(token("--mark-rest-opacity"))).toBe(MARK_SVG_PALETTE.restOpacity);
    expect(token("--mark-tick")).toBe(MARK_SVG_PALETTE.tick);
    expect(token("--mark-glow")).toBe(`rgba(${hexToRgb(MARK_SVG_PALETTE.glow)}, ${MARK_SVG_PALETTE.glowOpacity})`);
    expect(token("--brand-strong")).toBe(MARK_SVG_PALETTE.glowMid);
    expect(token("--surface-bg-3")).toBe(MARK_SVG_PALETTE.ground);

    // ...and those are the only colours in the files.
    const allowed = new Set(Object.values(MARK_SVG_PALETTE).filter((v) => typeof v === "string").map((v) => String(v).toLowerCase()));
    for (const [path, svg] of Object.entries(markAssets())) {
      for (const [hex] of svg.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
        expect(allowed.has(hex.toLowerCase()), `${path} uses ${hex}`).toBe(true);
      }
    }
  });

  it("is deterministic — the same shape on every run", () => {
    expect(renderMark({ title: "x", still: true })).toBe(
      renderMark({ title: "x", still: true }),
    );
  });
});

describe("the sweep-and-release cycle", () => {
  it("finishes the rise before the fall begins", () => {
    const ps = pillars();
    const lastUp = Math.max(...ps.map((p) => p.riseAt)) + RISE_DUR;
    expect(lastUp).toBeLessThanOrEqual(FALL_START);
    expect(Math.max(...ps.map((p) => p.riseAt))).toBeCloseTo(
      RISE_WINDOW - RISE_WINDOW / SPOKES,
    );
  });

  it("rises and recedes in the same clockwise order", () => {
    const ps = pillars();
    for (let i = 1; i < ps.length; i++) {
      expect(ps[i].angle).toBeGreaterThan(ps[i - 1].angle);
      expect(ps[i].riseAt).toBeGreaterThan(ps[i - 1].riseAt);
      expect(ps[i].fallAt).toBeGreaterThan(ps[i - 1].fallAt);
    }
  });

  it("evaporates the last tick before the loop restarts", () => {
    const lastTickEnds = FALL_START + FALL_WINDOW + TICK_DUR;
    expect(lastTickEnds).toBeLessThan(CYCLE);
    expect(CYCLE - lastTickEnds).toBeGreaterThanOrEqual(0.15);
  });

  it("gives every animation keyTimes that never decrease and end at 1", () => {
    const svg = readFileSync(join(SRC, "brand/mark-loop.svg"), "utf8");
    const lists = [...svg.matchAll(/keyTimes="([^"]+)"/g)].map((m) => m[1]);
    expect(lists.length).toBe(SPOKES * 3); // scale, tick opacity, tick travel
    for (const list of lists) {
      const times = list.split(";").map(Number);
      expect(times[0]).toBe(0);
      expect(times[times.length - 1]).toBe(1);
      for (let i = 1; i < times.length; i++) {
        expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
      }
    }
  });

  it("holds every pillar still at the full ring in the still asset", () => {
    const still = readFileSync(join(SRC, "brand/mark-still.svg"), "utf8");
    expect(still).not.toContain("animate");
    expect(still.match(/<rect/g) ?? []).toHaveLength(SPOKES);
  });
});

// The faces of the light/dark redesign: Geist for body and Geist Mono for
// labels in both modes; the display face (and with it the wordmark) is
// Newsreader in light and Geist in dark. All self-hosted. `observable preview`
// serves src/fonts under /_file/, so a preview check cannot prove the built
// path; what makes /fonts/<file> resolve in the build is config.dynamicPaths,
// which globs src/fonts for .woff2/.ttf. These pin that chain end to end.
describe("the redesign's typefaces", () => {
  const FACES = {
    "Geist-Variable-latin.woff2": { family: "Geist", style: "normal", weights: "100 900" },
    "GeistMono-Variable-latin.woff2": { family: "Geist Mono", style: "normal", weights: "100 900" },
    "Newsreader-Variable-latin.woff2": { family: "Newsreader", style: "normal", weights: "200 800" },
    "Newsreader-Italic-Variable-latin.woff2": { family: "Newsreader", style: "italic", weights: "200 800" },
  } as const;
  const css = readFileSync(join(SRC, "style.css"), "utf8");
  const modeBlock = (mode: string) => {
    const start = css.indexOf(`:root[data-theme="${mode}"] {`);
    return css.slice(start, css.indexOf("\n}", start));
  };
  const token = (block: string, name: string) => block.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim() ?? "";

  it("ships the four font files", () => {
    for (const file of Object.keys(FACES)) {
      expect(statSync(join(SRC, "fonts", file)).size, file).toBeGreaterThan(10_000);
    }
  });

  it("is picked up by the config's src/fonts glob, so the build emits /fonts/<file>", () => {
    // Same filter as observablehq.config.ts.
    const globbed = readdirSync(join(SRC, "fonts"))
      .filter((file) => file.endsWith(".ttf") || file.endsWith(".woff2"))
      .map((file) => `/fonts/${file}`);
    for (const file of Object.keys(FACES)) expect(globbed).toContain(`/fonts/${file}`);
    const config = readFileSync(join(process.cwd(), "observablehq.config.ts"), "utf8");
    expect(config).toContain("...fontFiles");
  });

  it("declares each face against that path, with its full variable weight range", () => {
    for (const [file, face] of Object.entries(FACES)) {
      const rule = css.match(new RegExp(`@font-face \\{[^}]*url\\("/fonts/${file}"\\)[^}]*\\}`))?.[0];
      expect(rule, `no @font-face for ${file}`).toBeDefined();
      expect(rule).toContain(`font-family: "${face.family}"`);
      expect(rule).toContain(`font-weight: ${face.weights}`);
      expect(rule).toContain(`font-style: ${face.style}`);
    }
  });

  it("sets Newsreader display and Geist body in light, Geist for both in dark, Geist Mono labels in both", () => {
    const light = modeBlock("light");
    const dark = modeBlock("dark");
    expect(token(light, "--font-display").startsWith('"Newsreader"')).toBe(true);
    expect(token(dark, "--font-display").startsWith('"Geist"')).toBe(true);
    for (const block of [light, dark]) {
      expect(token(block, "--font-body").startsWith('"Geist"')).toBe(true);
      expect(token(block, "--font-mono").startsWith('"Geist Mono"')).toBe(true);
    }
  });

  it("takes display weights from the mode, so Newsreader is not rendered at 800", () => {
    expect(token(modeBlock("light"), "--display-weight-strong")).toBe("400");
    expect(token(modeBlock("dark"), "--display-weight-strong")).toBe("600");
    expect(css).toMatch(/\.display-xl \{[^}]*font-weight: var\(--display-weight-strong\)/);
    expect(css).toMatch(/\.display-lg \{[^}]*font-weight: var\(--display-weight-strong\)/);
    expect(css).toMatch(/\.display {4}\{[^}]*font-weight: var\(--display-weight-base\)/);
  });

  it("wires --font-display to the headings", () => {
    expect(css).toMatch(/\.display-xl, \.display-lg, \.display,\n\s*h1, h2, h3, h4 \{\n\s*font-family: var\(--font-display\);/);
  });

  it("draws the wordmark in the mode's face: italic serif 'Joule' in light, upright in dark (D3)", () => {
    // One lockup rule for the header wordmark and the loading screen's, so
    // the two can never show different lockups.
    const lockup = css.match(/\.app-wordmark,\n\.loader-wordmark \{[^}]*\}/)?.[0] ?? "";
    expect(lockup).toContain("font-family: var(--font-display)");
    expect(lockup).toContain("color: var(--ink)");
    const accent = css.match(/\.app-wordmark-accent,\n\.loader-wordmark span \{[^}]*\}/)?.[0] ?? "";
    expect(accent).toContain("font-style: italic");
    expect(accent).toContain("font-weight: 400");
    const darkAccent =
      css.match(/:root\[data-theme="dark"\] :is\(\.app-wordmark-accent, \.loader-wordmark span\) \{[^}]*\}/)?.[0] ?? "";
    expect(darkAccent).toContain("font-style: normal");
    // The loader's own rule sets size only; it no longer names a face.
    const loader = css.match(/\n\.loader-wordmark \{[^}]*\}/)?.[0] ?? "";
    expect(loader).toContain("font-size"); // found the rule, so the next two are not vacuous
    expect(loader).not.toContain("font-family");
    expect(loader).not.toContain("Schibsted");
  });

  it("logs their provenance, as every other self-hosted face does", () => {
    const sources = readFileSync(join(SRC, "fonts", "SOURCES.md"), "utf8");
    for (const file of Object.keys(FACES)) expect(sources).toContain(file);
    expect(sources).toContain("@fontsource-variable/geist");
    expect(sources).toContain("@fontsource-variable/newsreader");
  });
});
