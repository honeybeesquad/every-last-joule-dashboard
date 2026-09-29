/**
 * Which data loaders the site reads: the choice scripts/build/prefetch-loaders.ts
 * has to make the way `observable build` makes it.
 *
 * Framework runs a loader only when a page or module asks for its file: its
 * build collects the FileAttachment paths of every page and module and loads
 * those alone. A loader under src/data that nothing references never ran in a
 * build. The prefetch ran every file there, so from #967 (2026-09-10) every
 * production build also ran two loaders whose output it then dropped:
 * ercot-native, a disabled probe that logs "HTTP 400 Bad Request" from ERCOT's
 * API, and nigeria, whose region comes from statics.json.
 *
 * The test is textual: a file counts as referenced when "data/<file>" followed
 * by a quote appears in a source file under src/ outside src/data. It errs
 * towards running a loader (a mention in a comment counts), and a miss costs
 * time, not data: Framework runs a referenced loader itself when the prefetch
 * left it out.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Where pages and modules name data files: page sources and client modules. */
const SOURCE_RE = /\.(?:md|html|js|jsx|mjs|ts|tsx)$/;

/**
 * `data/<file>` directly before a closing quote. The lookbehind keeps
 * "metadata/x.json" from reading as "data/x.json"; the character class stops
 * at "/", so one stem never stands in for another.
 */
const REFERENCE_RE = /(?<![\w.-])data\/([\w.-]+)["'`]/g;

/** The data file names ("ercot.json") that these sources reference. */
export function referencedFiles(sources: Iterable<string>): Set<string> {
  const files = new Set<string>();
  for (const source of sources) {
    for (const match of source.matchAll(REFERENCE_RE)) files.add(match[1]);
  }
  return files;
}

/**
 * The text of every page and module under `srcDir`, skipping the loaders in
 * `srcDir/data` (a loader naming its own output is not a reader) and
 * Framework's cache.
 */
export function readPageSources(srcDir: string): string[] {
  const sources: string[] = [];
  const walk = (dir: string, top: boolean) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === ".observablehq" || entry.name === "node_modules") continue;
        if (top && entry.name === "data") continue;
        walk(join(dir, entry.name), false);
      } else if (entry.isFile() && SOURCE_RE.test(entry.name)) {
        sources.push(readFileSync(join(dir, entry.name), "utf8"));
      }
    }
  };
  walk(srcDir, true);
  return sources;
}
