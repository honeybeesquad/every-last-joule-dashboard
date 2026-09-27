import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

import {
  countPublishedWasteRegions,
  showsWastePillar,
  unpublishedEmptyRegion,
} from "../src/lib/waste-status.js";
import type { RegionData } from "../src/lib/types.js";

// The dashboard's lead copy says curtailed energy was wasted "across N
// regions". Before the TSO-grid completeness work, N was REGIONS.length and
// that was defensible: every region carried a waste figure. It is not any
// more — the roster now also carries grids tracked for generation whose
// operators publish no waste at all. Counting those would assert curtailment
// the project has explicitly declined to invent, which is the same class of
// error as labelling a modelled figure "measured".

const measured = (id: string): RegionData =>
  ({ regionId: id, profile: Array(24).fill(1), totalTWh: 1, peakGW: 1, wasteStatus: "measured" }) as RegionData;
const measuredZero = (id: string): RegionData =>
  ({ regionId: id, profile: Array(24).fill(0), totalTWh: 0, peakGW: 0, wasteStatus: "measured-zero" }) as RegionData;
const legacy = (id: string): RegionData =>
  ({ regionId: id, profile: Array(24).fill(1), totalTWh: 1, peakGW: 1 }) as RegionData;

describe("countPublishedWasteRegions", () => {
  it("counts measured and measured-zero, not unpublished", () => {
    const data = {
      a: measured("a"),
      b: measuredZero("b"),
      c: unpublishedEmptyRegion("c", "TSO publishes generation only"),
    };
    const ids = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(countPublishedWasteRegions(data, ids)).toBe(2);
  });

  it("a measured zero is a published figure, not a missing one", () => {
    // "The operator published, and the answer was zero" is a fact about the
    // grid. "Unpublished" is a fact about the operator. They must not merge.
    expect(showsWastePillar(measuredZero("b"))).toBe(true);
    expect(showsWastePillar(unpublishedEmptyRegion("c", "note"))).toBe(false);
  });

  it("counts legacy snapshots that predate the field, matching showsWastePillar", () => {
    expect(countPublishedWasteRegions({ a: legacy("a") }, [{ id: "a" }])).toBe(1);
  });

  it("does not count a region absent from the payload", () => {
    expect(countPublishedWasteRegions({}, [{ id: "a" }, { id: "b" }])).toBe(0);
  });

  it("is strictly below the roster size once any grid is unpublished", () => {
    const ids = Array.from({ length: 10 }, (_, i) => ({ id: `r${i}` }));
    const data: Record<string, RegionData> = {};
    ids.forEach((r, i) => {
      data[r.id] = i < 3 ? unpublishedEmptyRegion(r.id, "no public waste series") : measured(r.id);
    });
    expect(countPublishedWasteRegions(data, ids)).toBe(7);
    expect(countPublishedWasteRegions(data, ids)).toBeLessThan(ids.length);
  });
});

describe("the claims that carry a region count", () => {
  const root = process.cwd();

  it("the lead copy counts published waste, not the roster length", () => {
    const index = readFileSync(join(root, "src/index.md"), "utf8");
    expect(index).toContain("countPublishedWasteRegions(regionData, REGIONS)");
    expect(index).not.toContain("const liveRegionCount = REGIONS.length");
  });

  it("the social card derives its number instead of hardcoding one", () => {
    const config = readFileSync(join(root, "observablehq.config.ts"), "utf8");
    const og = config.slice(config.indexOf("const OG_DESCRIPTION"), config.indexOf("const socialMeta"));
    expect(og).toContain("${REGIONS.length}");
    expect(og).not.toMatch(/\b\d{3}\s+grid/); // no hardcoded "459 grid regions"
  });

  it("the lead copy puts the published-waste count beside the roster size", () => {
    // "444 regions" on the hero beside "All 536" and "536 tracked regions"
    // read as a contradiction. Both numbers are right; the sentence now says
    // how they relate.
    const index = readFileSync(join(root, "src/index.md"), "utf8");
    const lead = index.slice(index.indexOf('id="lead-copy"'), index.indexOf("</p>", index.indexOf('id="lead-copy"')));
    expect(lead).toContain('id="region-count"');
    expect(lead).toContain("of the ${REGIONS.length} regions we track");
  });
});

describe("the approved wording for what the dataset counts", () => {
  const root = process.cwd();
  const claims: Array<[string, string]> = [
    ["src/index.md", 'id="lead-copy"'],
    ["observablehq.config.ts", "const OG_DESCRIPTION"],
    ["src/about.md", 'class="methodology-deck"'],
  ];

  it.each(claims)("%s says curtailed, spilled, or zero-priced", (file, marker) => {
    const text = readFileSync(join(root, file), "utf8");
    const at = text.indexOf(marker);
    expect(at, `${marker} not found in ${file}`).toBeGreaterThan(-1);
    // A claim ends at its paragraph's </p> or its template literal's closing `;.
    const claim = text.slice(at, at + text.slice(at).search(/<\/p>|`;/));
    expect(claim.toLowerCase()).toContain("curtailed, spilled, or zero-priced");
    expect(claim).not.toContain("constrained-off");
  });
});
