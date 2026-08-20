import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

// Guards against src/embed/globe.md drift: the embed's regionData assembly
// must only reference canonical region ids (no stale keys like the old
// `germany-wind`/`germany-solar` that pointed at removed entsoe entries) and
// must include the German TSO zones that the live dashboard (src/index.md)
// already wires. Spread-imported loaders (...aemo, ...belgium, etc.) inject
// additional keys not enumerated explicitly; this test checks the EXPLICIT
// keys plus the known-required German TSO zones.

const REPO = join(__dirname, "..");

function readRegionIds(): Set<string> {
  const rts = readFileSync(join(REPO, "src/lib/regions.ts"), "utf8");
  return new Set([...rts.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]));
}

function explicitGlobeKeys(): string[] {
  const md = readFileSync(join(REPO, "src/embed/globe.md"), "utf8");
  const start = md.indexOf("const regionData = {");
  const end = md.indexOf("finalizeRegionData(regionData");
  const block = md.slice(start, end);
  const keys = new Set<string>();
  for (const line of block.split("\n")) {
    const s = line.trim();
    if (!s || s.startsWith("//") || s.startsWith("*")) continue;
    if (s.startsWith("...")) continue; // spread injects unknown keys; not enumerable
    let m = /^"([^"]+)"\s*:/.exec(s);
    if (m) { keys.add(m[1]); continue; }
    m = /^([a-zA-Z][a-zA-Z0-9_-]*)\s*:/.exec(s);
    if (m) { keys.add(m[1]); continue; }
  }
  return [...keys];
}

const GERMAN_TSO_IDS = [
  "germany-50hertz-wind",
  "germany-50hertz-solar",
  "germany-amprion-wind",
  "germany-amprion-solar",
  "germany-tennet-de-wind",
  "germany-tennet-de-solar",
  "germany-transnetbw-wind",
  "germany-transnetbw-solar",
];

describe("globe.md region-data drift", () => {
  const canon = readRegionIds();
  const keys = explicitGlobeKeys();

  it("references only canonical region ids (no stale keys)", () => {
    const stale = keys.filter((k) => !canon.has(k));
    expect(stale).toEqual([]);
  });

  it("includes the German TSO zones wired by the live dashboard", () => {
    for (const id of GERMAN_TSO_IDS) {
      expect(canon.has(id)).toBe(true); // region must be canonical
      expect(keys).toContain(id); // and present in the embed
    }
  });

  it("imports the germany-curtailment loader it references", () => {
    const md = readFileSync(join(REPO, "src/embed/globe.md"), "utf8");
    expect(md).toContain('FileAttachment("../data/germany-curtailment.json")');
    expect(md).toContain("germanyCurtailment");
  });
});
