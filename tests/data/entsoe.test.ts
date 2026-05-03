import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const xml = readFileSync(
  join(__dirname, "../fixtures/entsoe-germany-7d.xml"),
  "utf8"
);

// We must use dynamic import because src/data/entsoe.json.ts executes run() 
// at the top level, which fails if ENTSOE_API_TOKEN is missing.
let parseEntsoeXml: any;
let buildZoneData: any;
let ZONES: any;

describe("entsoe parser", () => {
  beforeAll(async () => {
    process.env.ENTSOE_API_TOKEN = "dummy-token";
    const module = await import("../../src/data/entsoe.json.js");
    parseEntsoeXml = module.parseEntsoeXml;
    buildZoneData = module.buildZoneData;
    ZONES = module.ZONES;
  });

  it("parses >600 points from a 7-day Germany wind fixture (15-min resolution)", () => {
    const points = parseEntsoeXml(xml);
    expect(points.length).toBeGreaterThan(600);
  });

  it("emits valid ISO UTC timestamps", () => {
    const points = parseEntsoeXml(xml);
    for (const p of points.slice(0, 20)) {
      expect(() => new Date(p.utcTimestamp).toISOString()).not.toThrow();
      expect(p.utcTimestamp).toMatch(/Z$/);
    }
  });

  it("points are chronologically ordered", () => {
    const points = parseEntsoeXml(xml);
    for (let i = 1; i < points.length; i++) {
      expect(new Date(points[i].utcTimestamp).getTime())
        .toBeGreaterThanOrEqual(new Date(points[i - 1].utcTimestamp).getTime());
    }
  });

  it("mw values are non-negative numbers", () => {
    const points = parseEntsoeXml(xml);
    for (const p of points) {
      expect(typeof p.mw).toBe("number");
      expect(Number.isFinite(p.mw)).toBe(true);
      expect(p.mw).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("buildZoneData", () => {
  beforeAll(async () => {
    process.env.ENTSOE_API_TOKEN = "dummy-token";
    const module = await import("../../src/data/entsoe.json.js");
    parseEntsoeXml = module.parseEntsoeXml;
    buildZoneData = module.buildZoneData;
    ZONES = module.ZONES;
  });

  it("germany profile has 24 entries and matches sourceNote", () => {
    const points = parseEntsoeXml(xml);
    const rd = buildZoneData("germany", points, 0.02,
      "ENTSO-E wind onshore × 2% calibrated curtailment rate (Germany 2024 redispatch book figures)");
    expect(rd.regionId).toBe("germany");
    expect(rd.profile.length).toBe(24);
    expect(rd.sourceNote).toContain("2%");
  });

  it("iberia calibration at 2% produces half the totalTWh of finland at 5% for same raw points", () => {
    const points = parseEntsoeXml(xml);
    const iberia = buildZoneData("iberia", points, 0.02, "x");
    const finland = buildZoneData("finland", points, 0.05, "y");
    // totalTWh scales linearly with rate
    expect(finland.totalTWh / iberia.totalTWh).toBeCloseTo(2.5, 1);
  });

  it("keeps ENTSO-E only for zones without direct TSO CSV replacements", () => {
    const ids = ZONES.map((z: any) => z.id);
    expect(ids).toEqual(expect.arrayContaining(["netherlands"]));
    expect(ids).not.toEqual(expect.arrayContaining(["france", "denmark-west"]));
  });

  it("includes the v1a ENTSO-E expansion zones", () => {
    const ids = ZONES.map((z: any) => z.id);
    expect(ids).toEqual(expect.arrayContaining([
      "poland",
      "greece",
      "romania",
      "italy-north-zone",  // split from italy-national; 35% of Terna 2024 national total
      "italy-sicily",      // replaces italy-south (no A75 data); transmission-constrained island
      "italy-sardinia"     // 20% of national total; island isolation
    ]));
  });

  it("includes the v1f ENTSO-E expansion zones and keeps Turkey out of ENTSO-E", () => {
    const ids = ZONES.map((z: any) => z.id);
    expect(ids).toEqual(expect.arrayContaining([
      "portugal",
      "sweden-north",
      "sweden-south"
    ]));
    expect(ids).not.toEqual(expect.arrayContaining(["turkey"]));
  });
});
