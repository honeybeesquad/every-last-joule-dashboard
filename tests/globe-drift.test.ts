import { readFileSync } from "fs";
import { join } from "path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Guards `src/embed/globe.md` (the da-ri.org paper iframe) and `src/index.md`
// against the three failure modes that have actually shipped to production
// from these files:
//
//   1. SYNTAX. PR #830 appended a FileAttachment line without the comma on the
//      line above, so the whole block failed to parse and the embed rendered a
//      SyntaxError instead of the figure. No gate parsed the page as
//      JavaScript, so tsc, vitest and every CI gate stayed green.
//   2. ALIGNMENT. PR #203 inserted six India loaders into the `Promise.all`
//      array but appended their names *after* `pakistan, iran` in the array
//      destructuring, rotating eight bindings by six slots. Six regions
//      silently rendered another region's curtailment profile; three showed as
//      `malformed` in the integrity log. Both pages were affected.
//   3. DRIFT. The embed's regionData is a hand-maintained copy of the
//      dashboard's, so loaders added to `src/index.md` (AEMO per-plant, the
//      Italy zones, the US utilities, …) never reached the embed, and keys
//      split per fuel upstream (`mexico` → `mexico-{solar,wind}`) went stale.
//
// Both pages now derive their fetch list and their payload record from one
// keyed registry (`src/lib/data-loaders.js`), so a name is bound to a file by
// *name*, on one line, rather than by array position — mode 2 is no longer
// representable in a page. It is still representable in the registry itself
// (write `key: "pakistan"` beside `FileAttachment(".../iran.json")` and you
// have the #203 bug back), so the alignment assertion below moved there rather
// than being dropped.
//
// The parity assertion is what makes the remaining regionData duplication
// safe. Until the shared `buildRegionData()` extraction lands, adding a region
// to the dashboard MUST also add it to the embed or this test fails.

const REPO = join(__dirname, "..");
const INDEX = "src/index.md";
const EMBED = "src/embed/globe.md";
const REGISTRY = "src/lib/data-loaders.js";

/** Loaders the dashboard has that the embed deliberately does not. */
const EMBED_EXEMPT_LOADERS = new Set([
  // Version badge for the dashboard chrome, not a region. It is also a live
  // Zenodo fetch, which the embed must not block on.
  "zenodo-version",
]);

/** Variable names that intentionally differ from their data filename. */
const NAME_ALIASES: Record<string, string> = { atacama: "atacama-chile" };

interface Block {
  src: string;
  /** 1-based file line of the block's first code line. */
  firstLine: number;
}

function read(rel: string): string {
  return readFileSync(join(REPO, rel), "utf8");
}

function jsBlocks(md: string): Block[] {
  const lines = md.split("\n");
  const blocks: Block[] = [];
  let open = false;
  let firstLine = 0;
  let buf: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!open && /^```js\s*$/.test(lines[i])) {
      open = true;
      firstLine = i + 2;
      buf = [];
      continue;
    }
    if (open && /^```\s*$/.test(lines[i])) {
      open = false;
      blocks.push({ src: buf.join("\n"), firstLine });
      continue;
    }
    if (open) buf.push(lines[i]);
  }
  return blocks;
}

function syntaxErrors(block: Block): string[] {
  const out = ts.transpileModule(block.src, {
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
  });
  const file = ts.createSourceFile("block.ts", block.src, ts.ScriptTarget.ESNext, true);
  return (out.diagnostics ?? [])
    .filter((d) => d.category === ts.DiagnosticCategory.Error)
    .map((d) => {
      const line =
        d.start === undefined
          ? block.firstLine
          : block.firstLine + ts.getLineAndCharacterOfPosition(file, d.start).line;
      return `line ${line}: ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`;
    });
}

interface RegistryEntry {
  /** Identifier the pages read the payload as (`feeds.<key>`). */
  name: string;
  /** Data-file stem, e.g. `iso-ne` for `../data/iso-ne.json`. */
  file: string;
  /** false when the row carries `embed: false`. */
  embed: boolean;
  /** 1-based line in the registry, for a legible failure message. */
  line: number;
}

/**
 * Parse `src/lib/data-loaders.js` — the one declared mapping both pages fetch
 * from. Each row pairs a key with its FileAttachment on a single line:
 *
 *   { key: "isoNe", file: FileAttachment("../data/iso-ne.json"), label: "…" },
 *
 * Read as text rather than imported, because the module imports
 * `observablehq:stdlib`, which only Observable Framework resolves.
 *
 * A row that declares a key but no FileAttachment (or vice versa) is not
 * silently dropped: the row count is asserted against the number of `key:`
 * occurrences, so half-written rows fail rather than disappear.
 */
function registryEntries(): RegistryEntry[] {
  const src = read(REGISTRY);
  const start = src.indexOf("export const DATA_LOADERS = [");
  const end = src.indexOf("\n];", start);
  expect(start, "DATA_LOADERS array not found").toBeGreaterThan(-1);
  expect(end, "DATA_LOADERS array not terminated").toBeGreaterThan(start);

  const body = src.slice(start, end);
  const before = src.slice(0, start).split("\n").length;
  const entries: RegistryEntry[] = [];
  body.split("\n").forEach((raw, i) => {
    const m = /key:\s*"([^"]+)"\s*,\s*file:\s*FileAttachment\("([^"]+)"\)/.exec(raw);
    if (!m) return;
    entries.push({
      name: m[1],
      file: m[2].replace(/^.*\//, "").replace(/\.json$/, ""),
      embed: !/\bembed:\s*false\b/.test(raw),
      line: before + i,
    });
  });

  // Every `key:` in the array must have produced an entry — otherwise a
  // malformed row would vanish from every assertion below.
  expect(entries.length, "a DATA_LOADERS row is missing its key or FileAttachment").toBe(
    [...body.matchAll(/\bkey:\s*"/g)].length,
  );
  return entries;
}

/** Data-file stems a page fetches, via the registry it imports. */
function loaderFiles(rel: string): string[] {
  const md = read(rel);
  const all = registryEntries();
  if (rel === EMBED) {
    expect(md, "embed must load the embed subset").toContain("EMBED_DATA_LOADERS");
    return all.filter((e) => e.embed).map((e) => e.file);
  }
  expect(md, "dashboard must load the full registry").toContain(
    "loadDataFiles(DATA_LOADERS, trackFile)",
  );
  return all.map((e) => e.file);
}

function toKebab(name: string): string {
  return NAME_ALIASES[name] ?? name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/** Explicit keys and spread sources of a page's `const regionData = { … }`. */
function regionDataShape(md: string): { keys: string[]; spreads: string[] } {
  const start = md.indexOf("const regionData = {");
  const end = md.indexOf("finalizeRegionData(regionData", start);
  expect(start, "regionData literal not found").toBeGreaterThan(-1);
  expect(end, "finalizeRegionData call not found").toBeGreaterThan(start);

  const keys: string[] = [];
  const spreads: string[] = [];
  for (const raw of md.slice(start, end).split("\n")) {
    const s = raw.trim();
    if (!s || s.startsWith("//") || s.startsWith("*")) continue;
    // `...feeds.aemo,` — the dotted form since the loader payloads moved into
    // one `feeds` record. The spread source recorded is the loader key.
    let m = /^\.\.\.(?:feeds\.)?([A-Za-z_$][\w$]*)\s*,?$/.exec(s);
    if (m) {
      spreads.push(m[1]);
      continue;
    }
    if (s.startsWith("...")) continue; // inline IIFE spread (denmark); not enumerable
    m = /^"([^"]+)"\s*:/.exec(s);
    if (m) {
      keys.push(m[1]);
      continue;
    }
    // Shorthand properties (`mexico,`) count too — the pre-2026-09 version of
    // this test only matched `name:` and so missed four stale shorthand keys.
    m = /^([A-Za-z][\w-]*)\s*[:,]/.exec(s);
    if (m) keys.push(m[1]);
  }
  return { keys, spreads };
}

function canonicalRegionIds(): Set<string> {
  const rts = read("src/lib/regions.ts");
  return new Set([...rts.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]));
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

describe("src/lib/data-loaders.js", () => {
  it("has no JavaScript syntax errors", () => {
    expect(syntaxErrors({ src: read(REGISTRY), firstLine: 1 })).toEqual([]);
  });

  // THE #203 ASSERTION. It used to compare two parallel arrays by index; it now
  // compares the two halves of a single row. Same invariant, fewer ways to
  // break it: a name can only drift from its file if someone writes the wrong
  // FileAttachment beside the key, and that is what this catches.
  it("binds each loader key to the data file of the same name", () => {
    const entries = registryEntries();
    const pairs = entries.map((e) => `${REGISTRY}:${e.line} ${toKebab(e.name)} <- ${e.file}`);
    const expected = entries.map(
      (e) => `${REGISTRY}:${e.line} ${toKebab(e.name)} <- ${toKebab(e.name)}`,
    );
    expect(pairs).toEqual(expected);
  });

  it("declares every loader exactly once", () => {
    const entries = registryEntries();
    expect(entries.length).toBeGreaterThan(100);
    expect(new Set(entries.map((e) => e.name)).size).toBe(entries.length);
    expect(new Set(entries.map((e) => e.file)).size).toBe(entries.length);
  });

  it("flags exactly the documented embed exemptions", () => {
    const exempt = registryEntries()
      .filter((e) => !e.embed)
      .map((e) => e.file);
    expect(exempt.sort()).toEqual([...EMBED_EXEMPT_LOADERS].sort());
  });
});

describe.each([
  ["src/index.md", INDEX],
  ["src/embed/globe.md", EMBED],
])("%s", (_label, rel) => {
  const md = read(rel);

  it("has no JavaScript syntax errors in any fenced js block", () => {
    for (const block of jsBlocks(md)) {
      expect(syntaxErrors(block)).toEqual([]);
    }
  });

  // The registry is only load-bearing while it is the *only* place a data file
  // is named. A page-local `FileAttachment(...).json()` list would be a second
  // source of truth and could reintroduce the positional pairing. (The globe's
  // `FileAttachment("…/countries-110m.json").url()` is topology, not a loader,
  // and is deliberately not matched here.)
  it("fetches its data only through the registry", () => {
    expect([...md.matchAll(/FileAttachment\("([^"]+)"\)\s*\.json\(\)/g)].map((m) => m[1])).toEqual(
      [],
    );
  });

  it("reads only loader keys the registry declares", () => {
    const declared = new Set(registryEntries().map((e) => e.name));
    const used = [...md.matchAll(/\bfeeds\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(0);
    expect([...new Set(used)].filter((k) => !declared.has(k))).toEqual([]);
  });

  it("references only canonical region ids in regionData", () => {
    const canon = canonicalRegionIds();
    expect(regionDataShape(md).keys.filter((k) => !canon.has(k))).toEqual([]);
  });
});

describe("embed/globe.md parity with the dashboard", () => {
  const index = read(INDEX);
  const embed = read(EMBED);

  it("loads every dashboard loader except the documented exemptions", () => {
    const inIndex = loaderFiles(INDEX);
    const inEmbed = new Set(loaderFiles(EMBED));
    const missing = inIndex.filter((f) => !inEmbed.has(f) && !EMBED_EXEMPT_LOADERS.has(f));
    expect(missing).toEqual([]);
  });

  it("loads no region loader the dashboard does not", () => {
    const inIndex = new Set(loaderFiles(INDEX));
    expect(loaderFiles(EMBED).filter((f) => !inIndex.has(f))).toEqual([]);
  });

  it("assembles exactly the same regionData keys as the dashboard", () => {
    const a = regionDataShape(index);
    const b = regionDataShape(embed);
    expect([...new Set(b.keys)].sort()).toEqual([...new Set(a.keys)].sort());
    expect([...new Set(b.spreads)].sort()).toEqual([...new Set(a.spreads)].sort());
  });

  it("includes the German TSO zones and loads their loader", () => {
    const { keys } = regionDataShape(embed);
    const canon = canonicalRegionIds();
    for (const id of GERMAN_TSO_IDS) {
      expect(canon.has(id)).toBe(true);
      expect(keys).toContain(id);
    }
    expect(loaderFiles(EMBED)).toContain("germany-curtailment");
  });
});
