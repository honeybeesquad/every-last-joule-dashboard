/**
 * AST scanner: find `console.<stdout-method>(...)` calls in a TypeScript source.
 *
 * Why this exists — PR #259 (production outage, 2026-06-20): an Observable
 * Framework data loader (`src/data/*.json.ts`) emits its JSON by writing to
 * stdout (`process.stdout.write(JSON.stringify(...))`). A stray `console.log()`
 * also writes to stdout, so it prepended a log line to the data file. The
 * corrupted `data/ontario-per-plant.json` then failed the dashboard's
 * `Promise.all(FileAttachment().json())` with a site-wide SyntaxError and froze
 * production on the loading screen. The sibling loader
 * `src/data/aemo-per-plant.json.ts` shows the correct pattern: diagnostics go to
 * stderr via `console.warn`.
 *
 * Why AST, not grep — the *fixed* Ontario loader documents the gotcha in a
 * comment that contains the substring "console.log(". A raw grep would
 * false-positive on the very file that fixed the bug (and on string literals
 * such as sourceNotes). Parsing the source and matching real CallExpression
 * nodes ignores comments and strings for free.
 */

import ts from "typescript";

export interface StdoutConsoleFinding {
  /** 1-based line number of the offending call. */
  line: number;
  /** 1-based column number of the offending call. */
  column: number;
  /** The console method name, e.g. "log" or "info". */
  method: string;
}

/**
 * Node `console` methods that write to **stdout** — the data loader's data
 * channel — and therefore corrupt the emitted JSON. The stderr methods
 * (`warn`, `error`, `trace`, `assert`) are safe and intentionally excluded:
 * diagnostics belong on stderr.
 */
export const STDOUT_CONSOLE_METHODS: ReadonlySet<string> = new Set([
  "log",
  "info",
  "debug",
  "dir",
  "dirxml",
  "table",
  "count",
  "countReset",
  "group",
  "groupCollapsed",
  "groupEnd",
  "timeEnd",
  "timeLog",
]);

/**
 * Return every `console.<stdout-method>(...)` call in `source`. Comments and
 * string literals are ignored because matching happens on the parsed AST.
 */
export function scanForStdoutConsoleWrites(
  source: string,
  fileName = "loader.ts",
): StdoutConsoleFinding[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );

  const findings: StdoutConsoleFinding[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const access = node.expression;
      if (
        ts.isIdentifier(access.expression) &&
        access.expression.text === "console" &&
        STDOUT_CONSOLE_METHODS.has(access.name.text)
      ) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile),
        );
        findings.push({ line: line + 1, column: character + 1, method: access.name.text });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return findings;
}
