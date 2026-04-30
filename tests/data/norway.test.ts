import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseEntsoeXml, buildZoneData } from "../../src/lib/entsoe";

const __dirname = dirname(fileURLToPath(import.meta.url));
const xml = readFileSync(join(__dirname, "../fixtures/norway-sample.xml"), "utf8");

describe("norway loader helpers", () => {
  it("parses the Norway ENTSO-E fixture into ordered points", () => {
    const points = parseEntsoeXml(xml);
    expect(points.length).toBeGreaterThan(3);
    const last = points.at(-1);
    expect(last).toBeDefined();
    expect(points[0]!.utcTimestamp < last!.utcTimestamp).toBe(true);
  });

  it("builds RegionData for each of the 5 Norwegian bidding zones", () => {
    const points = parseEntsoeXml(xml);
    const zones = [
      { id: "norway-no1", rate: 0.015 },
      { id: "norway-no2", rate: 0.08 },
      { id: "norway-no3", rate: 0.04 },
      { id: "norway-no4", rate: 0.06 },
      { id: "norway-no5", rate: 0.025 },
    ];
    for (const { id, rate } of zones) {
      const region = buildZoneData(
        id,
        points,
        rate,
        `${id} hydro+wind × ${(rate * 100).toFixed(1)}% calibrated waste rate`,
      );
      expect(region.regionId).toBe(id);
      expect(region.profile.length).toBe(24);
      expect(region.sourceNote).toContain(`${(rate * 100).toFixed(1)}%`);
    }
  });
});
