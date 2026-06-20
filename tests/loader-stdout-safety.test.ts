import { describe, it, expect } from "vitest";
import {
  scanForStdoutConsoleWrites,
  STDOUT_CONSOLE_METHODS,
} from "../scripts/lib/loader-stdout-scan.js";

// Regression guard for PR #259: a `console.log()` in src/data/ontario-per-plant.json.ts
// prepended a log line to the loader's stdout, which IS the emitted JSON data file.
// The corrupted data/ontario-per-plant.json then failed the dashboard's
// Promise.all(FileAttachment().json()) with a site-wide SyntaxError. The sibling
// loader src/data/aemo-per-plant.json.ts shows the correct pattern (console.warn → stderr).
//
// The scanner is AST-based, not a raw grep, precisely because the *fixed* Ontario
// loader documents the gotcha in a comment that contains the substring "console.log(" —
// a grep would false-positive on the very file that fixed the bug.

describe("scanForStdoutConsoleWrites", () => {
  it("flags a real console.log( call", () => {
    const findings = scanForStdoutConsoleWrites(`console.log("hi");`);
    expect(findings).toHaveLength(1);
    expect(findings[0].method).toBe("log");
  });

  it("does not flag console.warn — stderr, the sanctioned diagnostic channel", () => {
    expect(scanForStdoutConsoleWrites(`console.warn("diag");`)).toEqual([]);
  });

  it("does not flag console.error — stderr", () => {
    expect(scanForStdoutConsoleWrites(`console.error("boom");`)).toEqual([]);
  });

  it("flags console.info — it also writes to stdout and corrupts the data file", () => {
    const findings = scanForStdoutConsoleWrites(`console.info("hi");`);
    expect(findings).toHaveLength(1);
    expect(findings[0].method).toBe("info");
  });

  it("does NOT flag console.log inside a line comment (the PR #259 regression case)", () => {
    // This is verbatim the kind of explanatory comment the fixed Ontario loader carries.
    const src = [
      "// Diagnostics MUST go to stderr: this loader's stdout IS the data file, so",
      "// a stray console.log() corrupts the emitted JSON and breaks the dashboard.",
      'console.warn("ok");',
    ].join("\n");
    expect(scanForStdoutConsoleWrites(src)).toEqual([]);
  });

  it("does not flag console.log inside a block / JSDoc comment", () => {
    const src = ["/**", " * Never call console.log() here.", " */", "export const x = 1;"].join("\n");
    expect(scanForStdoutConsoleWrites(src)).toEqual([]);
  });

  it("does not flag the substring console.log( inside a string literal", () => {
    const src = `const note = "do not use console.log() in loaders";`;
    expect(scanForStdoutConsoleWrites(src)).toEqual([]);
  });

  it("does not flag process.stdout.write — the sanctioned data channel", () => {
    expect(scanForStdoutConsoleWrites(`process.stdout.write(JSON.stringify(data));`)).toEqual([]);
  });

  it("reports the 1-based line number of the offending call", () => {
    const src = ["const a = 1;", "const b = 2;", "console.log(b);"].join("\n");
    const findings = scanForStdoutConsoleWrites(src);
    expect(findings).toHaveLength(1);
    expect(findings[0].line).toBe(3);
  });

  it("finds every offending call when several stdout writers are present", () => {
    const src = ["console.log(1);", "console.debug(2);", "console.warn(3);", "console.table(4);"].join("\n");
    const findings = scanForStdoutConsoleWrites(src);
    expect(findings.map((f) => f.method).sort()).toEqual(["debug", "log", "table"]);
  });
});

describe("STDOUT_CONSOLE_METHODS", () => {
  it("includes the Node stdout writers (log/info/debug)", () => {
    expect(STDOUT_CONSOLE_METHODS.has("log")).toBe(true);
    expect(STDOUT_CONSOLE_METHODS.has("info")).toBe(true);
    expect(STDOUT_CONSOLE_METHODS.has("debug")).toBe(true);
  });

  it("excludes the stderr methods (warn/error) so diagnostics remain allowed", () => {
    expect(STDOUT_CONSOLE_METHODS.has("warn")).toBe(false);
    expect(STDOUT_CONSOLE_METHODS.has("error")).toBe(false);
  });
});
