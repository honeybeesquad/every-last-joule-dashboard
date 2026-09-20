import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

import {
  CYCLE,
  CYAN,
  CYAN_SHARE,
  FALL_START,
  FALL_WINDOW,
  GOLD,
  RISE_DUR,
  RISE_WINDOW,
  SPOKES,
  TICK_DUR,
  markAssets,
  markLoaderCss,
  markLoaderHtml,
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
    expect(ps.filter((p) => p.curtailed)).toHaveLength(Math.round(SPOKES * CYAN_SHARE));
    // Curtailed pillars are one contiguous arc starting at 12 o'clock.
    const firstGold = ps.findIndex((p) => !p.curtailed);
    expect(ps.slice(firstGold).some((p) => p.curtailed)).toBe(false);
  });

  it("uses the site's own colour tokens", () => {
    // --brand and the Sunfire --fuel-wind default in src/style.css.
    expect(GOLD).toBe("#ffd05a");
    expect(CYAN).toBe("#67e8f9");
    const css = readFileSync(join(SRC, "style.css"), "utf8");
    expect(css).toContain(`--brand:               ${GOLD}`);
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

// The loading screen's wordmark is the lockup from the mark work — Schibsted
// Grotesk 700 at -0.01em, mixed case, "Joule" in --brand — not the site's mono
// caps. The face is self-hosted like every other one here. `observable preview`
// serves src/fonts under /_file/, so a preview check cannot prove the built
// path; what makes /fonts/<file> resolve in the build is config.dynamicPaths,
// which globs src/fonts for .woff2/.ttf. These pin that chain end to end.
describe("the loader wordmark's typeface", () => {
  const FONT_FILE = "SchibstedGrotesk-Variable.woff2";

  it("ships the font file", () => {
    const path = join(SRC, "fonts", FONT_FILE);
    expect(statSync(path).size).toBeGreaterThan(10_000);
  });

  it("is picked up by the config's src/fonts glob, so the build emits /fonts/<file>", () => {
    // Same filter as observablehq.config.ts.
    const globbed = readdirSync(join(SRC, "fonts"))
      .filter((file) => file.endsWith(".ttf") || file.endsWith(".woff2"))
      .map((file) => `/fonts/${file}`);
    expect(globbed).toContain(`/fonts/${FONT_FILE}`);

    const config = readFileSync(join(process.cwd(), "observablehq.config.ts"), "utf8");
    expect(config).toContain("...fontFiles");
  });

  it("declares the face against that path and uses it for the wordmark", () => {
    const css = readFileSync(join(SRC, "style.css"), "utf8");
    expect(css).toContain(`url("/fonts/${FONT_FILE}")`);
    expect(css).toMatch(/font-family: "Schibsted Grotesk";[^\n]*font-weight: 400 900/);
    expect(css).toMatch(/\.loader-wordmark \{[^}]*"Schibsted Grotesk"/);
    expect(css).toMatch(/\.loader-mark \{\n\s*font-size: 148px;/);
    // The lockup, as drawn: 700 weight, -0.01em, no uppercasing.
    expect(css).toMatch(/\.loader-wordmark \{[^}]*font-weight: 700/);
    expect(css).toMatch(/\.loader-wordmark \{[^}]*letter-spacing: -0\.01em/);
    expect(css).not.toMatch(/\.loader-wordmark \{[^}]*text-transform/);
  });

  it("is the site face: both themes point --font-display and --font-body at it", () => {
    const css = readFileSync(join(SRC, "style.css"), "utf8");
    const display = [...css.matchAll(/--font-display:\s*([^;]+);/g)].map((m) => m[1].trim());
    const body = [...css.matchAll(/--font-body:\s*([^;]+);/g)].map((m) => m[1].trim());
    // Exactly two, because the site has exactly two themes since Triad was
    // removed. This fails closed both ways on purpose: a new theme that does
    // not declare the brand face trips it, and so does one that declares it
    // in a stack this test has not seen.
    const why = "add the brand face to the new theme's --font-display/--font-body stack";
    expect(display, `Sunfire + Deepcurrent expected — ${why}`).toHaveLength(2);
    expect(body, `Sunfire + Deepcurrent expected — ${why}`).toHaveLength(2);
    for (const stack of [...display, ...body]) {
      expect(stack.startsWith('"Schibsted Grotesk"')).toBe(true);
    }
    // The instrument voice is untouched: figures and labels stay monospaced.
    expect(css).toMatch(/--font-mono:\s*"IBM Plex Mono"/);
  });

  it("wires --font-display to the headings, which nothing read before", () => {
    const css = readFileSync(join(SRC, "style.css"), "utf8");
    expect(css).toMatch(/\.display-xl, \.display-lg, \.display,\n\s*h1, h2, h3, h4 \{\n\s*font-family: var\(--font-display\);/);
    expect(css).toMatch(/font-weight: 400 900/); // --fw-black is 800; the axis must reach it
  });

  it("drops the italic serif accent from the wordmark", () => {
    const css = readFileSync(join(SRC, "style.css"), "utf8");
    const rule = css.slice(css.indexOf(".app-wordmark-accent {"));
    const body = rule.slice(0, rule.indexOf("}"));
    expect(body).not.toContain("Fraunces");
    expect(body).not.toContain("italic");
    expect(body).toContain("font-weight: 700");
  });

  it("logs its provenance, as every other self-hosted face does", () => {
    const sources = readFileSync(join(SRC, "fonts", "SOURCES.md"), "utf8");
    expect(sources).toContain("Schibsted Grotesk");
    expect(sources).toContain("schibstedgrotesk");
  });
});
