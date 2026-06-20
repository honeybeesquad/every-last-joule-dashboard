/**
 * Recursively find emitted `.json` files that fail to parse.
 *
 * Defence-in-depth companion to `loader-stdout-scan.ts` (PR #259). The scanner
 * catches the *cause* (a `console.log` in a data loader) at lint time; this
 * catches the *symptom* (a corrupt emitted JSON data file) at build time,
 * regardless of how the corruption got there. Run as a `postbuild` step it
 * fails the build before a broken `dist/` can be deployed.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface InvalidJsonFile {
  /** Absolute path to the offending file. */
  file: string;
  /** The JSON.parse error message. */
  error: string;
}

/**
 * Walk `rootDir` recursively and return every `.json` file whose contents do
 * not parse as JSON. A non-existent `rootDir` yields `[]` (nothing to
 * validate) rather than throwing, so callers can treat "no build output" as a
 * clean pass.
 */
export function findInvalidJsonFiles(rootDir: string): InvalidJsonFile[] {
  if (!existsSync(rootDir)) return [];

  const invalid: InvalidJsonFile[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        try {
          JSON.parse(readFileSync(full, "utf-8"));
        } catch (err) {
          invalid.push({ file: full, error: (err as Error).message });
        }
      }
    }
  };

  walk(rootDir);
  return invalid;
}
