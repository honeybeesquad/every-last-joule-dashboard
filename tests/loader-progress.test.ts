// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from "vitest";

// loader-progress.js keeps its counting state (loadedRegions, filesRemaining,
// regionsPerFile, and the cached DOM refs) as module-level `let` bindings, not
// inside a factory/instance object. initLoaderProgress() re-seeds most of
// that state but does NOT reset `loadedRegions` — so re-using one module
// instance across tests would leak the running count from one test into the
// next. Each test therefore resets the module registry and re-imports fresh,
// exactly as a real page load only ever initialises the loader once.
let initLoaderProgress: typeof import("../src/components/loader-progress.js").initLoaderProgress;
let trackFile: typeof import("../src/components/loader-progress.js").trackFile;

beforeEach(async () => {
  vi.resetModules();
  ({ initLoaderProgress, trackFile } = await import("../src/components/loader-progress.js"));

  document.body.innerHTML = `
    <div class="loader-rail"><div id="loader-rail-fill"></div></div>
    <span id="loader-n">0</span>
    <span id="loader-total">—</span>
    <span id="loader-source"></span>
  `;
});

function railWidth(): number {
  return parseFloat(document.getElementById("loader-rail-fill")!.style.width);
}

function shownSource(): string {
  return document.getElementById("loader-source")!.textContent!;
}

function shownCount(): number {
  return parseInt(document.getElementById("loader-n")!.textContent!.replace(/,/g, ""), 10);
}

describe("loader-progress counter coherence", () => {
  it("lands on exactly totalRegions once every tracked file has resolved", async () => {
    const totalRegions = 459;
    const totalFiles = 135; // must equal the number of trackFile() calls below
    initLoaderProgress(totalRegions, totalFiles);

    for (let i = 0; i < totalFiles; i++) {
      await trackFile(Promise.resolve(i), `source-${i}`);
    }

    expect(shownCount()).toBe(totalRegions);
  });

  it("never shows more than totalRegions at any intermediate step when totalFiles is accurate", async () => {
    const totalRegions = 459;
    const totalFiles = 135;
    initLoaderProgress(totalRegions, totalFiles);

    for (let i = 0; i < totalFiles; i++) {
      await trackFile(Promise.resolve(i), `source-${i}`);
      expect(shownCount()).toBeLessThanOrEqual(totalRegions);
    }
  });

  it("regression: an undercounted totalFiles overshoots the total — reproduces the '468 / 459 regions' production bug", async () => {
    // This is the exact incident: src/index.md hardcoded _LOADER_FILE_COUNT
    // (the totalFiles argument below) at 132, but the Promise.all([...]) array
    // it described actually had 135 trackFile(...) entries. Once the 132nd
    // file resolved, trackFile()'s mop-up-on-last-file logic (filesRemaining
    // === 0) fired early and pinned the counter to the full 459 — then each
    // of the 3 remaining files added another regionsPerFile share on top.
    // The fix (src/index.md) derives totalFiles from the tracked array's own
    // .length so this pair can never drift apart again; this test pins the
    // failure mode so a future reviewer can see exactly what "incoherent"
    // looked like without re-deriving the arithmetic from scratch.
    const totalRegions = 459;
    const declaredFiles = 132; // stale, hand-maintained count (the bug)
    const actualFiles = 135; // real number of trackFile() calls that occurred

    initLoaderProgress(totalRegions, declaredFiles);
    for (let i = 0; i < actualFiles; i++) {
      await trackFile(Promise.resolve(i), `source-${i}`);
    }

    expect(shownCount()).toBe(468);
    expect(shownCount()).toBeGreaterThan(totalRegions); // the incoherent state itself
  });

  it("when totalFiles is accurate, the same undercounted-vs-actual gap cannot occur", async () => {
    // Same scenario as above, but with totalFiles corrected to match the
    // real number of resolves — demonstrating the fix's invariant holds even
    // at the exact numbers involved in the original incident.
    const totalRegions = 459;
    const totalFiles = 135;

    initLoaderProgress(totalRegions, totalFiles);
    for (let i = 0; i < totalFiles; i++) {
      await trackFile(Promise.resolve(i), `source-${i}`);
    }

    expect(shownCount()).toBe(totalRegions);
  });
});

// The five-row scrolling terminal this module used to drive was removed when
// the animated mark became the motion on the loading screen. These cover what
// replaced it: a determinate rail measured in files, and the name of the
// source that landed last.
describe("loader-progress rail and source label", () => {
  it("fills the rail in step with files resolved, reaching 100% exactly", async () => {
    const totalFiles = 10;
    initLoaderProgress(459, totalFiles);
    expect(railWidth()).toBe(0);

    for (let i = 1; i <= totalFiles; i++) {
      await trackFile(Promise.resolve(i), `source-${i}`);
      expect(railWidth()).toBeCloseTo((i / totalFiles) * 100, 1);
    }

    expect(railWidth()).toBe(100);
  });

  it("clamps the rail at 100% when more files resolve than were declared", async () => {
    // Same drift as the '468 / 459 regions' incident below, seen from the
    // rail's side: the counter overshoots, the rail must not.
    initLoaderProgress(459, 3);
    for (let i = 0; i < 5; i++) await trackFile(Promise.resolve(i), `source-${i}`);
    expect(railWidth()).toBe(100);
  });

  it("names the source that resolved last, and starts empty", async () => {
    initLoaderProgress(459, 2);
    expect(shownSource()).toBe("");

    await trackFile(Promise.resolve(1), "National Grid ESO");
    expect(shownSource()).toBe("National Grid ESO");

    await trackFile(Promise.resolve(2), "AEMO");
    expect(shownSource()).toBe("AEMO");
  });

  it("does not throw when the loader markup is absent", async () => {
    document.body.innerHTML = "";
    initLoaderProgress(459, 2);
    await expect(trackFile(Promise.resolve(1), "AEMO")).resolves.toBe(1);
  });
});
