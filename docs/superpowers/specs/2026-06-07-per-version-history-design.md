# Per-version value history — design spec

**Status:** DESIGN — approved in brainstorm 2026-06-07. Plan to be written (writing-plans) in the build session.
**Branch:** `feat/version-history`

---

## 1. Problem

ELJ is versioned and DOI'd per release (git tags `v1.0.0`…`v1.3.2` + Zenodo), but there is **no queryable artifact recording how a region's headline numbers changed across versions.** When the Brazil ONS formula fix dropped the global total ~25% at v1.3.2, a reader could only discover it by hand-diffing snapshots across commits. There's a daily `curtailment_history.parquet` (keyed by *date*), but nothing keyed by *dataset version*. This is an auditability/FAIR gap: dataset evolution should be inspectable.

## 2. Goal / non-goals

**Goal:** a committed, queryable table with one row per region per dataset version, capturing the headline values + tier/provenance, generated deterministically from the committed snapshots at each tag.

**Non-goals (YAGNI):**
- No per-version hourly profiles (those already live in git at each tag).
- No CI gate enforcing the artifact is current (add later only if drift appears).
- No UI surface — this is a dataset/audit artifact, not a dashboard feature.

## 3. Artifact

`data/historical/version-history.csv` — append-only, sorted by (version, region_id):

```
version,region_id,total_twh,peak_gw,confidence_tier,source_provenance
1.3.2,brazil-bahia-wind,3.21,0.84,T1a-live-tso,verified
...
```

CSV (not parquet): git-diffable, transparent, small (~235 regions × 8 versions ≈ 1,900 rows), queryable in DuckDB/pandas. Captures tier changes across versions as well as value changes (e.g. `japan-tepco` T3→T1a).

## 4. Builder — `scripts/build-version-history.ts`

- **Pure extraction fn** `extractTotals(snapshotObj) → {regionId,totalTWh,peakGW,confidenceTier,sourceProvenance}[]` — handles both snapshot shapes (single `RegionData` and `Record<id,RegionData>`), skips non-region files (`cbeci.json`). Mirrors the enumeration in `scripts/validate-snapshots.ts`. Tolerant of older snapshots missing `confidenceTier`/`sourceProvenance` (emit empty).
- **Default mode:** read working-tree `data/snapshots/last-good/*.json` + `package.json` version → upsert that version's rows into the CSV (replace existing rows for that version; append if new).
- **`--backfill` mode:** for each `v*.*.*` git tag, enumerate `git ls-tree <tag> data/snapshots/last-good/` and `git show <tag>:<path>` each file, extract rows. One-time; produces v1.0.0→v1.3.2 history including the Brazil drop.
- Deterministic; no network.

## 5. Tests — `tests/build-version-history.test.ts`

Unit-test `extractTotals` on: a single-region snapshot, a multi-region `Record` snapshot, a record missing tier/provenance, and the `cbeci.json` shape (→ skipped/empty). (Git-tag iteration is verified by running `--backfill` and spot-checking row counts.)

## 6. Integration

- `npm run version-history` (default mode) added to package.json scripts.
- One line in the release process (run at version bump, alongside the Zenodo mint — see [[zenodo-release-workflow]]) so each release records itself.
- DuckDB query example in `dataset/README.md` (e.g. "how did region X change across versions").
- Note the new auditability artifact in `dataset/FAIR.md`.

## 7. Build session notes

Small, mechanical feature. The build session should: run `writing-plans` from this spec, then implement on Sonnet (TDD on `extractTotals`, run `--backfill` to generate the CSV, commit the CSV, wire the npm script + docs), then PR. No data-integrity gates affected (`typecheck` + `vitest` only).
