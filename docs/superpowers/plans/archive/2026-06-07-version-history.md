# Version History Implementation Plan

> **STATUS: SHIPPED** — merged to main as PR #129, 2026-06-07.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an append-only `data/historical/version-history.csv` (one row per region per dataset version) generated deterministically from committed snapshots, with a TypeScript builder script and a matching npm run alias.

**Architecture:** A pure `extractTotals()` helper (unit-tested) handles both snapshot shapes (single-region and Record-of-regions). The CLI (`scripts/build-version-history.ts`) wraps it in default mode (working-tree → current version) and `--backfill` mode (git tag iteration). CSV upsert: read existing, drop rows for the version being written, append new rows, write. No network; no new npm packages.

**Tech Stack:** TypeScript, Node.js built-ins (`fs`, `child_process.execSync`), tsx (already used for all other scripts), vitest.

**Spec:** `docs/superpowers/specs/2026-06-07-per-version-history-design.md`

---

## File structure

| File | Responsibility |
|---|---|
| `scripts/build-version-history.ts` (**new**) | CLI: `extractTotals()`, CSV helpers, default + `--backfill` modes |
| `tests/build-version-history.test.ts` (**new**) | Unit tests for `extractTotals()` on all four snapshot shapes |
| `data/historical/version-history.csv` (**new, generated**) | Append-only artifact; committed after `--backfill` run |
| `dataset/README.md` (**modify**) | DuckDB query example |
| `dataset/FAIR.md` (**modify**) | One-line note on the new auditability artifact |
| `package.json` (**modify**) | `"version-history"` npm script |

---

## Task 1: `extractTotals()` + unit tests

**Files:**
- Create: `scripts/build-version-history.ts` (just the `extractTotals` export + types; no CLI yet)
- Test: `tests/build-version-history.test.ts`

- [ ] **Step 1: Write the failing tests** — `tests/build-version-history.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { extractTotals } from "../scripts/build-version-history.js";

// Single-region snapshot shape: top-level keys include regionId + profile.
const SINGLE: unknown = {
  regionId: "caiso-solar",
  profile: [],
  latestProfile: null,
  totalTWh: 1.23,
  peakGW: 0.45,
  lastUpdated: "2026-01-01T00:00:00.000Z",
  lastSuccessAt: "2026-01-01T01:00:00.000Z",
  confidenceTier: "T1a-live-tso",
  sourceProvenance: "verified",
};

// Multi-region Record snapshot: top-level keys are region IDs.
const MULTI: unknown = {
  "brazil-rn-wind": {
    regionId: "brazil-rn-wind",
    totalTWh: 2.0,
    peakGW: 0.9,
    confidenceTier: "T1a-live-tso",
    sourceProvenance: "verified",
  },
  "brazil-ce-solar": {
    regionId: "brazil-ce-solar",
    totalTWh: 0.5,
    peakGW: 0.2,
    confidenceTier: "T3-modelled",
    sourceProvenance: "modelled-fallback",
  },
};

// Missing tier/provenance — older snapshots before 2026-04-25 sweep.
const MISSING_FIELDS: unknown = {
  regionId: "old-region",
  profile: [],
  latestProfile: null,
  totalTWh: 0.7,
  peakGW: 0.1,
  lastUpdated: "2026-01-01T00:00:00.000Z",
  lastSuccessAt: "2026-01-01T01:00:00.000Z",
};

// cbeci.json shape — not a region snapshot.
const CBECI: unknown = {
  hashrateEHps: 600,
  annualisedConsumptionTWh: 130,
};

describe("extractTotals", () => {
  it("extracts one row from a single-region snapshot", () => {
    const rows = extractTotals("caiso.json", SINGLE, "1.3.2");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      version: "1.3.2",
      regionId: "caiso-solar",
      totalTWh: 1.23,
      peakGW: 0.45,
      confidenceTier: "T1a-live-tso",
      sourceProvenance: "verified",
    });
  });

  it("extracts one row per entry from a multi-region Record snapshot", () => {
    const rows = extractTotals("brazil-ne.json", MULTI, "1.3.2");
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.regionId).sort()).toEqual(["brazil-ce-solar", "brazil-rn-wind"]);
    expect(rows.find((r) => r.regionId === "brazil-rn-wind")?.totalTWh).toBe(2.0);
  });

  it("emits empty strings for missing confidenceTier / sourceProvenance", () => {
    const rows = extractTotals("old.json", MISSING_FIELDS, "1.0.0");
    expect(rows).toHaveLength(1);
    expect(rows[0].confidenceTier).toBe("");
    expect(rows[0].sourceProvenance).toBe("");
  });

  it("returns [] for cbeci.json (non-region file)", () => {
    expect(extractTotals("cbeci.json", CBECI, "1.3.2")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/build-version-history.test.ts
```
Expected: FAIL — cannot resolve `../scripts/build-version-history.js`.

- [ ] **Step 3: Implement `extractTotals` in `scripts/build-version-history.ts`**

```ts
#!/usr/bin/env tsx
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { execSync } from "node:child_process";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VersionRow {
  version: string;
  regionId: string;
  totalTWh: number;
  peakGW: number;
  confidenceTier: string;
  sourceProvenance: string;
}

interface SnapshotRegion {
  regionId?: string;
  totalTWh?: number;
  peakGW?: number;
  confidenceTier?: string;
  sourceProvenance?: string;
}

// ─── Snapshot shape detection (mirrors validate-snapshots.ts) ────────────────

const NON_REGION_FILES = new Set(["cbeci.json"]);

function isRecordOfRegions(obj: unknown): obj is Record<string, SnapshotRegion> {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return false;
  const o = obj as Record<string, unknown>;
  // Single-region: has regionId + profile at top level.
  if ("regionId" in o && "profile" in o) return false;
  return true;
}

function toRow(version: string, regionId: string, r: SnapshotRegion): VersionRow {
  return {
    version,
    regionId: r.regionId ?? regionId,
    totalTWh: r.totalTWh ?? 0,
    peakGW: r.peakGW ?? 0,
    confidenceTier: r.confidenceTier ?? "",
    sourceProvenance: r.sourceProvenance ?? "",
  };
}

/**
 * Extract VersionRows from a snapshot file's parsed JSON.
 * Returns [] for non-region files (cbeci.json) and unrecognised shapes.
 */
export function extractTotals(
  filename: string,
  parsed: unknown,
  version: string,
): VersionRow[] {
  if (NON_REGION_FILES.has(filename)) return [];
  if (typeof parsed !== "object" || parsed === null) return [];
  if (isRecordOfRegions(parsed)) {
    return Object.entries(parsed as Record<string, SnapshotRegion>).map(
      ([rid, r]) => toRow(version, rid, r),
    );
  }
  const r = parsed as SnapshotRegion;
  if (!r.regionId) return [];
  return [toRow(version, r.regionId, r)];
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/build-version-history.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add scripts/build-version-history.ts tests/build-version-history.test.ts
git commit -m "$(cat <<'EOF'
feat(dataset): extractTotals helper + unit tests (version-history builder)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: CSV helpers + default mode (working-tree → current version)

**Files:**
- Modify: `scripts/build-version-history.ts` (add CSV read/write, default mode CLI)
- Modify: `package.json` (add `version-history` script)

- [ ] **Step 1: Add CSV helpers and default mode** — append to `scripts/build-version-history.ts` after the `extractTotals` export:

```ts
// ─── CSV ─────────────────────────────────────────────────────────────────────

const CSV_HEADER = "version,region_id,total_twh,peak_gw,confidence_tier,source_provenance\n";
const HIST_PATH = join(process.cwd(), "data", "historical", "version-history.csv");
const SNAP_DIR = join(process.cwd(), "data", "snapshots", "last-good");

function rowToLine(r: VersionRow): string {
  return `${r.version},${r.regionId},${r.totalTWh},${r.peakGW},${r.confidenceTier},${r.sourceProvenance}`;
}

/** Read existing CSV and return all rows grouped by version. */
function readCsvRows(): Map<string, VersionRow[]> {
  const byVersion = new Map<string, VersionRow[]>();
  if (!existsSync(HIST_PATH)) return byVersion;
  const lines = readFileSync(HIST_PATH, "utf-8").trim().split("\n").slice(1); // skip header
  for (const line of lines) {
    if (!line.trim()) continue;
    const [version, regionId, totalTWhStr, peakGWStr, confidenceTier, sourceProvenance] =
      line.split(",");
    const row: VersionRow = {
      version,
      regionId,
      totalTWh: parseFloat(totalTWhStr),
      peakGW: parseFloat(peakGWStr),
      confidenceTier: confidenceTier ?? "",
      sourceProvenance: sourceProvenance ?? "",
    };
    if (!byVersion.has(version)) byVersion.set(version, []);
    byVersion.get(version)!.push(row);
  }
  return byVersion;
}

/** Upsert rows for a single version into the CSV. Replaces existing rows for that version. */
function upsertVersion(newRows: VersionRow[]): void {
  if (newRows.length === 0) return;
  const version = newRows[0].version;
  const byVersion = readCsvRows();
  byVersion.set(version, newRows);
  // Write sorted: versions alphabetically, then region_id within each version.
  const sorted = [...byVersion.keys()].sort();
  let csv = CSV_HEADER;
  for (const v of sorted) {
    const rows = [...(byVersion.get(v) ?? [])].sort((a, b) =>
      a.regionId.localeCompare(b.regionId),
    );
    csv += rows.map(rowToLine).join("\n") + "\n";
  }
  const dir = join(process.cwd(), "data", "historical");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(HIST_PATH, csv, "utf-8");
}

// ─── Default mode ─────────────────────────────────────────────────────────────

function currentVersion(): string {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8")) as {
    version: string;
  };
  return pkg.version;
}

function runDefault(): void {
  const version = currentVersion();
  const files = readdirSync(SNAP_DIR).filter((f) => f.endsWith(".json"));
  const rows: VersionRow[] = [];
  for (const f of files) {
    const parsed = JSON.parse(readFileSync(join(SNAP_DIR, f), "utf-8")) as unknown;
    rows.push(...extractTotals(f, parsed, version));
  }
  rows.sort((a, b) => a.regionId.localeCompare(b.regionId));
  upsertVersion(rows);
  console.log(`Wrote ${rows.length} rows for v${version} → ${HIST_PATH}`);
}
```

- [ ] **Step 2: Add the CLI entry point** — append at the bottom of `scripts/build-version-history.ts`:

```ts
// ─── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.includes("--backfill")) {
  // Implemented in Task 3.
  console.error("--backfill not yet implemented");
  process.exit(1);
} else {
  runDefault();
}
```

- [ ] **Step 3: Add the npm script** in `package.json`, after the `"test"` line:

```json
"version-history": "tsx scripts/build-version-history.ts",
```

- [ ] **Step 4: Smoke-test default mode**

```bash
npm run version-history
```
Expected output: `Wrote N rows for v1.3.2 → .../data/historical/version-history.csv`
Then inspect: `head -5 data/historical/version-history.csv` — should show the header + sorted rows.

- [ ] **Step 5: Verify the CSV shape**

```bash
head -5 data/historical/version-history.csv
wc -l data/historical/version-history.csv
```
Expected: header + one row per region (roughly 380–400 rows including multi-region splits). First data row should look like:
```
1.3.2,alberta-wind,0.123,0.045,T1a-live-tso,verified
```

- [ ] **Step 6: Run full test suite to confirm no regressions**

```bash
npm run typecheck && npx vitest run
```
Expected: typecheck clean; all tests pass.

- [ ] **Step 7: Commit** (do NOT commit `version-history.csv` yet — that comes after `--backfill` runs)

```bash
git add scripts/build-version-history.ts package.json
git commit -m "$(cat <<'EOF'
feat(dataset): version-history builder — CSV helpers + default mode

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `--backfill` mode (git tag iteration)

**Files:**
- Modify: `scripts/build-version-history.ts` (replace the stub with real backfill)

- [ ] **Step 1: Replace the `--backfill` stub** — find the `if (args.includes("--backfill"))` block at the bottom and replace it with:

```ts
if (args.includes("--backfill")) {
  runBackfill();
} else {
  runDefault();
}
```

Then add `runBackfill()` above the CLI block:

```ts
// ─── Backfill mode ────────────────────────────────────────────────────────────

/** List snapshot filenames present at a given git tag. */
function listTagFiles(tag: string): string[] {
  try {
    const out = execSync(`git ls-tree --name-only ${tag} data/snapshots/last-good/`, {
      encoding: "utf-8",
    });
    return out
      .trim()
      .split("\n")
      .filter((p) => p.endsWith(".json"))
      .map((p) => basename(p));
  } catch {
    return [];
  }
}

/** Read a file's content at a given git tag. Returns null on error. */
function showFileAtTag(tag: string, filename: string): string | null {
  try {
    return execSync(`git show ${tag}:data/snapshots/last-good/${filename}`, {
      encoding: "utf-8",
    });
  } catch {
    return null;
  }
}

function runBackfill(): void {
  // Tags matching vMAJOR.MINOR.PATCH exactly (no rc/alpha suffixes).
  const tags = execSync("git tag", { encoding: "utf-8" })
    .trim()
    .split("\n")
    .filter((t) => /^v\d+\.\d+\.\d+$/.test(t))
    .sort(); // lexicographic is correct for semver with same major

  console.log(`Backfilling ${tags.length} tags: ${tags.join(", ")}`);

  for (const tag of tags) {
    const version = tag.replace(/^v/, "");
    const files = listTagFiles(tag);
    const rows: VersionRow[] = [];
    for (const f of files) {
      const text = showFileAtTag(tag, f);
      if (!text) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        continue;
      }
      rows.push(...extractTotals(f, parsed, version));
    }
    rows.sort((a, b) => a.regionId.localeCompare(b.regionId));
    upsertVersion(rows);
    console.log(`  v${version}: ${rows.length} rows`);
  }
  console.log("Backfill complete →", HIST_PATH);
}
```

- [ ] **Step 2: Run `--backfill`**

```bash
npm run version-history -- --backfill
```
Expected output (approximate — row counts will vary by tag):
```
Backfilling 8 tags: v1.0.0, v1.1.0, v1.1.1, v1.2.0, v1.2.1, v1.3.0, v1.3.1, v1.3.2
  v1.0.0: 180 rows
  v1.1.0: 210 rows
  ...
  v1.3.2: 385+ rows
Backfill complete → .../data/historical/version-history.csv
```
If the row count for v1.3.2 is very different from `npm run version-history` (default), investigate — it likely means the tag's snapshot set differs from HEAD.

- [ ] **Step 3: Spot-check the Brazil drop**

```bash
grep "brazil" data/historical/version-history.csv | grep "bahia-wind" | sort
```
Expected: `total_twh` for `brazil-bahia-wind` should show a ~25% drop at v1.3.2 (ONS formula fix).

- [ ] **Step 4: Typecheck + full suite**

```bash
npm run typecheck && npx vitest run
```
Expected: clean.

- [ ] **Step 5: Commit the script change + the generated CSV**

```bash
git add scripts/build-version-history.ts data/historical/version-history.csv
git commit -m "$(cat <<'EOF'
feat(dataset): --backfill mode + version-history.csv (v1.0.0→v1.3.2)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Docs + PR

**Files:**
- Modify: `dataset/README.md`
- Modify: `dataset/FAIR.md`

- [ ] **Step 1: Add DuckDB example to `dataset/README.md`**

Find the `## Versioning` section and add after it (before `## Scope and limitations`):

```markdown
## Querying version history

`data/historical/version-history.csv` records each region's headline numbers across every dataset release. One row per region per version; sorted by version then region_id.

Example DuckDB query — how did Brazil Bahia wind curtailment change across releases?

```sql
SELECT version, region_id, total_twh, confidence_tier
FROM 'data/historical/version-history.csv'
WHERE region_id = 'brazil-bahia-wind'
ORDER BY version;
```

To compare all regions between two versions:

```sql
SELECT a.region_id,
       a.total_twh AS twh_v132,
       b.total_twh AS twh_v131,
       round(a.total_twh - b.total_twh, 4) AS delta
FROM 'data/historical/version-history.csv' a
JOIN 'data/historical/version-history.csv' b
  ON a.region_id = b.region_id
 AND a.version = '1.3.2'
 AND b.version = '1.3.1'
ORDER BY abs(delta) DESC;
```

Regenerate for a new release: `npm run version-history` (run after version bump, alongside the Zenodo mint).
```

- [ ] **Step 2: Add one line to `dataset/FAIR.md`** — find the `### R1.2` section ("(Meta)data are associated with detailed provenance", around line 305) and append to the existing bullet list in that section:

```markdown
- `data/historical/version-history.csv` — append-only table of headline values (totalTWh, peakGW, confidenceTier, sourceProvenance) per region per dataset version, enabling auditable inspection of how estimates evolved across releases (e.g. the Brazil ONS formula correction at v1.3.2).
```

- [ ] **Step 3: Typecheck + full suite one final time**

```bash
npm run typecheck && npx vitest run
```

- [ ] **Step 4: Commit docs + push + PR**

```bash
git add dataset/README.md dataset/FAIR.md
git commit -m "$(cat <<'EOF'
docs(dataset): version-history DuckDB example + FAIR.md note

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
git push -u origin feat/version-history
gh pr create --base main \
  --title "feat(dataset): per-version region history (version-history.csv + builder)" \
  --body "$(cat <<'PREOF'
## Summary

Adds an append-only \`data/historical/version-history.csv\` with one row per region per dataset version, generated deterministically from committed snapshots.

- \`scripts/build-version-history.ts\` — pure \`extractTotals()\` helper (handles single-region and Record-of-regions snapshot shapes) + default mode (working-tree → current package.json version) + \`--backfill\` mode (git tag iteration, v1.0.0→v1.3.2)
- \`npm run version-history\` — add to release process after version bump (alongside Zenodo mint)
- Spot-checkable Brazil ONS formula drop visible at v1.3.2 in the CSV
- DuckDB query example in dataset/README.md

Spec: docs/superpowers/specs/2026-06-07-per-version-history-design.md

## Test plan
- [x] \`extractTotals\` unit tests — 4 cases (single-region, multi-region Record, missing fields, cbeci.json)
- [x] \`npm run typecheck\` + \`npx vitest run\` green
- [x] \`npm run version-history -- --backfill\` runs cleanly; spot-checked Brazil bahia-wind drop at v1.3.2

🤖 Generated with [Claude Code](https://claude.com/claude-code)
PREOF
)"
```

---

## Notes for the executor

- **Commit trailer:** every commit message already includes `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`.
- **No data-integrity gates affected** — no tier, region, or snapshot changes. `typecheck` + `vitest` are the only required gates.
- **CSV is deterministic:** running `--backfill` twice produces an identical file (upsert replaces then re-sorts).
- **Version sorting:** `["v1.0.0","v1.1.0","v1.1.1","v1.2.0","v1.2.1","v1.3.0","v1.3.1","v1.3.2"].sort()` gives the right order for semver with the same major.
- **`v1.2.0-rc1` is excluded** by the `/^v\d+\.\d+\.\d+$/` regex — correct, pre-release tags are not stable dataset versions.
- **`data/historical/` already exists** (has curtailment_history.parquet etc.) — no `mkdir` needed for the directory itself, but `mkdirSync` in the code is a belt-and-suspenders guard.
