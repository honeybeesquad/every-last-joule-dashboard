import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { readPageSources, referencedFiles } from "../scripts/lib/referenced-loaders.js";

describe("referencedFiles", () => {
  it("finds data files named in FileAttachment calls, relative or not, in any quotes", () => {
    const refs = referencedFiles([
      'const f = FileAttachment("../data/ercot.json");',
      "const w = FileAttachment('data/countries-110m.json');",
      "const a = FileAttachment(`./data/aemo.json`);",
    ]);
    expect([...refs].sort()).toEqual(["aemo.json", "countries-110m.json", "ercot.json"]);
  });

  it("does not let one stem stand in for another", () => {
    expect(referencedFiles(['FileAttachment("../data/ercot.json")']).has("ercot-native.json")).toBe(false);
    expect(referencedFiles(['FileAttachment("../data/ercot-native.json")']).has("ercot.json")).toBe(false);
  });

  it("does not read metadata/x.json as data/x.json", () => {
    expect(referencedFiles(['load("metadata/x.json")']).has("x.json")).toBe(false);
  });
});

describe("readPageSources", () => {
  const root = mkdtempSync(join(tmpdir(), "elj-referenced-loaders-"));
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  const put = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };

  it("reads pages and modules, and skips the loaders themselves and Framework's cache", () => {
    put("index.md", '```js\nconst x = FileAttachment("data/page.json");\n```');
    put("lib/registry.js", 'FileAttachment("../data/module.json")');
    put("region/[id].md.js", 'process.stdout.write(`FileAttachment("../data/page-loader.json")`)');
    put("data/self.json.ts", 'writeFileSync("data/self.json", out);');
    put(".observablehq/cache/data/cached.json", '{"note":"data/cached.json"}');
    put(".observablehq/cache/index.md", 'FileAttachment("data/stale.json")');
    put("brand/mark.svg", '<text>data/svg.json"</text>');

    expect([...referencedFiles(readPageSources(root))].sort()).toEqual([
      "module.json",
      "page-loader.json",
      "page.json",
    ]);
  });
});

describe("the site's own src/", () => {
  const src = join(process.cwd(), "src");
  const referenced = referencedFiles(readPageSources(src));

  it("references every file the loader registry attaches, so the prefetch runs all of them", () => {
    const registry = readFileSync(join(src, "lib", "data-loaders.js"), "utf8");
    const attached = [...registry.matchAll(/FileAttachment\("\.\.\/data\/([^"]+)"\)/g)].map((m) => m[1]);
    expect(attached.length).toBeGreaterThan(100);
    expect(attached.filter((file) => !referenced.has(file))).toEqual([]);
  });

  it("does not reference ercot-native.json, the disabled ERCOT probe no page reads", () => {
    expect(referenced.has("ercot-native.json")).toBe(false);
  });
});
