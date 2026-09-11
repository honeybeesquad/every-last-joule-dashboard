/**
 * Parse the region-count claims out of `src/methodology.md` and compare them
 * against the locked golden tier counts in `scripts/ci/golden/tier-counts.json`.
 *
 * Why this exists — PR #979: §2.1's five sub-tier headers had drifted from the
 * dataset and summed to 377 against an actual 459. T1a and T1b were last correct
 * on 2026-06-16 (#200), T2 on 2026-05-10 (#94), T3 on 2026-05-12 (v1.3.0) — so the
 * page was wrong for roughly three months and nothing caught it. `ci:tally-golden`
 * compares the golden file to `src/lib/regions.ts`; `ci:docs-drift` compares the
 * per-region validation docs to `regions.ts`. Neither reads methodology prose.
 *
 * The dangerous failure mode for a prose gate is passing by matching nothing: a
 * reworded header silently drops out of the sweep and the check goes green over a
 * claim it never read. Every parse here is therefore closed rather than open — the
 * five sub-tier keys must all be found, and at least MIN_TOTAL_CLAIMS total claims
 * must be found, or the gate fails and says which one went missing.
 */

/** The sub-tier buckets, matching `Bucket` in scripts/lib/tier-resolution.ts. */
export const SUB_TIER_KEYS = ["T1a", "T1b", "T1c", "T2", "T3"] as const;
export type SubTierKey = (typeof SUB_TIER_KEYS)[number];

export type GoldenCounts = Record<SubTierKey, number> & { total: number };

/** A `**T1a-live-tso (160 regions, ...)` header found in §2.1. */
export interface SubTierClaim {
  key: SubTierKey;
  /** The slug after the key, e.g. `live-tso`. Echoed in failure messages. */
  slug: string;
  stated: number;
  /** 1-based line number in the source document. */
  line: number;
}

/** An `N regions` total claim found outside §2.1 and the changelog. */
export interface TotalClaim {
  stated: number;
  line: number;
  /** The `##`/`###` heading the claim sits under, for the failure message. */
  section: string;
}

export interface Section {
  heading: string;
  lines: { text: string; line: number }[];
}

/** Raised when the document's structure — not its numbers — has changed. */
export class MethodologyFormatError extends Error {
  override name = "MethodologyFormatError";
}

/** The section carrying the five sub-tier headers. */
export const SUB_TIER_SECTION = "### 2.1 Confidence tiers";

/**
 * Sections the total-claim sweep skips.
 *
 * §2.1's own counts are per-sub-tier, not totals, and are checked separately.
 * §8 is a past-tense changelog: its "T1a-live-tso (63 regions...)" entry records
 * what the CODEX-7 lock said in April 2026 and is deliberately left frozen (see
 * PR #979). A gate that "corrected" a historical record would be the opposite of
 * what this repo wants.
 */
export const TOTAL_CLAIM_EXCLUDED_SECTIONS: ReadonlySet<string> = new Set([
  SUB_TIER_SECTION,
  "## 8. Recent corrections",
]);

/**
 * Minimum number of total claims expected outside the excluded sections. Today
 * there are exactly two — the Abstract's "across 459 regions" and §5's "Coverage
 * is 459 regions". The floor is what stops a rewording from emptying the sweep
 * and passing the gate vacuously.
 */
export const MIN_TOTAL_CLAIMS = 2;

/**
 * Matches a sub-tier header at the start of a line:
 *   **T1a-live-tso (160 regions, ±15% peakGW envelope ...
 *   **T1c-live-neighbour-anchored (1 region, ±35.5% peakGW envelope).**
 * The trailing comma is required — it is the boundary between the count and the
 * free-form envelope prose, which is allowed to change without touching this gate.
 */
export const SUB_TIER_HEADER_RE =
  /^\*\*(T1a|T1b|T1c|T2|T3)-([A-Za-z0-9-]+) \((\d+) regions?,/;

/**
 * Matches a bare "459 regions" count claim. The leading `\b` is load-bearing:
 * without it this matches the "3 regions" inside "T3 regions" (§5 item 4).
 */
const TOTAL_CLAIM_RE = /\b(\d+) regions?\b/g;

/** Split a markdown document into `##`/`###` sections, preserving line numbers. */
export function splitSections(markdown: string): Section[] {
  const sections: Section[] = [];
  let current: Section = { heading: "(preamble)", lines: [] };
  markdown.split("\n").forEach((text, index) => {
    if (/^#{2,3} /.test(text)) {
      sections.push(current);
      current = { heading: text.trim(), lines: [] };
      return;
    }
    current.lines.push({ text, line: index + 1 });
  });
  sections.push(current);
  return sections;
}

/**
 * Extract the five sub-tier count claims from §2.1.
 *
 * Scoped to that one section on purpose: §8's changelog mentions the same tier
 * names inline with their April-2026 counts, and those are history, not claims.
 *
 * @throws {MethodologyFormatError} if §2.1 itself is missing or renamed.
 */
export function parseSubTierCounts(markdown: string): SubTierClaim[] {
  const section = splitSections(markdown).find(
    (s) => s.heading === SUB_TIER_SECTION,
  );
  if (!section) {
    throw new MethodologyFormatError(
      `section "${SUB_TIER_SECTION}" not found in src/methodology.md — the heading was renamed or removed. ` +
        `Update SUB_TIER_SECTION in scripts/lib/methodology-counts.ts to match; leaving it stale would silence this gate.`,
    );
  }

  const claims: SubTierClaim[] = [];
  for (const { text, line } of section.lines) {
    const match = SUB_TIER_HEADER_RE.exec(text);
    if (!match) continue;
    claims.push({
      key: match[1] as SubTierKey,
      slug: match[2],
      stated: Number(match[3]),
      line,
    });
  }
  return claims;
}

/** Extract every `N regions` total claim outside the excluded sections. */
export function parseTotalClaims(markdown: string): TotalClaim[] {
  const claims: TotalClaim[] = [];
  for (const section of splitSections(markdown)) {
    if (TOTAL_CLAIM_EXCLUDED_SECTIONS.has(section.heading)) continue;
    for (const { text, line } of section.lines) {
      for (const match of text.matchAll(TOTAL_CLAIM_RE)) {
        claims.push({
          stated: Number(match[1]),
          line,
          section: section.heading,
        });
      }
    }
  }
  return claims;
}

/**
 * Compare every count claim in the document against `golden`.
 *
 * @returns human-readable failure lines; empty means the page agrees with the dataset.
 * @throws {MethodologyFormatError} if §2.1 is missing (see parseSubTierCounts).
 */
export function checkMethodologyCounts(
  markdown: string,
  golden: GoldenCounts,
): string[] {
  const failures: string[] = [];

  // The golden file is this gate's only reference point, so check it is
  // self-consistent first — every region resolves into exactly one bucket
  // (countByBucket in scripts/lib/tier-resolution.ts), so the five must sum
  // to the total. A hand-edited golden that breaks this would otherwise make
  // every message below authoritative-sounding and wrong.
  const goldenSum = SUB_TIER_KEYS.reduce((sum, key) => sum + golden[key], 0);
  if (goldenSum !== golden.total) {
    failures.push(
      `scripts/ci/golden/tier-counts.json is internally inconsistent: T1a+T1b+T1c+T2+T3 = ${goldenSum} but "total" is ${golden.total}. ` +
        `Re-run \`npm run tally:tiers\` and fix the golden file before trusting any message below.`,
    );
  }

  const claims = parseSubTierCounts(markdown);
  const byKey = new Map<SubTierKey, SubTierClaim>();
  for (const claim of claims) {
    const prior = byKey.get(claim.key);
    if (prior) {
      failures.push(
        `${SUB_TIER_SECTION}: two headers claim a count for ${claim.key} (lines ${prior.line} and ${claim.line}) — ` +
          `the gate cannot tell which is canonical. Remove or reword one.`,
      );
      continue;
    }
    byKey.set(claim.key, claim);
  }

  for (const key of SUB_TIER_KEYS) {
    const claim = byKey.get(key);
    if (!claim) {
      failures.push(
        `${SUB_TIER_SECTION}: no \`**${key}-<name> (N regions, ...\` header found. ` +
          `The header format changed or the sub-tier was dropped — either way this gate just stopped checking ${key}. ` +
          `Restore the header format, or update SUB_TIER_HEADER_RE in scripts/lib/methodology-counts.ts.`,
      );
      continue;
    }
    if (claim.stated !== golden[key]) {
      failures.push(
        `src/methodology.md:${claim.line}: **${key}-${claim.slug}** states ${claim.stated} region${claim.stated === 1 ? "" : "s"}, ` +
          `expected ${golden[key]} (golden ${key} in scripts/ci/golden/tier-counts.json).`,
      );
    }
  }

  // Headline the sum when all five parsed — this is the PR #979 regression in
  // one line (377 against 459), which the per-key messages above only imply.
  if (byKey.size === SUB_TIER_KEYS.length) {
    const statedSum = SUB_TIER_KEYS.reduce(
      (sum, key) => sum + (byKey.get(key)?.stated ?? 0),
      0,
    );
    if (statedSum !== golden.total) {
      failures.push(
        `${SUB_TIER_SECTION}: the five stated sub-tier counts sum to ${statedSum}, but the dataset holds ${golden.total} regions.`,
      );
    }
  }

  const totals = parseTotalClaims(markdown);
  if (totals.length < MIN_TOTAL_CLAIMS) {
    failures.push(
      `expected at least ${MIN_TOTAL_CLAIMS} \`N regions\` total claim(s) outside ${[...TOTAL_CLAIM_EXCLUDED_SECTIONS].join(" / ")}, found ${totals.length}. ` +
        `They were reworded or removed, so this gate is no longer checking the headline total. ` +
        `Restore the phrasing, or lower MIN_TOTAL_CLAIMS in scripts/lib/methodology-counts.ts deliberately.`,
    );
  }
  for (const total of totals) {
    if (total.stated !== golden.total) {
      failures.push(
        `src/methodology.md:${total.line} (${total.section}): claims ${total.stated} regions, ` +
          `expected ${golden.total} (golden total in scripts/ci/golden/tier-counts.json).`,
      );
    }
  }

  return failures;
}
