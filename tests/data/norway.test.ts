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

  it("builds n-norway RegionData with the 6% calibration", () => {
    const points = parseEntsoeXml(xml);
    const region = buildZoneData(
      "n-norway",
      points,
      0.06,
      "ENTSO-E NO-4 hydro+wind × 6% calibrated waste rate (export-constrained north Norway proxy)",
    );
    expect(region.regionId).toBe("n-norway");
    expect(region.profile.length).toBe(24);
    expect(region.sourceNote).toContain("6%");
  });
});
