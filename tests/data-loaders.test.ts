import { beforeEach, describe, expect, it } from "vitest";

import {
  DATA_LOADERS,
  EMBED_DATA_LOADERS,
  loadDataFiles,
} from "../src/lib/data-loaders.js";
import { REGIONS } from "../src/lib/regions.js";
import { jsonCalls, type StubFileAttachment } from "./stubs/observablehq-stdlib.js";

// `tests/globe-drift.test.ts` reads the registry as text and asserts the
// key ↔ file pairing — the #203 guard. This file exercises the runtime side:
// that `loadDataFiles` returns each payload under its own key, fetches each
// file exactly once, and issues every fetch before awaiting any of them.
//
// FileAttachment comes from a stub (see vitest.config.ts) that keeps the
// literal path on the handle, so the registry is importable outside Observable
// Framework.

const pathOf = (entry: { file: unknown }) => (entry.file as StubFileAttachment).path;

beforeEach(() => {
  jsonCalls.length = 0;
});

describe("loadDataFiles", () => {
  it("returns each payload under its own key", async () => {
    const feeds = await loadDataFiles(DATA_LOADERS);
    expect(Object.keys(feeds)).toHaveLength(DATA_LOADERS.length);
    for (const entry of DATA_LOADERS) {
      // The stub echoes the path it was constructed with, so this asserts the
      // payload reachable at `feeds.<key>` really came from that key's file.
      expect(feeds[entry.key]).toEqual({ stub: true, path: pathOf(entry) });
    }
  });

  it("fetches each registered file exactly once", async () => {
    await loadDataFiles(DATA_LOADERS);
    expect(jsonCalls.sort()).toEqual(DATA_LOADERS.map(pathOf).sort());
  });

  // The loading terminal's counter only lands on REGIONS.length if
  // initLoaderProgress's totalFiles equals the number of trackFile() calls.
  // src/index.md passes DATA_LOADERS.length, so `wrap` must run once per entry
  // — no more (the "468 / 459" overshoot) and no fewer.
  it("calls the wrapper once per entry, with that entry's label", async () => {
    const seen: string[] = [];
    const feeds = await loadDataFiles(DATA_LOADERS, async (promise, label) => {
      seen.push(label);
      return promise;
    });
    expect(seen).toHaveLength(DATA_LOADERS.length);
    expect(seen.sort()).toEqual(DATA_LOADERS.map((e) => e.label).sort());
    expect(Object.keys(feeds)).toHaveLength(DATA_LOADERS.length);
  });

  it("issues every fetch before awaiting any of them", async () => {
    // If the fetches were serialised, the first `.json()` would resolve before
    // the last one had even been issued. Counting the calls made by the time
    // the microtask queue first drains proves they all went out together.
    const pending = loadDataFiles(DATA_LOADERS);
    expect(jsonCalls).toHaveLength(DATA_LOADERS.length);
    await pending;
  });

  it("returns an empty record for an empty registry", async () => {
    expect(await loadDataFiles([])).toEqual({});
  });
});

describe("EMBED_DATA_LOADERS", () => {
  it("is the registry minus the rows flagged embed: false", () => {
    const excluded = DATA_LOADERS.filter((e) => e.embed === false);
    expect(excluded.map((e) => e.key)).toEqual(["zenodoVersion"]);
    expect(EMBED_DATA_LOADERS).toHaveLength(DATA_LOADERS.length - excluded.length);
    expect(EMBED_DATA_LOADERS.map((e) => e.key)).toEqual(
      DATA_LOADERS.filter((e) => e.embed !== false).map((e) => e.key),
    );
  });

  it("does not fetch the exempt loaders", async () => {
    await loadDataFiles(EMBED_DATA_LOADERS);
    expect(jsonCalls).not.toContain("../data/zenodo-version.json");
    expect(jsonCalls).toHaveLength(EMBED_DATA_LOADERS.length);
  });
});

describe("DATA_LOADERS", () => {
  it("declares more loaders than there are canonical regions files to bundle", () => {
    // Sanity floor, not an exact count: `statics` bundles many regions into one
    // file and cbeci/anchor/zenodoVersion are not regions at all, so the two
    // numbers are not meant to match. This only catches a registry that has
    // been gutted.
    expect(DATA_LOADERS.length).toBeGreaterThan(100);
    expect(REGIONS.length).toBeGreaterThan(DATA_LOADERS.length);
  });

  it("gives every entry a key, a file and a non-empty label", () => {
    for (const entry of DATA_LOADERS) {
      expect(entry.key, JSON.stringify(entry)).toMatch(/^[A-Za-z_$][\w$]*$/);
      expect(pathOf(entry), entry.key).toMatch(/^\.\.\/data\/[a-z0-9-]+\.json$/);
      expect(entry.label.trim(), entry.key).not.toBe("");
    }
  });
});
