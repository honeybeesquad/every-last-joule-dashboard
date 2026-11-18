import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STATIC_REGIONS } from "../../src/data/statics.json";
import { TSO_GRID_MARKERS } from "../../src/data/tso-grid-markers.json";
import { REGIONS } from "../../src/lib/regions";
import {
  anchorGroups,
  verdict,
  type AnchorGroup,
  type NationalGeneration,
} from "../../scripts/lib/statics-anchor-check";
import { pickValue } from "../../scripts/research/national-generation";

const generation: NationalGeneration = JSON.parse(
  readFileSync(join(process.cwd(), "data", "national-generation.json"), "utf8"),
);
const groups = anchorGroups(REGIONS, STATIC_REGIONS, generation);

/**
 * Statics regions the reference cannot test. Review them by hand, and add one
 * here only with a reason.
 */
const UNTESTABLE = [
  // No series in the reference.
  "andorra", "liechtenstein", "marshall-islands", "micronesia", "monaco", "palau", "san-marino", "tuvalu",
  // Zero solar recorded every year since 2016, while their operators list a
  // few MW of PV: not reported, rather than none.
  "chad", "comoros", "djibouti", "dominica", "east-timor", "gambia", "grenada", "guinea-bissau",
  "haiti", "sao-tome", "st-vincent", "turkmenistan",
];

/** The seventeen anchors dropped on 2026-09-29; now unpublished grid markers. */
const DROPPED = [
  "benin", "botswana", "colombia-wind", "cote-divoire", "eswatini", "ghana", "guatemala",
  "guatemala-siepac", "laos", "libya", "myanmar", "nicaragua", "niger", "nigeria",
  "south-sudan", "sudan", "venezuela",
];

describe("statics anchors against national generation", () => {
  it("no anchor claims as much curtailment as the country recorded generating from that fuel", () => {
    const contradicted = groups
      .filter((g) => verdict(g) === "contradicted")
      .map(
        (g) =>
          `${g.regionIds.join(" + ")} (${g.country} ${g.fuels.join("+")}): anchor ${g.anchorTWh} TWh/yr, ` +
          `generation ${g.generationTWh} TWh (${g.years.join("/")})`,
      );
    expect(contradicted).toEqual([]);
  });

  it("only the listed regions are untestable", () => {
    const untestable = groups.filter((g) => verdict(g) === "untestable").flatMap((g) => g.regionIds);
    expect(untestable.sort()).toEqual([...UNTESTABLE].sort());
  });

  it("the anchors dropped on 2026-09-29 are markers whose served note is the page's label", () => {
    const markers = new Map(TSO_GRID_MARKERS.map((m) => [m.id, m]));
    const regions = new Map(REGIONS.map((r) => [r.id, r]));
    for (const id of DROPPED) {
      expect(STATIC_REGIONS[id], `${id} still has a statics anchor`).toBeUndefined();
      expect(markers.get(id)?.note, `${id} marker note`).toBe(regions.get(id)?.source);
    }
  });

  it("every grid marker's label says its waste is unpublished", () => {
    const regions = new Map(REGIONS.map((r) => [r.id, r]));
    const unlabelled = TSO_GRID_MARKERS.filter((m) => !/unpublished/i.test(regions.get(m.id)?.source ?? ""));
    expect(unlabelled.map((m) => m.id)).toEqual([]);
  });
});

describe("the rules behind the check", () => {
  const group = (anchorTWh: number, generationTWh: number | null): AnchorGroup => ({
    country: "XXX",
    fuels: ["solar"],
    regionIds: ["x"],
    anchorTWh,
    generationTWh,
    years: [2024],
  });

  it("allows for the reference's 0.01 TWh rounding, and cannot test a zero or a gap", () => {
    expect(verdict(group(0.2, 0.17))).toBe("contradicted");
    expect(verdict(group(0.01, 0.01))).toBe("passes");
    expect(verdict(group(0.1, 0.1))).toBe("passes");
    expect(verdict(group(0.05, 0))).toBe("untestable");
    expect(verdict(group(0.05, null))).toBe("untestable");
  });

  it("treats a zero after non-zero years as a gap, and keeps a zero that has always been zero", () => {
    const lesotho = new Map<number, number | null>([[2021, 0.53], [2022, 0.48], [2023, 0], [2024, 0]]);
    expect(pickValue(lesotho)).toEqual({ twh: 0.48, year: 2022 });
    const alwaysZero = new Map<number, number | null>([[2016, 0], [2024, 0]]);
    expect(pickValue(alwaysZero)).toEqual({ twh: 0, year: 2024 });
    const lateGap = new Map<number, number | null>([[2022, 0.3], [2023, 0.4], [2024, null], [2025, 0.9]]);
    expect(pickValue(lateGap)).toEqual({ twh: 0.4, year: 2023 });
  });
});
