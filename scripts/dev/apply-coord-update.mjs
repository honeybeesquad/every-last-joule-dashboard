// Applies coord-candidates.json to src/lib/regions.ts in place.
// Matches each region by `id: "<id>"` and rewrites the lat/lon on that line.
// Bails if any candidate id isn't found exactly once.

import fs from "node:fs";

const candidates = JSON.parse(fs.readFileSync("scripts/dev/coord-candidates.json", "utf8"));
const path = "src/lib/regions.ts";
let text = fs.readFileSync(path, "utf8");

let changed = 0;
for (const c of candidates) {
  // Match a line containing `id: "<id>"` ... `lat: NN, lon: NN`. Capture
  // the lat/lon portion and rewrite while preserving surrounding spacing.
  const re = new RegExp(
    `(\\bid:\\s*"${c.id.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}".*?lat:\\s*)-?[0-9.]+(,\\s*lon:\\s*)-?[0-9.]+`,
    "g",
  );
  const before = text;
  text = text.replace(re, (_m, p1, p2) => `${p1}${c.lat}${p2}${c.lon}`);
  if (text !== before) {
    changed++;
  } else {
    console.error(`MISS ${c.id} — pattern not found`);
    process.exit(1);
  }
}

fs.writeFileSync(path, text);
console.log(`Updated ${changed} regions in ${path}`);
