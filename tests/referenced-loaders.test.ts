import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  listLoaders,
  readSiteSources,
  referencedFiles,
  selectLoaders,
  type Loader,
  type Selection,
} from "../scripts/lib/referenced-loaders.js";
import { DATA_LOADERS } from "../src/lib/data-loaders.js";
import type { StubFileAttachment } from "./stubs/observablehq-stdlib.js";

const ROOT = join(__dirname, "..");

describe("referencedFiles", () => {
  it("finds a data file however a page names it", () => {
    const refs = referencedFiles([
      'const f = FileAttachment("../data/ercot.json");',
      "const w = FileAttachment('data/countries-110m.json');",
      "const a = FileAttachment(`./data/aemo.json`);",
      "![Figure 1](./data/figure.svg)",
      '<img srcset="data/small.png 1x, data/large.png 2x">',
      "<img src=./data/unquoted.png>",
      'out.write("FileAttachment(\\"../data/escaped.json\\")");',
      "sql:\n  gen: ./data/generation.csv",
    ]);
    expect([...refs].sort()).toEqual([
      "aemo.json",
      "countries-110m.json",
      "ercot.json",
      "escaped.json",
      "figure.svg",
      "generation.csv",
      "large.png",
      "small.png",
      "unquoted.png",
    ]);
  });

  it("compares whole names, so one file never stands in for another", () => {
    const refs = referencedFiles([
      'FileAttachment("../data/ercot-native.json")',
      "// the loader is src/data/ercot.json.ts",
      'load("metadata/x.json"); load("data/sub/y.json");',
    ]);
    expect(refs.has("ercot-native.json")).toBe(true);
    expect(refs.has("ercot.json")).toBe(false);
    expect(refs.has("x.json")).toBe(false);
    expect(refs.has("y.json")).toBe(false);
    expect(referencedFiles(['FileAttachment("../data/ercot.json")']).has("ercot-native.json")).toBe(false);
  });

  it("reads the last data/ segment of a path that passes through data/ twice", () => {
    expect(referencedFiles(['FileAttachment("../data/../data/twice.json")']).has("twice.json")).toBe(true);
  });
});

describe("readSiteSources", () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "elj-referenced-loaders-"));
    const put = (path: string, text: string) => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    };
    put("observablehq.config.ts", 'export default { dynamicPaths: ["/data/config.json"] };');
    put("src/index.md", '```js\nconst x = FileAttachment("data/page.json");\n```');
    put("src/lib/registry.js", 'FileAttachment("../data/module.json")');
    put("src/region/[id].md.js", 'process.stdout.write(`FileAttachment("../data/page-loader.json")`)');
    put("src/data/self.json.ts", 'writeFileSync("data/self.json", out);');
    put("src/.observablehq/cache/index.md", 'FileAttachment("data/stale.json")');
    put("src/embed/.observablehq/page.md", 'FileAttachment("../data/nested-cache.json")');
    put("src/brand/mark.svg", "<text>data/svg.json</text>");
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("reads the config, pages, page loaders and modules, and skips the loaders and Framework's caches", () => {
    expect([...referencedFiles(readSiteSources(root))].sort()).toEqual([
      "config.json",
      "module.json",
      "page-loader.json",
      "page.json",
    ]);
  });
});

describe("selectLoaders", () => {
  const loader = (target: string): Loader => ({
    file: `/src/data/${target}.ts`,
    name: target.replace(/\.[a-z0-9]+$/, ""),
    target,
  });
  const loaders = [loader("a.json"), loader("b.json")];

  it("runs the loaders the sources name and skips the rest", () => {
    const { run, skip, fallback } = selectLoaders(loaders, () => ['FileAttachment("../data/a.json")']);
    expect(run.map((l) => l.target)).toEqual(["a.json"]);
    expect(skip.map((l) => l.target)).toEqual(["b.json"]);
    expect(fallback).toBeUndefined();
  });

  it("runs every loader when the sources cannot be read", () => {
    const { run, skip, fallback } = selectLoaders(loaders, () => {
      throw new Error("EACCES: permission denied");
    });
    expect(run).toEqual(loaders);
    expect(skip).toEqual([]);
    expect(fallback).toMatch(/EACCES/);
  });

  it("runs every loader when the sources name none of them", () => {
    const { run, skip, fallback } = selectLoaders(loaders, () => ["no data files here"]);
    expect(run).toEqual(loaders);
    expect(skip).toEqual([]);
    expect(fallback).toBeDefined();
  });
});

describe("the site's own loaders", () => {
  let selection: Selection;

  beforeAll(() => {
    selection = selectLoaders(listLoaders(join(ROOT, "src", "data")), () => readSiteSources(ROOT));
  });

  it("prefetches every file the loader registry attaches", () => {
    expect(selection.fallback).toBeUndefined();
    const prefetched = new Set(selection.run.map((l) => l.target));
    const attached = DATA_LOADERS.map((entry) => basename((entry.file as StubFileAttachment).path));
    expect(attached.length).toBeGreaterThan(100);
    expect(attached.filter((file) => !prefetched.has(file))).toEqual([]);
  });

  it("skips only the loader no page reads: the disabled ERCOT probe", () => {
    expect(selection.skip.map((l) => l.target)).toEqual(["ercot-native.json"]);
  });

  it("keeps no loader alive by a mention alone: each one it prefetches is attached somewhere", () => {
    // The search above also counts a bare "data/x.json" in a comment or in
    // prose. Today every prefetched loader is a FileAttachment as well, so a
    // new loader kept running only by a mention shows up here.
    const attached = new Set<string>();
    for (const source of readSiteSources(ROOT)) {
      for (const m of source.matchAll(/FileAttachment\(\s*["'`](?:\.{1,2}\/)*data\/([^"'`]+)["'`]\s*\)/g)) {
        attached.add(m[1]);
      }
    }
    expect(selection.run.map((l) => l.target).filter((target) => !attached.has(target))).toEqual([]);
  });
});
