import { describe, it, expect } from "vitest";

import { countReportingRegions, isReporting } from "../src/lib/region-reporting.js";
import { unpublishedEmptyRegion } from "../src/lib/waste-status.js";
import type { RegionData, SourceStatus } from "../src/lib/types.js";

const rec = (id: string, sourceStatus?: SourceStatus): RegionData =>
  ({ regionId: id, profile: Array(24).fill(1), totalTWh: 1, peakGW: 1, sourceStatus }) as RegionData;

describe("isReporting", () => {
  it("live and cached records report", () => {
    expect(isReporting(rec("a", "live"))).toBe(true);
    expect(isReporting(rec("a", "cached"))).toBe(true);
  });

  it("a record with no status reports (static payloads carry none)", () => {
    expect(isReporting(rec("a"))).toBe(true);
  });

  it("a degraded record does not: its loader failed and it serves old data", () => {
    expect(isReporting(rec("a", "degraded"))).toBe(false);
  });

  it("a missing record does not", () => {
    expect(isReporting(undefined)).toBe(false);
    expect(isReporting(null)).toBe(false);
  });

  it("an unpublished-waste grid reports on its generation", () => {
    expect(isReporting({ ...unpublishedEmptyRegion("malta", "note"), sourceStatus: "cached" })).toBe(true);
  });
});

describe("countReportingRegions", () => {
  it("counts roster ids only, and the 12 Oct fallback shape counts lower", () => {
    const roster = [{ id: "spain-wind" }, { id: "austria-wind" }, { id: "caiso" }];
    const healthy = {
      "spain-wind": rec("spain-wind", "live"),
      "austria-wind": rec("austria-wind", "cached"),
      caiso: rec("caiso", "live"),
      "not-on-roster": rec("not-on-roster", "live"),
    };
    expect(countReportingRegions(healthy, roster)).toBe(3);

    // A whole-loader ENTSO-E fallback: June's record served degraded, the
    // allowEmpty zone gone from the build.
    const fallback = { "spain-wind": rec("spain-wind", "degraded"), caiso: rec("caiso", "live") };
    expect(countReportingRegions(fallback, roster)).toBe(1);
  });
});

describe("the dashboard's reporting figure", () => {
  it("sits beside the roster size in the lead copy and is filled from countReportingRegions", async () => {
    const { readFileSync } = await import("node:fs");
    const index = readFileSync("src/index.md", "utf8");
    const at = index.indexOf('id="lead-copy"');
    const lead = index.slice(at, index.indexOf("</p>", at));
    expect(lead).toMatch(/of the \$\{REGIONS\.length\} regions we track \(<span id="regions-reporting"[^>]*>—<\/span> reporting\)/);
    expect(index).toMatch(/getElementById\("regions-reporting"\)[\s\S]{0,120}countReportingRegions\(regionData, REGIONS\)/);
  });
});
