#!/usr/bin/env tsx
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
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
    .sort();

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

// ─── CLI ─────────────────────────────────────────────────────────────────────

// Guard prevents CLI from running when this module is imported by tests.
import { pathToFileURL } from "node:url";
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.includes("--backfill")) {
    runBackfill();
  } else {
    runDefault();
  }
}
