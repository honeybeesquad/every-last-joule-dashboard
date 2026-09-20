/**
 * build-mark-assets.ts — write the generated brand assets into src/brand/.
 *
 * Run with `npm run brand:assets`. The files are committed, not built on
 * deploy: the page loader must paint its mark from raw HTML before any
 * script runs, and `tests/brand-mark.test.ts` fails if a committed file
 * no longer matches what scripts/lib/brand-mark.ts renders.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { markAssets } from "../lib/brand-mark.js";

const SRC = join(process.cwd(), "src");

for (const [path, svg] of Object.entries(markAssets())) {
  const target = join(SRC, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, svg, "utf8");
  process.stdout.write(`wrote src/${path} (${svg.length} bytes)\n`);
}
