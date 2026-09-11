import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

import {
  checkMethodologyCounts,
  parseSubTierCounts,
  parseTotalClaims,
  splitSections,
  MethodologyFormatError,
  MIN_TOTAL_CLAIMS,
  SUB_TIER_KEYS,
  SUB_TIER_SECTION,
  type GoldenCounts,
} from "../scripts/lib/methodology-counts.js";

// Regression guard for PR #979: §2.1's five sub-tier counts summed to 377 against
// an actual 459 and sat wrong for ~3 months because no gate read methodology prose.
//
// The failure mode this file mostly defends against is not a wrong number — the
// runner catches those — but a gate that passes by matching NOTHING. If a header
// is reworded, a naive regex sweep finds zero headers, reports zero mismatches and
// goes green over a claim it never read. Every "loudly" test below is that case.

const GOLDEN: GoldenCounts = {
  T1a: 160,
  T1b: 26,
  T1c: 1,
  T2: 23,
  T3: 249,
  total: 459,
};

/** A minimal document with the same shape as src/methodology.md. */
function buildDoc(
  overrides: {
    headers?: string[];
    abstractTotal?: string;
    limitationsTotal?: string;
    subTierHeading?: string;
  } = {},
): string {
  const headers = overrides.headers ?? [
    "**T1a-live-tso (160 regions, ±15% peakGW envelope or ±2σ from 5-year backfill).** Live TSO feed.",
    "**T1b-live-domestic-anchored (26 regions, ±50% peakGW envelope).** Live feed plus a domestic rate.",
    "**T1c-live-neighbour-anchored (1 region, ±35.5% peakGW envelope).** Switzerland via the Czech rate.",
    "**T2-annual-calibrated (23 regions, ±20% peakGW envelope).** Anchored to a published annual total.",
    "**T3-modelled (249 regions, ±40% peakGW envelope).** A typical-shape profile. T3 regions are flagged.",
  ];
  return [
    "## Abstract",
    "",
    overrides.abstractTotal ?? "Measured or estimated across 459 regions.",
    "",
    "## 2. Method",
    "",
    overrides.subTierHeading ?? SUB_TIER_SECTION,
    "",
    ...headers.flatMap((h) => [h, ""]),
    "## 5. Known limitations",
    "",
    overrides.limitationsTotal ?? "2. **Geographic completeness.** Coverage is 459 regions.",
    "",
    "## 8. Recent corrections",
    "",
    "- **T1 sub-tier subdivision (CODEX-7).** Subdivided into T1a-live-tso (63 regions,",
    "  own-jurisdiction rate), T1b-live-domestic-anchored (4 regions), and T1c (1 region).",
    "",
  ].join("\n");
}

describe("parseSubTierCounts", () => {
  it("finds all five sub-tier headers in §2.1", () => {
    const claims = parseSubTierCounts(buildDoc());
    expect(claims.map((c) => c.key)).toEqual([...SUB_TIER_KEYS]);
    expect(claims.map((c) => c.stated)).toEqual([160, 26, 1, 23, 249]);
  });

  it("reads the singular 'N region' form used by T1c", () => {
    const t1c = parseSubTierCounts(buildDoc()).find((c) => c.key === "T1c");
    expect(t1c?.stated).toBe(1);
  });

  it("captures the slug and 1-based line number for the failure message", () => {
    const t2 = parseSubTierCounts(buildDoc()).find((c) => c.key === "T2");
    expect(t2?.slug).toBe("annual-calibrated");
    expect(buildDoc().split("\n")[t2!.line - 1]).toContain("**T2-annual-calibrated");
  });

  it("ignores §8's past-tense changelog counts (T1a 63 / T1b 4)", () => {
    // §8 records what the CODEX-7 lock said in April 2026. It is history, and a
    // gate that rewrote history would be worse than the drift it prevents.
    expect(parseSubTierCounts(buildDoc()).map((c) => c.stated)).not.toContain(63);
  });

  it("throws MethodologyFormatError when §2.1 is renamed", () => {
    const doc = buildDoc({ subTierHeading: "### 2.1 Confidence levels" });
    expect(() => parseSubTierCounts(doc)).toThrow(MethodologyFormatError);
    expect(() => parseSubTierCounts(doc)).toThrow(/heading was renamed or removed/);
  });
});

describe("parseTotalClaims", () => {
  it("finds the Abstract and §5 total claims", () => {
    const claims = parseTotalClaims(buildDoc());
    expect(claims.map((c) => c.stated)).toEqual([459, 459]);
    expect(claims.map((c) => c.section)).toEqual([
      "## Abstract",
      "## 5. Known limitations",
    ]);
  });

  it("does not match the '3 regions' inside 'T3 regions'", () => {
    // §5 item 4 reads "T3 regions are flagged visually". Without the leading \b
    // the sweep reports a bogus 3-vs-459 failure on a sentence about tiers.
    const claims = parseTotalClaims("## 5. Known limitations\n\nT3 regions are flagged.\n");
    expect(claims).toEqual([]);
  });

  it("skips §2.1 (its counts are per-sub-tier) and §8 (history)", () => {
    expect(parseTotalClaims(buildDoc()).every((c) => c.stated === 459)).toBe(true);
  });
});

describe("checkMethodologyCounts", () => {
  it("passes when the prose matches the golden", () => {
    expect(checkMethodologyCounts(buildDoc(), GOLDEN)).toEqual([]);
  });

  it("reproduces the PR #979 regression: the pre-fix counts summing to 377", () => {
    const doc = buildDoc({
      headers: [
        "**T1a-live-tso (149 regions, ±15% peakGW envelope).** Live TSO feed.",
        "**T1b-live-domestic-anchored (10 regions, ±50% peakGW envelope).** Live feed.",
        "**T1c-live-neighbour-anchored (1 region, ±35.5% peakGW envelope).** Switzerland.",
        "**T2-annual-calibrated (6 regions, ±20% peakGW envelope).** Anchored.",
        "**T3-modelled (211 regions, ±40% peakGW envelope).** Typical-shape.",
      ],
    });
    const failures = checkMethodologyCounts(doc, GOLDEN);
    expect(failures.join("\n")).toContain("**T1a-live-tso** states 149 regions, expected 160");
    expect(failures.join("\n")).toContain("**T3-modelled** states 211 regions, expected 249");
    expect(failures.join("\n")).toContain("sum to 377, but the dataset holds 459 regions");
    // T1c was the one correct number and must not be reported.
    expect(failures.join("\n")).not.toContain("**T1c-");
  });

  it("names the sub-tier, the stated value and the expected value", () => {
    const doc = buildDoc({
      headers: [
        "**T1a-live-tso (160 regions, ±15%).** x",
        "**T1b-live-domestic-anchored (26 regions, ±50%).** x",
        "**T1c-live-neighbour-anchored (1 region, ±35.5%).** x",
        "**T2-annual-calibrated (22 regions, ±20%).** x",
        "**T3-modelled (249 regions, ±40%).** x",
      ],
    });
    const failures = checkMethodologyCounts(doc, GOLDEN);
    expect(failures).toHaveLength(2); // the T2 mismatch + the sum headline
    expect(failures[0]).toMatch(/\*\*T2-annual-calibrated\*\* states 22 regions, expected 23/);
  });

  it("flags a stale total claim", () => {
    const doc = buildDoc({ abstractTotal: "Measured or estimated across 377 regions." });
    expect(checkMethodologyCounts(doc, GOLDEN).join("\n")).toContain(
      "claims 377 regions, expected 459",
    );
  });

  // --- the "cannot pass by matching nothing" contract ---------------------

  it.each([
    ["an em-dash instead of parentheses", "**T2-annual-calibrated — 23 regions, ±20% envelope.** x"],
    ["no comma after the count", "**T2-annual-calibrated (23 regions) ±20% envelope.** x"],
    ["'zones' instead of 'regions'", "**T2-annual-calibrated (23 zones, ±20% envelope).** x"],
    ["a spelled-out number", "**T2-annual-calibrated (twenty-three regions, ±20%).** x"],
    ["the bold marker dropped", "T2-annual-calibrated (23 regions, ±20% envelope). x"],
    ["the header no longer line-initial", "See **T2-annual-calibrated (23 regions, ±20%).** x"],
  ])("fails loudly when a header changes format: %s", (_label, rewritten) => {
    const doc = buildDoc({
      headers: [
        "**T1a-live-tso (160 regions, ±15%).** x",
        "**T1b-live-domestic-anchored (26 regions, ±50%).** x",
        "**T1c-live-neighbour-anchored (1 region, ±35.5%).** x",
        rewritten,
        "**T3-modelled (249 regions, ±40%).** x",
      ],
    });
    // The count in each rewrite is still CORRECT — only the format moved. A gate
    // that swept for matches without asserting it found all five would go green.
    const failures = checkMethodologyCounts(doc, GOLDEN);
    expect(failures.join("\n")).toContain("no `**T2-<name> (N regions, ...` header found");
    expect(failures.join("\n")).toContain("this gate just stopped checking T2");
  });

  it("fails loudly when every header is reworded at once", () => {
    const doc = buildDoc({
      headers: SUB_TIER_KEYS.map((k) => `### ${k} — 999 regions`),
    });
    const failures = checkMethodologyCounts(doc, GOLDEN);
    for (const key of SUB_TIER_KEYS) {
      expect(failures.join("\n")).toContain(`no \`**${key}-<name> (N regions, ...\` header found`);
    }
    expect(failures.length).toBeGreaterThanOrEqual(SUB_TIER_KEYS.length);
  });

  it("fails loudly when the total claims are reworded away", () => {
    const doc = buildDoc({
      abstractTotal: "Measured or estimated across every tracked grid.",
      limitationsTotal: "2. **Geographic completeness.** Coverage is global.",
    });
    const failures = checkMethodologyCounts(doc, GOLDEN);
    expect(failures.join("\n")).toContain(
      `expected at least ${MIN_TOTAL_CLAIMS} \`N regions\` total claim(s)`,
    );
    expect(failures.join("\n")).toContain("found 0");
  });

  it("fails loudly when only one of the two total claims survives", () => {
    const doc = buildDoc({ limitationsTotal: "2. **Geographic completeness.** Coverage is global." });
    expect(checkMethodologyCounts(doc, GOLDEN).join("\n")).toContain("found 1");
  });

  it("flags a duplicate sub-tier header rather than picking one", () => {
    const doc = buildDoc({
      headers: [
        "**T1a-live-tso (160 regions, ±15%).** x",
        "**T1a-live-tso (160 regions, ±15%).** duplicated",
        "**T1b-live-domestic-anchored (26 regions, ±50%).** x",
        "**T1c-live-neighbour-anchored (1 region, ±35.5%).** x",
        "**T2-annual-calibrated (23 regions, ±20%).** x",
        "**T3-modelled (249 regions, ±40%).** x",
      ],
    });
    expect(checkMethodologyCounts(doc, GOLDEN).join("\n")).toContain(
      "two headers claim a count for T1a",
    );
  });

  it("reports an internally inconsistent golden before trusting its numbers", () => {
    const badGolden: GoldenCounts = { ...GOLDEN, total: 500 };
    expect(checkMethodologyCounts(buildDoc(), badGolden).join("\n")).toContain(
      "internally inconsistent: T1a+T1b+T1c+T2+T3 = 459 but \"total\" is 500",
    );
  });
});

describe("splitSections", () => {
  it("keys sections by their full heading line and keeps 1-based line numbers", () => {
    const sections = splitSections("## A\n\nfirst\n\n### B\n\nsecond\n");
    expect(sections.map((s) => s.heading)).toEqual(["(preamble)", "## A", "### B"]);
    expect(sections[1].lines.find((l) => l.text === "first")?.line).toBe(3);
  });
});

// --- the real document, not a fixture ------------------------------------

describe("src/methodology.md (as committed)", () => {
  const markdown = readFileSync(
    join(process.cwd(), "src", "methodology.md"),
    "utf-8",
  );
  const golden = JSON.parse(
    readFileSync(
      join(process.cwd(), "scripts", "ci", "golden", "tier-counts.json"),
      "utf-8",
    ),
  ) as GoldenCounts;

  it("still carries all five sub-tier headers in the parsed format", () => {
    expect(parseSubTierCounts(markdown).map((c) => c.key)).toEqual([...SUB_TIER_KEYS]);
  });

  it(`still carries at least ${MIN_TOTAL_CLAIMS} total claims`, () => {
    expect(parseTotalClaims(markdown).length).toBeGreaterThanOrEqual(MIN_TOTAL_CLAIMS);
  });

  it("agrees with scripts/ci/golden/tier-counts.json", () => {
    expect(checkMethodologyCounts(markdown, golden)).toEqual([]);
  });
});
