import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

import {
  checkDoc,
  checkGoldenSelfConsistent,
  parseDoc,
  GATED_DOCS,
  BUCKET_KEYS,
  IGNORE_MARKER,
  TierCountFormatError,
  type DocSpec,
  type GoldenCounts,
} from "../scripts/lib/tier-count-docs.js";

// Companion to tests/methodology-counts.test.ts, defending the same contract for
// the four documents #981 did not cover: a gate must never pass by matching
// NOTHING. Every shape expectation in DocSpec is exact, so a reworded claim
// lowers the count and fails, instead of leaving the gate reading an empty set
// and reporting success over prose it no longer parses.
//
// The second contract here is the inverse, and is specific to this repo:
// deliberately-pinned figures (a Zenodo deposit, a release entry, a retained
// historical snapshot) must NOT be "corrected". Those tests are the ones that
// stop this gate from becoming a machine for falsifying published records.

const GOLDEN: GoldenCounts = {
  T1a: 160,
  T1b: 26,
  T1c: 1,
  T2: 23,
  T3: 249,
  total: 459,
};

const SPEC: DocSpec = {
  path: "fixture.md",
  rosters: 1,
  bucketClaims: 0,
  ignored: 0,
  why: "a fixture",
};

const LIVE_ROSTER =
  "`npm run tally:tiers` reports **T1a 160, T1b 26, T1c 1, T2 23, T3 249 — total 459**.";

function doc(...lines: string[]): string {
  return ["## Scope", "", ...lines, ""].join("\n");
}

describe("parseDoc — rosters", () => {
  it("reads every bucket and the total off a five-bucket roster line", () => {
    const { rosters } = parseDoc(doc(LIVE_ROSTER));
    expect(rosters).toHaveLength(1);
    expect(rosters[0].counts.map((c) => `${c.key}=${c.stated}`)).toEqual([
      "T1a=160",
      "T1b=26",
      "T1c=1",
      "T2=23",
      "T3=249",
    ]);
    expect(rosters[0].total).toBe(459);
  });

  it("reads the `T1a = 160` spelling used by uncertainty.md", () => {
    const line = "T1a = 160 regions, T1b = 26, T1c = 1 (switzerland), T2 = 23, T3 = 249, total 459.";
    expect(parseDoc(doc(line)).rosters[0].counts.map((c) => c.stated)).toEqual([
      160, 26, 1, 23, 249,
    ]);
  });

  it("does not treat a line naming only four buckets as a roster", () => {
    // Prose that mentions several tiers in passing is not a population claim.
    // That is what the opt-in bucket marker is for; auto-detecting it would make
    // the gate fire on sentences nobody meant as a count.
    const line = "**T1a 160, T1b 26, T1c 1, T2 23 — total 459**.";
    expect(parseDoc(doc(line)).rosters).toEqual([]);
  });

  it("does not read `T2-flare = 4` as T2 = 4", () => {
    // Pre-purge lines carry a T2-flare bucket. Capturing its figure as T2's
    // would fail the build with a confident, wrong number.
    const line = "T1a = 63, T1b = 4, T1c = 1, T2 = 2, T2-flare = 4, T3 = 54, total 128.";
    const roster = parseDoc(doc(line)).rosters[0];
    expect(roster.counts.find((c) => c.key === "T2")?.stated).toBe(2);
    expect(roster.counts).toHaveLength(BUCKET_KEYS.length);
  });
});

describe("parseDoc — markers", () => {
  it("skips a line tagged with the ignore marker", () => {
    const parsed = parseDoc(doc(`${IGNORE_MARKER} ${LIVE_ROSTER}`));
    expect(parsed.rosters).toEqual([]);
    expect(parsed.ignored).toHaveLength(1);
  });

  it("reads the count immediately before a bucket marker, not the line's first number", () => {
    // The real T1b bullet opens with `δ = 0.50`, mentions the P67 residual, and
    // states its count two clauses later. A first-number rule would claim 0.
    const line =
      "- **T1b**. `δ = 0.50 × peakGW`. The P67 residual was 0.50. T1b now holds 26 regions <!-- tier-counts:T1b --> — Germany's four TSO areas.";
    const claims = parseDoc(doc(line)).bucketClaims;
    expect(claims).toHaveLength(1);
    expect(claims[0]).toMatchObject({ key: "T1b", stated: 26 });
  });

  it("reads the count before the marker, not a later one on the same line", () => {
    // The T3 shape-family line states 249 and then a per-family breakdown
    // beginning `solar` (145 regions; …). A last-number rule would claim 145.
    const line =
      "Five shape families are in use across the 249 <!-- tier-counts:T3 --> T3 regions: `solar` (145 regions); `mixed` (47).";
    expect(parseDoc(doc(line)).bucketClaims[0].stated).toBe(249);
  });

  it("is not fooled by the digits inside a tier name preceding the marker", () => {
    const line = "The 23 <!-- tier-counts:T2 --> `anchored` regions split as:";
    expect(parseDoc(doc(line)).bucketClaims[0].stated).toBe(23);
  });

  it("throws when a bucket marker has no number before it", () => {
    const line = "Several regions are anchored <!-- tier-counts:T2 -->.";
    expect(() => parseDoc(doc(line))).toThrow(TierCountFormatError);
    expect(() => parseDoc(doc(line))).toThrow(/no number precedes it/);
  });

  it("lets the ignore marker win over a bucket marker on the same line", () => {
    const line = `The 6 <!-- tier-counts:T2 --> anchored regions ${IGNORE_MARKER}`;
    const parsed = parseDoc(doc(line));
    expect(parsed.bucketClaims).toEqual([]);
    expect(parsed.ignored).toHaveLength(1);
  });
});

describe("checkDoc — numbers", () => {
  it("passes when the roster matches the golden", () => {
    expect(checkDoc(SPEC, doc(LIVE_ROSTER), GOLDEN)).toEqual([]);
  });

  it("names the bucket, the stated value and the expected value", () => {
    const stale = "**T1a 149, T1b 10, T1c 1, T2 6, T3 211 — total 385**.";
    const failures = checkDoc(SPEC, doc(stale), GOLDEN).join("\n");
    expect(failures).toContain("roster states T1a = 149, expected 160");
    expect(failures).toContain("roster states T3 = 211, expected 249");
    expect(failures).toContain("roster states total 385, expected 459");
    // T1c was the one correct figure and must not be reported.
    expect(failures).not.toContain("states T1c");
  });

  it("catches a roster that contradicts its own total", () => {
    // dataset/README.md's pinned v1.3.2 breakdown does exactly this: its buckets
    // sum to 377 against a stated 385, the gap being the purged flare bucket.
    const line = "**T1a 149, T1b 10, T1c 1, T2 6, T3 211 — total 385**.";
    expect(checkDoc(SPEC, doc(line), GOLDEN).join("\n")).toContain(
      "five buckets sum to 377 but it states total 385 — the line contradicts itself",
    );
  });

  it("flags a roster that names a bucket twice rather than picking one", () => {
    const line = "**T1a 160, T1a 161, T1b 26, T1c 1, T2 23, T3 249 — total 459**.";
    expect(checkDoc(SPEC, doc(line), GOLDEN).join("\n")).toContain("names T1a twice");
  });

  it("flags a roster with no stated total", () => {
    const line = "**T1a 160, T1b 26, T1c 1, T2 23, T3 249**.";
    expect(checkDoc(SPEC, doc(line), GOLDEN).join("\n")).toContain("states no `total N`");
  });

  it("checks a tagged bucket claim against its own bucket", () => {
    const spec = { ...SPEC, rosters: 0, bucketClaims: 1 };
    const line = "The 66 regions <!-- tier-counts:T1a --> resolving to `T1a-live-tso`.";
    expect(checkDoc(spec, doc(line), GOLDEN).join("\n")).toContain(
      "claims 66 for T1a, expected 160",
    );
  });

  it("reports an internally inconsistent golden before trusting its numbers", () => {
    expect(checkGoldenSelfConsistent({ ...GOLDEN, total: 500 }).join("\n")).toContain(
      'T1a+T1b+T1c+T2+T3 = 459 but "total" is 500',
    );
    expect(checkGoldenSelfConsistent(GOLDEN)).toEqual([]);
  });
});

// --- the "cannot pass by matching nothing" contract -----------------------

describe("checkDoc — shape", () => {
  it.each([
    ["the roster is reworded into prose", "T1a is 160, and the rest follow."],
    ["a bucket is dropped from the roster", "**T1a 160, T1b 26, T1c 1, T2 23 — total 459**."],
    ["the counts become words", "**T1a one-sixty, T1b twenty-six, T1c one, T2 23, T3 249 — total 459**."],
  ])("fails loudly when %s", (_label, rewritten) => {
    const failures = checkDoc(SPEC, doc(rewritten), GOLDEN).join("\n");
    expect(failures).toContain("expected 1 five-bucket roster line(s), found 0");
    expect(failures).toContain("this gate just stopped checking it");
  });

  it("fails loudly when a new line starts parsing as a roster", () => {
    // This is the pinned-content guard. If someone reformats a v1.3.2 or
    // pre-purge breakdown into roster shape, the gate must stop and force a
    // decision — tag it, or accept it as live — rather than demanding the
    // published figures be rewritten to match HEAD.
    const pinned = "In v1.3.2: T1a 149, T1b 10, T1c 1, T2 6, T3 211, total 385.";
    const failures = checkDoc(SPEC, doc(LIVE_ROSTER, "", pinned), GOLDEN).join("\n");
    expect(failures).toContain("expected 1 five-bucket roster line(s), found 2");
    expect(failures).toContain(IGNORE_MARKER);
  });

  it("fails loudly when a bucket marker is deleted", () => {
    const spec = { ...SPEC, rosters: 0, bucketClaims: 1 };
    const failures = checkDoc(spec, doc("The 160 regions resolving to T1a."), GOLDEN).join("\n");
    expect(failures).toContain("expected 1 `<!-- tier-counts:<key> -->` bucket claim(s), found 0");
  });

  it("fails loudly when an ignore marker is added to silence a mismatch", () => {
    // The failure a lazy fix would produce: tag the offending line and move on.
    // The exact-count expectation turns that into a visible edit to GATED_DOCS.
    const stale = `**T1a 149, T1b 10, T1c 1, T2 6, T3 211 — total 385**. ${IGNORE_MARKER}`;
    const failures = checkDoc(SPEC, doc(stale), GOLDEN).join("\n");
    expect(failures).toContain(`expected 0 \`${IGNORE_MARKER}\` line(s), found 1`);
    expect(failures).toContain("never to quiet a real mismatch");
  });

  it("fails loudly when an ignore marker is removed from pinned content", () => {
    const spec = { ...SPEC, rosters: 0, ignored: 1 };
    expect(checkDoc(spec, doc("nothing marked here"), GOLDEN).join("\n")).toContain(
      `expected 1 \`${IGNORE_MARKER}\` line(s), found 0`,
    );
  });
});

// --- the real documents, not fixtures ------------------------------------

describe("the gated corpus (as committed)", () => {
  const golden = JSON.parse(
    readFileSync(
      join(process.cwd(), "scripts", "ci", "golden", "tier-counts.json"),
      "utf-8",
    ),
  ) as GoldenCounts;

  it("covers every document the gate claims to cover", () => {
    expect(GATED_DOCS.map((s) => s.path)).toEqual([
      "docs/methodology/uncertainty.md",
      "dataset/README.md",
      "docs/methodology/tier-classification-guide.md",
      "docs/methodology/live-data-paths.md",
    ]);
  });

  it("does not gate src/methodology.md, which ci:methodology-counts owns", () => {
    expect(GATED_DOCS.map((s) => s.path)).not.toContain("src/methodology.md");
  });

  it.each(GATED_DOCS.map((s) => [s.path, s] as const))(
    "%s still has the shape GATED_DOCS declares and agrees with the golden",
    (path, spec) => {
      const markdown = readFileSync(join(process.cwd(), path), "utf-8");
      const parsed = parseDoc(markdown);
      expect({
        rosters: parsed.rosters.length,
        bucketClaims: parsed.bucketClaims.length,
        ignored: parsed.ignored.length,
      }).toEqual({
        rosters: spec.rosters,
        bucketClaims: spec.bucketClaims,
        ignored: spec.ignored,
      });
      expect(checkDoc(spec, markdown, golden)).toEqual([]);
    },
  );

  it("would have caught live-data-paths.md's 66-vs-160 T1a claim", () => {
    // The regression this gate was built for: that headline sat at the Phase-2.6
    // tally while T1a grew to 160, and nothing read it.
    const spec = GATED_DOCS.find((s) => s.path.endsWith("live-data-paths.md"))!;
    const markdown = readFileSync(join(process.cwd(), spec.path), "utf-8");
    const regressed = markdown.replace(
      "The 160 <!-- tier-counts:T1a -->",
      "The 66 <!-- tier-counts:T1a -->",
    );
    expect(regressed).not.toEqual(markdown);
    expect(checkDoc(spec, regressed, golden).join("\n")).toContain(
      "claims 66 for T1a, expected 160",
    );
  });

  it("leaves uncertainty.md's retained 2026-04-26 snapshot alone", () => {
    // That line states T1a = 63 / total 128 and is kept on purpose: it is the
    // cohort the ±50 % T1b envelope was measured on. The gate must read it as
    // exempt, not as a document-wide failure.
    const markdown = readFileSync(
      join(process.cwd(), "docs", "methodology", "uncertainty.md"),
      "utf-8",
    );
    expect(markdown).toContain("Historical snapshot — 2026-04-26");
    expect(markdown).toContain("T1a = 63 regions");
    expect(parseDoc(markdown).rosters.map((r) => r.total)).toEqual([golden.total]);
  });
});
