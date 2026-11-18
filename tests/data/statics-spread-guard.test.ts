import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { buildAllStatics } from "../../src/data/statics.json";

/**
 * Keys written before `...feeds.statics` are overwritten when statics emits
 * the same id. Jordan's 0.5 TWh/yr anchor hid the loader that way.
 */
function keysBeforeStaticsSpread(rel: string): string[] {
  const text = readFileSync(join(process.cwd(), rel), "utf8");
  const start = text.indexOf("const regionData = {");
  const slice = text.slice(start);
  const end = slice.indexOf("...feeds.statics,");
  const before = slice.slice(0, end);
  const keys: string[] = [];
  for (const line of before.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
    const match = trimmed.match(/^(?:"([^"]+)"|([A-Za-z][\w-]*))\s*:/);
    if (match) keys.push(match[1] || match[2]);
  }
  return keys;
}

describe("statics spread cannot overwrite an earlier region key", () => {
  const staticIds = new Set(Object.keys(buildAllStatics()));

  for (const page of ["src/index.md", "src/embed/globe.md"]) {
    it(page, () => {
      const overlap = keysBeforeStaticsSpread(page).filter((id) => staticIds.has(id));
      expect(overlap).toEqual([]);
    });
  }
});
