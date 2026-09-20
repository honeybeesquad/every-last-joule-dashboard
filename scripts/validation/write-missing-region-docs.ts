#!/usr/bin/env tsx
/**
 * One-shot: write docs/validation/<id>.md for any REGIONS row that lacks one.
 * Matches the docs-drift contract: `- **Tier:** <Region.tier>` exact.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REGIONS } from "../../src/lib/regions.js";

const DIR = join(process.cwd(), "docs", "validation");
mkdirSync(DIR, { recursive: true });

function docFor(r: (typeof REGIONS)[number]): string {
  const source = r.source.replace(/\n/g, " ").trim();
  return `# Validation — ${r.name} (\`${r.id}\`)

Last updated: 2026-09-20 · Sprint: TSO-grid completeness · Paper section: Technical Validation §4.2

## Source

- **Region id:** \`${r.id}\`
- **Country:** ${r.country}
- **Tier:** ${r.tier}
- **Kind:** ${r.kind}
- **Source:** ${source}
- **Source URL:** [${r.sourceUrl}](${r.sourceUrl})
- **Loader:** _(see region source / TSO-grid completeness loaders)_
- **Structural gap:** no
- **Waste status:** unpublished unless the operator publishes a curtailment/spill series. Missing ≠ zero. Live generation does not make waste T1a.

## Calibration

- **Rate source documented in:** \`docs/methodology/\` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** —
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

Grid-completeness row. Waste is unpublished unless a later loader adds a published series. Do not read a zero \`profile\` as a measured finding.

## Known limitations

See \`docs/methodology/historical-backfill.md\` and STATUS.md TSO-grid completeness.

## Links

- Backfill archive: \`data/historical/backfill/*_${r.id}_*.parquet\` (0 years)
- Cross-cutting methodology: [\`docs/methodology/historical-backfill.md\`](../methodology/historical-backfill.md)
- Data source log: [\`docs/data-source-log.md\`](../data-source-log.md)
- Known limitations index: [\`docs/known-limitations.md\`](../known-limitations.md)
`;
}

let written = 0;
for (const r of REGIONS) {
  const path = join(DIR, `${r.id}.md`);
  if (existsSync(path)) continue;
  writeFileSync(path, docFor(r), "utf8");
  written += 1;
}
console.log(`wrote ${written} missing validation docs`);
