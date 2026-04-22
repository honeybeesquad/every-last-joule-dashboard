import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Copy every built `dist/_file/data/<name>.<hash>.json` into a dated
 * `data/snapshots/YYYY-MM-DD/<name>.json`.  Drops the hash, keeps the
 * original payload.  Intended to run after `npm run build`.
 */
function run() {
  const distDataDir = join(process.cwd(), "dist", "_file", "data");
  let entries: string[];
  try {
    entries = readdirSync(distDataDir);
  } catch (err) {
    console.error(`No built data dir at ${distDataDir}. Did you run npm run build first?`);
    process.exit(1);
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const snapshotDir = join(process.cwd(), "data", "snapshots", today);
  mkdirSync(snapshotDir, { recursive: true });

  let copied = 0;
  for (const file of entries) {
    if (!file.endsWith(".json")) continue;
    // File pattern: <name>.<8-hex-hash>.json  → strip hash.
    const match = file.match(/^(.+?)\.[0-9a-f]+\.json$/);
    const cleanName = match ? `${match[1]}.json` : file;
    const src = join(distDataDir, file);
    const dst = join(snapshotDir, cleanName);
    writeFileSync(dst, readFileSync(src));
    copied += 1;
  }

  console.log(`Wrote ${copied} snapshot file(s) to ${snapshotDir}`);
}

run();
