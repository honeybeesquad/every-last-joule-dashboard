import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { findInvalidJsonFiles } from "../scripts/lib/json-output-validate.js";

// Defence-in-depth companion to the loader-stdout scanner (PR #259): after
// `observable build`, every emitted JSON data file must still parse. This
// catches stdout corruption from ANY cause, not just console.log.

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "elj-json-validate-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("findInvalidJsonFiles", () => {
  it("returns no findings when every .json file parses (including nested dirs)", () => {
    mkdirSync(join(dir, "data"), { recursive: true });
    writeFileSync(join(dir, "data", "ontario-per-plant.json"), '{"ok":true}');
    writeFileSync(join(dir, "top.json"), "[1,2,3]");
    expect(findInvalidJsonFiles(dir)).toEqual([]);
  });

  it("flags a .json file that does not parse (the #259 corruption)", () => {
    mkdirSync(join(dir, "data"), { recursive: true });
    // A stray log line prepended to JSON.stringify output — exactly the #259 shape.
    writeFileSync(
      join(dir, "data", "ontario-per-plant.json"),
      'ieso-per-plant: 11 plants above threshold\n{"ok":true}',
    );
    const findings = findInvalidJsonFiles(dir);
    expect(findings).toHaveLength(1);
    expect(findings[0].file).toContain("ontario-per-plant.json");
    expect(findings[0].error).toBeTruthy();
  });

  it("ignores non-.json files", () => {
    writeFileSync(join(dir, "notes.txt"), "this is not json at all {{{");
    expect(findInvalidJsonFiles(dir)).toEqual([]);
  });

  it("returns no findings for a directory that does not exist (nothing to validate)", () => {
    expect(findInvalidJsonFiles(join(dir, "does-not-exist"))).toEqual([]);
  });
});
