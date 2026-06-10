/**
 * One-shot migration: enrich every cached snapshot under
 * `data/snapshots/last-good/*.json` with the S2 uncertainty fields
 * (`confidenceTier`, `uncertaintyLowGW`, `uncertaintyHighGW`).
 *
 * The dataset paper (Scientific Data submission) and the schema both claim
 * every emitted RegionData carries these fields, but historically the
 * loaders set them only inconsistently. This script reads each snapshot,
 * looks up the loader's tier+profileKind, and runs `applyUncertainty` so
 * the on-disk JSON matches the documented schema.
 *
 * Idempotent — sub-regions that already carry `confidenceTier` are left
 * untouched (preserves loader-specific classifications).
 *
 * Usage:
 *   tsx scripts/migrate-snapshot-tiers.ts        # patch in place
 *   tsx scripts/migrate-snapshot-tiers.ts --dry  # report only
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { applyUncertainty, type TierInputs } from "../src/lib/uncertainty.js";
import type { RegionData } from "../src/lib/types.js";

// ---------------------------------------------------------------------------
// Loader → profileKind map (parsed from src/data/*.json.ts grep)
// ---------------------------------------------------------------------------
//
// "live"  → regionTier="live", no profileKind (T1-live-TSO)
// "anchored" → regionTier="anchored", no profileKind (T2-annual-calibrated)
// otherwise → regionTier="estimated" + the named profileKind
//
// Multi-region loaders (aemo, brazil-ne, entsoe, ercot, ercot-native, norway)
// emit Record<regionId, RegionData>; every sub-region inherits the loader's
// tier. The split-out static specs in `statics.json.ts` are handled via
// per-id overrides (STATICS_PROFILE_KIND below) since they share one snapshot
// file but have different profileKinds (flat vs solar vs hydro-seasonal).

type ProfileKind = NonNullable<TierInputs["profileKind"]>;
type LoaderClass =
  | { tier: "live" }
  | { tier: "anchored" }
  | { tier: "estimated"; profileKind: ProfileKind };

const LOADER_CLASS: Record<string, LoaderClass> = {
  // Live loaders — regionTier="live"
  aemo:           { tier: "live" },
  alberta:        { tier: "live" },
  "atacama-chile":{ tier: "live" },
  belgium:        { tier: "live" },
  bpa:            { tier: "live" },
  "brazil-ne":    { tier: "live" },
  caiso:          { tier: "live" },
  denmark:        { tier: "live" },
  entsoe:         { tier: "live" },
  ercot:          { tier: "live" },
  "ercot-native": { tier: "live" },
  france:         { tier: "live" },
  ireland:        { tier: "live" },
  "iso-ne":       { tier: "live" },
  japan:          { tier: "live" },
  miso:           { tier: "live" },
  "new-zealand":  { tier: "live" },
  "north-sea":    { tier: "live" },
  norway:         { tier: "live" },
  nyiso:          { tier: "live" },
  ontario:        { tier: "live" },
  peru:           { tier: "live" },
  pjm:            { tier: "live" },
  "south-africa": { tier: "live" },
  spp:            { tier: "live" },
  turkey:         { tier: "live" },
  uruguay:        { tier: "live" },
  "wa-swis":      { tier: "live" },
  "chile-wind":   { tier: "live" },

  // Static loaders → buildTypicalXxx → profileKind
  argentina:        { tier: "estimated", profileKind: "wind" },
  bangladesh:       { tier: "estimated", profileKind: "solar" },
  "british-columbia":{tier: "estimated", profileKind: "hydro-seasonal" },
  cyprus:           { tier: "estimated", profileKind: "solar" },
  egypt:            { tier: "estimated", profileKind: "solar" },
  ethiopia:         { tier: "estimated", profileKind: "hydro-seasonal" },
  gansu:            { tier: "estimated", profileKind: "mixed" },
  honduras:         { tier: "estimated", profileKind: "solar" },
  "india-east":     { tier: "estimated", profileKind: "solar" },
  "india-north":    { tier: "estimated", profileKind: "solar" },
  "india-south":    { tier: "estimated", profileKind: "mixed" },
  "india-west":     { tier: "estimated", profileKind: "mixed" },
  indonesia:        { tier: "estimated", profileKind: "solar" },
  "inner-mongolia": { tier: "estimated", profileKind: "wind" },
  iran:             { tier: "estimated", profileKind: "solar" },
  "iraq-mainland":  { tier: "estimated", profileKind: "solar" },
  israel:           { tier: "estimated", profileKind: "solar" },
  // japan: promoted live in Phase-2.6 (2026-04-26); see live block above.
  jeju:             { tier: "estimated", profileKind: "wind" },
  jordan:           { tier: "estimated", profileKind: "solar" },
  kazakhstan:       { tier: "estimated", profileKind: "wind" },
  kenya:            { tier: "estimated", profileKind: "overnight" },
  kurdistan:        { tier: "estimated", profileKind: "solar" },
  malaysia:         { tier: "estimated", profileKind: "solar" },
  manitoba:         { tier: "estimated", profileKind: "mixed" },
  mexico:           { tier: "estimated", profileKind: "solar" },
  mongolia:         { tier: "estimated", profileKind: "wind" },
  morocco:          { tier: "estimated", profileKind: "wind" },
  namibia:          { tier: "estimated", profileKind: "solar" },
  ningxia:          { tier: "estimated", profileKind: "mixed" },
  "nt-pilbara":     { tier: "estimated", profileKind: "solar" },
  oman:             { tier: "estimated", profileKind: "solar" },
  pakistan:         { tier: "estimated", profileKind: "mixed" },
  paraguay:         { tier: "estimated", profileKind: "hydro-seasonal" },
  qinghai:          { tier: "estimated", profileKind: "solar" },
  quebec:           { tier: "estimated", profileKind: "hydro-seasonal" },
  "russia-mainland":{ tier: "estimated", profileKind: "hydro-seasonal" },
  saskatchewan:     { tier: "estimated", profileKind: "wind" },
  "saudi-solar":    { tier: "estimated", profileKind: "solar" },
  "south-korea":    { tier: "estimated", profileKind: "solar" },
  taiwan:           { tier: "estimated", profileKind: "solar" },
  thailand:         { tier: "estimated", profileKind: "solar" },
  tibet:            { tier: "estimated", profileKind: "hydro-seasonal" },
  uae:              { tier: "estimated", profileKind: "solar" },
  vietnam:          { tier: "estimated", profileKind: "solar" },
  // wa-swis: promoted live in Phase-2.6 (2026-04-26); see live block above.
  yunnan:           { tier: "estimated", profileKind: "hydro-seasonal" },

  // Orphan snapshot — `ukraine.json` predates the move into statics.json.ts.
  // Still read by index.md's regionData merge, so must carry tier metadata.
  // Kind: solar, matching STATIC_REGIONS.ukraine in statics.json.ts.
  ukraine:          { tier: "estimated", profileKind: "solar" },

  // Bitcoin hashrate — not a region, skip.
  cbeci:            { tier: "estimated", profileKind: "flat" }, // unused; isRegionData() guards
};

/**
 * Per-region overrides for the `statics` snapshot, which holds multiple
 * sub-regions with mixed profileKinds. Mirrors `STATIC_REGIONS` in
 * `src/data/statics.json.ts`.
 */
const STATICS_PROFILE_KIND: Record<string, ProfileKind> = {
  sichuan:                "hydro-seasonal",
  xinjiang:               "solar",
  iceland:                "hydro-seasonal",
  ukraine:                "solar",
  "hawaii-oahu":          "solar",
  "hawaii-maui":          "solar",
  "hawaii-island":        "solar",
  austria:                "flat",
  "russia-murmansk-wind": "flat",
};

function isRegionData(value: unknown): value is RegionData {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { regionId?: unknown }).regionId === "string" &&
    Array.isArray((value as { profile?: unknown }).profile)
  );
}

/**
 * Per-region B4-Option-B overrides — sub-zones inside a "live" loader that
 * actually classify as T1b (domestic-anchor-modelled) or T1c (neighbour-
 * extrapolated) per the locked decision in
 * `docs/proposals/b4-option-b-decision.md` (post-B1 rerun 2026-04-26).
 *
 * The underlying loader (e.g. entsoe) still passes through as "live"; this
 * map gives a per-regionId override before falling back to the loader-level
 * tier. Mirrors the canonical REGIONS table — keep in sync.
 */
const LIVE_TIER_OVERRIDES: Record<string, "live-domestic-anchored" | "live-neighbour-anchored"> = {
  "italy-sardinia": "live-domestic-anchored",
  "italy-north-zone": "live-domestic-anchored",
  "netherlands": "live-domestic-anchored",
  "baltics": "live-domestic-anchored",
  "switzerland": "live-neighbour-anchored",
};

function tierInputsFor(loaderId: string, regionId: string): TierInputs | null {
  if (loaderId === "statics") {
    const kind = STATICS_PROFILE_KIND[regionId];
    if (!kind) return null;
    if (kind === "flat") return { regionTier: "anchored", profileKind: "flat" };
    return { regionTier: "estimated", profileKind: kind };
  }
  const cls = LOADER_CLASS[loaderId];
  if (!cls) return null;
  if (cls.tier === "live") {
    const override = LIVE_TIER_OVERRIDES[regionId];
    if (override) return { regionTier: override };
    return { regionTier: "live" };
  }
  if (cls.tier === "anchored") return { regionTier: "anchored" };
  return { regionTier: "estimated", profileKind: cls.profileKind };
}

function enrichValue(loaderId: string, value: unknown): { changed: boolean; out: unknown } {
  if (value == null || typeof value !== "object") return { changed: false, out: value };

  if (isRegionData(value)) {
    if (value.confidenceTier) return { changed: false, out: value };
    const inputs = tierInputsFor(loaderId, value.regionId);
    if (!inputs) {
      console.warn(`  [skip] ${loaderId}/${value.regionId} — no tier mapping`);
      return { changed: false, out: value };
    }
    return { changed: true, out: applyUncertainty(value, inputs) };
  }

  // Multi-region: walk each sub-region.
  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  let changed = false;
  for (const [k, v] of Object.entries(record)) {
    if (isRegionData(v)) {
      if (v.confidenceTier) {
        out[k] = v;
        continue;
      }
      const inputs = tierInputsFor(loaderId, v.regionId);
      if (!inputs) {
        console.warn(`  [skip] ${loaderId}/${v.regionId} — no tier mapping`);
        out[k] = v;
        continue;
      }
      out[k] = applyUncertainty(v, inputs);
      changed = true;
    } else {
      out[k] = v;
    }
  }
  return { changed, out: changed ? out : value };
}

function main() {
  const dryRun = process.argv.includes("--dry");
  const dir = join(process.cwd(), "data", "snapshots", "last-good");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

  let touched = 0;
  let regionsEnriched = 0;
  let skipped = 0;

  for (const file of files.sort()) {
    const loaderId = file.replace(/\.json$/, "");
    const fullPath = join(dir, file);
    const raw = readFileSync(fullPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    // Skip the cbeci hashrate snapshot — not a RegionData.
    if (loaderId === "cbeci" || loaderId === "anchor") {
      skipped++;
      continue;
    }

    const { changed, out } = enrichValue(loaderId, parsed);
    if (!changed) continue;

    // Count enriched sub-regions for the report.
    if (isRegionData(out)) {
      regionsEnriched++;
    } else if (typeof out === "object" && out != null) {
      for (const v of Object.values(out as Record<string, unknown>)) {
        if (isRegionData(v) && v.confidenceTier) regionsEnriched++;
      }
    }

    touched++;
    if (dryRun) {
      console.log(`  [dry] ${file} would be patched`);
    } else {
      writeFileSync(fullPath, JSON.stringify(out));
      console.log(`  [ok]  ${file} patched`);
    }
  }

  console.log(`\nSummary: ${touched} file(s) ${dryRun ? "would be " : ""}patched, ${regionsEnriched} region entries enriched, ${skipped} skipped.`);
}

main();
