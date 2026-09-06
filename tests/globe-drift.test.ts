import { readFileSync } from "fs";
import { join } from "path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Guards `src/embed/globe.md` (the da-ri.org paper iframe) against the three
// failure modes that have actually shipped to production from this file:
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
// The parity assertion below is what makes the duplication safe. Until the
// shared `buildRegionData()` extraction lands, adding a loader to the
// dashboard MUST also add it here or this test fails.

const REPO = join(__dirname, "..");
const INDEX = "src/index.md";
const EMBED = "src/embed/globe.md";

/** Loaders the dashboard has that the embed deliberately does not. */
const EMBED_EXEMPT_LOADERS = new Set([
  // Version badge for the dashboard chrome, not a region. It is also a live
  // Zenodo fetch inside the blocking Promise.all; the embed must not wait on it.
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

/**
 * The loader header of a page, in either shape it is written in:
 *
 *   inline    const [ … ] = await Promise.all([ …FileAttachment… ]);
 *   indirect  const _loaderFiles = [ …FileAttachment… ];
 *             const [ … ] = await Promise.all(_loaderFiles);
 *
 * The dashboard uses the indirect shape so the loading-terminal total can be
 * derived from `_loaderFiles.length` instead of a hand-maintained constant
 * (which desynced and made the counter overshoot to "468 / 459"). The embed
 * still uses the inline shape. Both must yield the same names/files pairing,
 * because the alignment assertion below is what stops the #203 rotation class
 * of bug recurring — so this reads whichever shape is present rather than
 * relaxing what is checked.
 */
function loaderHeader(md: string): { names: string[]; files: string[] } {
  const arrStart = md.indexOf("const _loaderFiles = [");
  const indirect = arrStart > -1;

  const start = md.indexOf("const [");
  const mid = indirect
    ? md.indexOf("] = await Promise.all(_loaderFiles);", start)
    : md.indexOf("] = await Promise.all([", start);
  expect(start, "loader destructuring not found").toBeGreaterThan(-1);
  expect(mid, "Promise.all not found").toBeGreaterThan(start);

  const names = md
    .slice(start + "const [".length, mid)
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join(",")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Files come from the FileAttachment list, wherever it lives.
  const fileFrom = indirect ? arrStart : mid;
  const fileTo = indirect ? md.indexOf("\n];", arrStart) : md.indexOf("]);", mid);
  expect(fileTo, "loader file list not terminated").toBeGreaterThan(fileFrom);

  const files = [...md.slice(fileFrom, fileTo).matchAll(/FileAttachment\("([^"]+)"\)/g)].map((m) =>
    m[1].replace(/^.*\//, "").replace(/\.json$/, ""),
  );

  return { names, files };
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
    let m = /^\.\.\.([A-Za-z_$][\w$]*)\s*,?$/.exec(s);
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

  it("binds each destructured name to the loader at the same index", () => {
    const { names, files } = loaderHeader(md);
    expect(names.length).toBe(files.length);
    const pairs = names.map((n, i) => `${toKebab(n)} <- ${files[i]}`);
    const expected = names.map((n) => `${toKebab(n)} <- ${toKebab(n)}`);
    expect(pairs).toEqual(expected);
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
    const inIndex = loaderHeader(index).files;
    const inEmbed = new Set(loaderHeader(embed).files);
    const missing = inIndex.filter((f) => !inEmbed.has(f) && !EMBED_EXEMPT_LOADERS.has(f));
    expect(missing).toEqual([]);
  });

  it("loads no region loader the dashboard does not", () => {
    const inIndex = new Set(loaderHeader(index).files);
    expect(loaderHeader(embed).files.filter((f) => !inIndex.has(f))).toEqual([]);
  });

  it("assembles exactly the same regionData keys as the dashboard", () => {
    const a = regionDataShape(index);
    const b = regionDataShape(embed);
    expect([...new Set(b.keys)].sort()).toEqual([...new Set(a.keys)].sort());
    expect([...new Set(b.spreads)].sort()).toEqual([...new Set(a.spreads)].sort());
  });

  it("includes the German TSO zones and imports their loader", () => {
    const { keys } = regionDataShape(embed);
    const canon = canonicalRegionIds();
    for (const id of GERMAN_TSO_IDS) {
      expect(canon.has(id)).toBe(true);
      expect(keys).toContain(id);
    }
    expect(embed).toContain('FileAttachment("../data/germany-curtailment.json")');
  });
});
