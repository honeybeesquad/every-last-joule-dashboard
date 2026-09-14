/**
 * Parse per-tier region-count claims out of the documents that state them in
 * prose, and compare them against the locked golden tier counts in
 * `scripts/ci/golden/tier-counts.json`.
 *
 * Why this exists — PRs #979/#980/#982: five documents carried tier conditions
 * and per-tier counts that had drifted from the dataset for roughly three
 * months, and were corrected by hand. #981 then gated `src/methodology.md` §2.1.
 * This module is the same catch for the other four, so the class closes rather
 * than recurring one document at a time.
 *
 * Division of labour with `scripts/lib/methodology-counts.ts`: that module
 * parses `src/methodology.md`'s bespoke `**T1a-live-tso (160 regions, …` §2.1
 * header format, which no other document uses. This one parses the two shapes
 * the rest of the corpus uses — a full five-bucket *roster* line, and a single
 * *bucket claim* tagged in the prose. The two gates read the same golden file
 * and neither reads `regions.ts`, so a tier move fails `ci:tally-golden` first
 * and reaches either of these only once the golden is deliberately updated.
 *
 * ## The pinned-content problem
 *
 * These documents deliberately carry stale numbers as well as live ones, and a
 * gate that cannot tell them apart would demand exactly the edits that falsify
 * the record:
 *
 *   - `docs/methodology/uncertainty.md` states the current population *and*, on
 *     the next line, the 2026-04-26 snapshot the ±50 % T1b envelope was measured
 *     on — kept because deleting it would orphan the envelope's provenance.
 *   - `dataset/README.md` is pinned to the archived v1.3.2 Zenodo deposit, with
 *     a note saying HEAD has moved past it.
 *   - `dataset/CHANGELOG.md` release entries and `docs/paper/*` are pinned the
 *     same way and are not gated here at all.
 *
 * So claims are found by two *closed* routes, never by an open sweep of every
 * `N regions` in the file:
 *
 *   1. **Roster lines** are auto-detected: a line naming all five buckets with a
 *      number after each. Nothing else looks like that by accident.
 *   2. **Bucket claims** are opt-in: the author tags the line with
 *      `<!-- tier-counts:T1a -->`. Prose phrasing is then free to change.
 *
 * A line tagged `<!-- tier-counts:ignore -->` is skipped — that is how the
 * historical roster in `uncertainty.md` stays put.
 *
 * ## Why every expectation is an exact count
 *
 * `DocSpec` declares how many rosters, bucket claims and ignored lines each
 * document should have, and all three are asserted exactly. That makes the gate
 * fail closed in both directions:
 *
 *   - Delete or reword a claim and the count drops — the gate stops checking
 *     something it used to check, and says so, rather than going green over a
 *     document it no longer reads.
 *   - Add an ignore marker to silence a real failure, or reformat a pinned line
 *     into roster shape, and the count rises — which shows up in review as a
 *     deliberate edit to this file, not as a quietly passing build.
 */

import { splitSections } from "./methodology-counts.js";

/** The sub-tier buckets, matching `Bucket` in scripts/lib/tier-resolution.ts. */
export const BUCKET_KEYS = ["T1a", "T1b", "T1c", "T2", "T3"] as const;
export type BucketKey = (typeof BUCKET_KEYS)[number];

export type GoldenCounts = Record<BucketKey, number> & { total: number };

/** Raised when a document's structure — not its numbers — has changed. */
export class TierCountFormatError extends Error {
  override name = "TierCountFormatError";
}

/** Marker that exempts a line: its numbers are pinned, historical or unrelated. */
export const IGNORE_MARKER = "<!-- tier-counts:ignore -->";

/** `<!-- tier-counts:T1a -->` — declares that this line claims a count for T1a. */
const BUCKET_MARKER_RE = /<!--\s*tier-counts:(T1a|T1b|T1c|T2|T3)\s*-->/;

/**
 * A bucket key followed by its count: `T1a = 160`, `T1a 160`, `T2 23`.
 *
 * The `\b` after the key is load-bearing in both directions. It lets `T1c = 1`
 * match, and it stops `T2-flare = 4` from reading as `T2 = 4` — the hyphen ends
 * the key, and `-flare` is not a number, so the match fails rather than
 * capturing the wrong figure off a pre-purge line.
 */
const BUCKET_COUNT_RE = /\bT(1a|1b|1c|2|3)\b\s*(?:=\s*)?(\d+)\b/g;

/** `total 459` / `total = 459`, as it appears at the end of a roster line. */
const ROSTER_TOTAL_RE = /\btotal\s*(?:=\s*)?(\d+)\b/i;

/**
 * A bare integer. Used to find the count a bucket marker annotates.
 *
 * `\b` before the digits is what keeps this off the `1a` in `T1a`, the `1` in
 * `post-B1` and the `67` in `P67` — all of which sit on the lines being tagged.
 */
const BARE_NUMBER_RE = /\b(\d+)\b/g;

export interface RosterClaim {
  /** Every bucket named on the line, in source order. */
  counts: { key: BucketKey; stated: number }[];
  /** The `total N` on the same line, when present. */
  total: number | null;
  line: number;
  section: string;
}

export interface BucketClaim {
  key: BucketKey;
  stated: number;
  line: number;
  section: string;
}

export interface ParsedDoc {
  rosters: RosterClaim[];
  bucketClaims: BucketClaim[];
  /** 1-based line numbers carrying IGNORE_MARKER. */
  ignored: number[];
}

/** One gated document and the exact shape it is expected to have. */
export interface DocSpec {
  /** Repo-relative path. */
  path: string;
  /** Exact number of auto-detected five-bucket roster lines. */
  rosters: number;
  /** Exact number of `<!-- tier-counts:<key> -->` tagged claims. */
  bucketClaims: number;
  /** Exact number of `<!-- tier-counts:ignore -->` lines. */
  ignored: number;
  /** One line on what this document claims, echoed in failure messages. */
  why: string;
}

/**
 * The gated corpus.
 *
 * `src/methodology.md` is absent on purpose — `ci:methodology-counts` owns it,
 * and two gates asserting the same prose would produce duplicate failures for
 * one edit. `dataset/CHANGELOG.md` and `docs/paper/*` are absent because every
 * count in them is pinned to a published release or deposit; see the
 * pinned-content note above.
 */
export const GATED_DOCS: readonly DocSpec[] = [
  {
    path: "docs/methodology/uncertainty.md",
    rosters: 1,
    bucketClaims: 2,
    ignored: 1,
    why: "the current per-tier population roster, plus the T1b cohort size and the T3 shape-family total stated in the envelope prose",
  },
  {
    path: "dataset/README.md",
    rosters: 1,
    bucketClaims: 0,
    ignored: 1,
    why: "the repository-HEAD tier split beneath the pinned v1.3.2 breakdown, which is itself exempt",
  },
  {
    path: "docs/methodology/tier-classification-guide.md",
    rosters: 0,
    bucketClaims: 1,
    ignored: 0,
    why: "the T2 population behind the flat-base / EIA-930 split in the T2 section",
  },
  {
    path: "docs/methodology/live-data-paths.md",
    rosters: 0,
    bucketClaims: 1,
    ignored: 0,
    why: "the T1a population introducing the Path A / Path B catalogue",
  },
] as const;

/**
 * The count a bucket marker annotates: the last bare integer *before* the
 * marker on its line.
 *
 * Anchoring to the marker rather than taking the line's first or last number is
 * what makes the tag usable on real prose. The T1b bullet in `uncertainty.md`
 * opens with `δ = 0.50`, mentions `P67`, and states its count two clauses later;
 * the T1b table row ends with a `±50 %` cell. Both would mis-read under a
 * first-number or last-number rule, and mis-reading is worse than not checking —
 * it fails the build with a confident, wrong number.
 */
function countAnnotatedBy(text: string, marker: RegExpExecArray): number | null {
  const before = text.slice(0, marker.index);
  const numbers = [...before.matchAll(BARE_NUMBER_RE)];
  const last = numbers.at(-1);
  return last ? Number(last[1]) : null;
}

/** Extract every roster, tagged bucket claim and ignore marker from a document. */
export function parseDoc(markdown: string): ParsedDoc {
  const rosters: RosterClaim[] = [];
  const bucketClaims: BucketClaim[] = [];
  const ignored: number[] = [];

  for (const section of splitSections(markdown)) {
    for (const { text, line } of section.lines) {
      if (text.includes(IGNORE_MARKER)) {
        ignored.push(line);
        continue;
      }

      const marker = BUCKET_MARKER_RE.exec(text);
      if (marker) {
        const stated = countAnnotatedBy(text, marker);
        if (stated === null) {
          throw new TierCountFormatError(
            `line ${line} carries ${marker[0]} but no number precedes it on that line. ` +
              `The marker annotates the count immediately before it — write "… the 23 regions ${marker[0]} …". ` +
              `A marker with nothing to check is a gate that silently stopped checking.`,
          );
        }
        bucketClaims.push({
          key: marker[1] as BucketKey,
          stated,
          line,
          section: section.heading,
        });
        continue;
      }

      const counts: { key: BucketKey; stated: number }[] = [];
      for (const match of text.matchAll(BUCKET_COUNT_RE)) {
        counts.push({ key: `T${match[1]}` as BucketKey, stated: Number(match[2]) });
      }
      // A roster names all five buckets. Anything less is prose mentioning a
      // tier in passing, which is what the opt-in bucket marker is for.
      const distinct = new Set(counts.map((c) => c.key));
      if (distinct.size < BUCKET_KEYS.length) continue;

      const total = ROSTER_TOTAL_RE.exec(text);
      rosters.push({
        counts,
        total: total ? Number(total[1]) : null,
        line,
        section: section.heading,
      });
    }
  }

  return { rosters, bucketClaims, ignored };
}

/** Assert the golden file is self-consistent before quoting it as authority. */
export function checkGoldenSelfConsistent(golden: GoldenCounts): string[] {
  const sum = BUCKET_KEYS.reduce((acc, key) => acc + golden[key], 0);
  if (sum === golden.total) return [];
  return [
    `scripts/ci/golden/tier-counts.json is internally inconsistent: T1a+T1b+T1c+T2+T3 = ${sum} but "total" is ${golden.total}. ` +
      `Re-run \`npm run tally:tiers\` and fix the golden file before trusting any message below.`,
  ];
}

/**
 * Compare one document's claims against `golden`.
 *
 * @returns human-readable failure lines; empty means the document agrees.
 * @throws {TierCountFormatError} if a marker is present but unusable.
 */
export function checkDoc(
  spec: DocSpec,
  markdown: string,
  golden: GoldenCounts,
): string[] {
  const failures: string[] = [];
  const parsed = parseDoc(markdown);

  // --- shape first: has the gate stopped reading something? ---------------

  if (parsed.rosters.length !== spec.rosters) {
    failures.push(
      `${spec.path}: expected ${spec.rosters} five-bucket roster line(s), found ${parsed.rosters.length} (${spec.why}). ` +
        (parsed.rosters.length < spec.rosters
          ? `A roster was reworded, split across lines, or lost a bucket — this gate just stopped checking it. Restore the line, or update GATED_DOCS in scripts/lib/tier-count-docs.ts deliberately.`
          : `A new line now parses as a roster. If it is pinned or historical, tag it \`${IGNORE_MARKER}\`; if it is live, raise the expected count in GATED_DOCS.`),
    );
  }

  if (parsed.bucketClaims.length !== spec.bucketClaims) {
    failures.push(
      `${spec.path}: expected ${spec.bucketClaims} \`<!-- tier-counts:<key> -->\` bucket claim(s), found ${parsed.bucketClaims.length} (${spec.why}). ` +
        `Markers are how this document opts its prose counts into the gate; adding or removing one must be a deliberate edit to GATED_DOCS in scripts/lib/tier-count-docs.ts.`,
    );
  }

  if (parsed.ignored.length !== spec.ignored) {
    failures.push(
      `${spec.path}: expected ${spec.ignored} \`${IGNORE_MARKER}\` line(s), found ${parsed.ignored.length}` +
        (parsed.ignored.length > spec.ignored
          ? ` (lines ${parsed.ignored.join(", ")}). An ignore marker exempts a line from this gate, so a new one must be justified in review — pinned or historical content only, never to quiet a real mismatch.`
          : `. An ignore marker was removed; if that line is live now, drop it from the expected count in GATED_DOCS, otherwise restore the marker.`),
    );
  }

  // --- then the numbers ----------------------------------------------------

  for (const roster of parsed.rosters) {
    const seen = new Set<BucketKey>();
    for (const { key, stated } of roster.counts) {
      if (seen.has(key)) {
        failures.push(
          `${spec.path}:${roster.line}: the roster names ${key} twice — the gate cannot tell which figure is canonical. Reword one.`,
        );
        continue;
      }
      seen.add(key);
      if (stated !== golden[key]) {
        failures.push(
          `${spec.path}:${roster.line} (${roster.section}): roster states ${key} = ${stated}, ` +
            `expected ${golden[key]} (golden ${key} in scripts/ci/golden/tier-counts.json).`,
        );
      }
    }
    if (roster.total === null) {
      failures.push(
        `${spec.path}:${roster.line}: roster names all five buckets but states no \`total N\`. ` +
          `The total is the figure a reader quotes — restore it, or tag the line \`${IGNORE_MARKER}\` if it is historical.`,
      );
    } else if (roster.total !== golden.total) {
      failures.push(
        `${spec.path}:${roster.line} (${roster.section}): roster states total ${roster.total}, ` +
          `expected ${golden.total} (golden total in scripts/ci/golden/tier-counts.json).`,
      );
    }
    const statedSum = roster.counts.reduce((sum, c) => sum + c.stated, 0);
    if (roster.total !== null && statedSum !== roster.total) {
      failures.push(
        `${spec.path}:${roster.line}: the roster's five buckets sum to ${statedSum} but it states total ${roster.total} — the line contradicts itself.`,
      );
    }
  }

  for (const claim of parsed.bucketClaims) {
    if (claim.stated !== golden[claim.key]) {
      failures.push(
        `${spec.path}:${claim.line} (${claim.section}): claims ${claim.stated} for ${claim.key}, ` +
          `expected ${golden[claim.key]} (golden ${claim.key} in scripts/ci/golden/tier-counts.json).`,
      );
    }
  }

  return failures;
}
