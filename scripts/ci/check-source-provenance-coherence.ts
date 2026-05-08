#!/usr/bin/env tsx
/**
 * CI gate: source-provenance coherence.
 *
 * After tier resolution, every Region must pair logically with its
 * `sourceProvenance`. This script enforces the legal (confidenceTier,
 * sourceProvenance) matrix and catches:
 *
 *   - The v1.1.1 India SLDC red-flag (T1a-live-tso tier + official-lead
 *     provenance), where a live loader is wired but emitting fallback data
 *     and the badge is unearned.
 *   - Impossible pairings such as a live tier with modelled-fallback, or
 *     a modelled tier with a verified upstream.
 *
 * Exits 0 on a clean pass, 1 on any legal-matrix violation, 2 on setup
 * errors (e.g. unresolved entries). Emits a per-violation line so CI logs
 * are actionable without re-running locally.
 *
 * The legal matrix is documented at
 * docs/methodology/tier-classification-guide.md#source-provenance-orthogonal-to-tier
 *
 * Usage:
 *   npx tsx scripts/ci/check-source-provenance-coherence.ts
 *   npx tsx scripts/ci/check-source-provenance-coherence.ts --self-test
 */

import { resolveAll, type ResolvedRegion } from "../lib/tier-resolution.js";
import type { ConfidenceTier } from "../../src/lib/uncertainty.js";
import type { SourceProvenance } from "../../src/lib/types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Provenance = SourceProvenance | undefined;

type ValidationResult =
  | { kind: "ok" }
  | { kind: "ok-warn"; reason: string }
  | { kind: "violation"; severity: "red-flag" | "impossible"; reason: string };

// ---------------------------------------------------------------------------
// Legal pair matrix
// ---------------------------------------------------------------------------

const LEGAL_PAIRS = new Set<string>([
  "T1a-live-tso|verified",
  "T1b-live-domestic-anchored|verified",
  "T1b-live-domestic-anchored|official-lead",
  "T1c-live-neighbour-anchored|verified",
  "T1c-live-neighbour-anchored|official-lead",
  "T2-annual-calibrated|verified",
  "T2-annual-calibrated|official-lead",
  "T2-annual-calibrated|modelled-fallback",
  "T3-modelled|official-lead",
  "T3-modelled|modelled-fallback",
]);

// T2-flare bucket is treated identically to T2-annual-calibrated for
// matrix-coherence purposes. (Existing ConfidenceTier enum doesn't include
// "T2-flare" as a tier label — flare regions resolve to T2-annual-calibrated
// at the tier level and only differ at the presentational bucket level.)
//
// The legacy "T1-live-TSO" alias (B4 Option B, see check-tier-coherence.ts)
// is intentionally not handled here. `deriveTier` in src/lib/uncertainty.ts
// no longer emits it; every live region resolves to T1a-live-tso at the tier
// level, so the alias cannot reach this gate via the canonical resolveAll()
// path. If a hand-edited snapshot ever bypasses tier resolution and surfaces
// with the alias, the catch-all "Illegal pairing" branch flags it — which is
// the correct outcome (the snapshot pre-dates tier-resolution uniformity and
// should be regenerated).
function normalizeTier(tier: ConfidenceTier): ConfidenceTier {
  return tier;
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

export function validatePair(
  tier: ConfidenceTier,
  provenance: Provenance,
): ValidationResult {
  if (provenance === undefined) {
    return {
      kind: "ok-warn",
      reason:
        "sourceProvenance not declared; cannot verify tier-provenance coherence (legacy region pending sweep).",
    };
  }

  const normTier = normalizeTier(tier);
  const key = `${normTier}|${provenance}`;

  if (LEGAL_PAIRS.has(key)) {
    return { kind: "ok" };
  }

  // Specific illegal pairings with actionable, named messages.

  if (tier === "T1a-live-tso" && provenance === "official-lead") {
    return {
      kind: "violation",
      severity: "red-flag",
      reason:
        "T1a-live-tso tier with official-lead sourceProvenance. This matches the v1.1.1 India SLDC bug: " +
        "the live loader is wired but emitting fallback data, giving an unearned confidence badge. " +
        "Either promote sourceProvenance to verified once the live path is producing real data, " +
        "or demote tier to static (T2/T3) until the lead becomes verified. " +
        "See docs/methodology/tier-classification-guide.md#source-provenance-orthogonal-to-tier.",
    };
  }

  if (
    (tier === "T1a-live-tso" ||
      tier === "T1b-live-domestic-anchored" ||
      tier === "T1c-live-neighbour-anchored") &&
    provenance === "modelled-fallback"
  ) {
    return {
      kind: "violation",
      severity: "impossible",
      reason: `Live tier ${tier} cannot have modelled-fallback sourceProvenance — live tiers require a live upstream feed.`,
    };
  }

  if (tier === "T3-modelled" && provenance === "verified") {
    return {
      kind: "violation",
      severity: "impossible",
      reason:
        "T3-modelled tier cannot have verified sourceProvenance. T3 means modelled; if a verified upstream exists, promote the tier.",
    };
  }

  return {
    kind: "violation",
    severity: "impossible",
    reason: `Illegal pairing: tier ${tier} with sourceProvenance ${provenance} is not in the legal matrix.`,
  };
}

// ---------------------------------------------------------------------------
// Main CI check
// ---------------------------------------------------------------------------

function main(): void {
  const { resolved, unresolved } = resolveAll();

  if (unresolved.length > 0) {
    console.error(
      `FATAL: ${unresolved.length} region(s) returned without a resolved tier:`,
    );
    for (const u of unresolved) {
      console.error(`  - ${u.id}: ${u.reason}`);
    }
    process.exit(2);
  }

  let violations = 0;
  let warnings = 0;
  let explicitCount = 0;
  let legacyCount = 0;

  for (const r of resolved) {
    const prov = r.region.sourceProvenance as Provenance;

    if (prov === undefined) {
      legacyCount++;
    } else {
      explicitCount++;
    }

    const result = validatePair(r.tier, prov);

    if (result.kind === "violation") {
      violations++;
      console.error(
        `ERROR: ${r.id} (${r.name}): tier=${r.tier} sourceProvenance=${prov ?? "undefined"} — [${result.severity}] ${result.reason}`,
      );
    } else if (result.kind === "ok-warn") {
      warnings++;
      // Suppressed by default; legacy regions are expected during sweep.
      // Uncomment for a verbose pass:
      // console.warn(`WARN: ${r.id} (${r.name}): tier=${r.tier} — ${result.reason}`);
    }
  }

  const total = resolved.length;
  console.log(
    `Checked ${total} regions: ${explicitCount} with explicit sourceProvenance, ${legacyCount} legacy (undefined), ${warnings} warnings, ${violations} violations.`,
  );

  if (violations > 0) {
    console.error(`\n${violations} legal-matrix violation(s) — see lines above.`);
    process.exit(1);
  }

  console.log("All declared (tier, sourceProvenance) pairs are legal.");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Self-test (synthetic fixtures)
// ---------------------------------------------------------------------------

function runSelfTest(): void {
  const results: string[] = [];
  let failed = false;

  function check(
    desc: string,
    tier: ConfidenceTier,
    prov: Provenance,
    expected: ValidationResult["kind"],
    extra?: { severity?: "red-flag" | "impossible" },
  ): void {
    const actual = validatePair(tier, prov);
    if (actual.kind !== expected) {
      results.push(
        `FAIL  ${desc}: expected kind="${expected}", got "${actual.kind}"`,
      );
      failed = true;
      return;
    }
    if (extra && extra.severity && actual.kind === "violation") {
      if (actual.severity !== extra.severity) {
        results.push(
          `FAIL  ${desc}: expected severity="${extra.severity}", got "${actual.severity}"`,
        );
        failed = true;
        return;
      }
    }
    results.push(`PASS  ${desc}`);
  }

  // Required fixtures from the brief — the load-bearing ones.

  check("T1a-live-tso + verified                         => ok", "T1a-live-tso", "verified", "ok");
  check(
    "T1a-live-tso + official-lead                    => violation/red-flag (v1.1.1 India bug)",
    "T1a-live-tso",
    "official-lead",
    "violation",
    { severity: "red-flag" },
  );
  check(
    "T1a-live-tso + modelled-fallback                => violation/impossible",
    "T1a-live-tso",
    "modelled-fallback",
    "violation",
    { severity: "impossible" },
  );
  check(
    "T3-modelled + verified                          => violation/impossible",
    "T3-modelled",
    "verified",
    "violation",
    { severity: "impossible" },
  );
  check(
    "T2-annual-calibrated + modelled-fallback        => ok",
    "T2-annual-calibrated",
    "modelled-fallback",
    "ok",
  );
  check("T1a-live-tso + undefined                        => ok-warn (legacy)", "T1a-live-tso", undefined, "ok-warn");

  // Additional sanity checks across the full matrix.

  check("T1b + verified                                  => ok", "T1b-live-domestic-anchored", "verified", "ok");
  check("T1b + official-lead                             => ok", "T1b-live-domestic-anchored", "official-lead", "ok");
  check(
    "T1b + modelled-fallback                         => violation/impossible",
    "T1b-live-domestic-anchored",
    "modelled-fallback",
    "violation",
    { severity: "impossible" },
  );
  check("T1c + verified                                  => ok", "T1c-live-neighbour-anchored", "verified", "ok");
  check("T1c + official-lead                             => ok", "T1c-live-neighbour-anchored", "official-lead", "ok");
  check(
    "T1c + modelled-fallback                         => violation/impossible",
    "T1c-live-neighbour-anchored",
    "modelled-fallback",
    "violation",
    { severity: "impossible" },
  );
  check("T2 + verified                                   => ok", "T2-annual-calibrated", "verified", "ok");
  check("T2 + official-lead                              => ok", "T2-annual-calibrated", "official-lead", "ok");
  check("T3 + official-lead                              => ok", "T3-modelled", "official-lead", "ok");
  check("T3 + modelled-fallback                          => ok", "T3-modelled", "modelled-fallback", "ok");

  console.log(results.join("\n"));

  if (failed) {
    console.error("\nSelf-test FAILED.");
    process.exit(1);
  }
  console.log("\nSelf-test passed.");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

if (process.argv.includes("--self-test")) {
  runSelfTest();
} else {
  main();
}
