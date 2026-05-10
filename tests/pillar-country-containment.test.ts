/**
 * Invariant: every region's (lon, lat) places its pillar base inside its declared
 * country polygon.
 *
 * Project memory explicitly forbids using screen-px offsets to fix pillar/polygon
 * misalignment — when a pillar floats over the wrong country it is a coordinate
 * bug in regions.ts, not a render-side hack. This test catches those bugs at CI
 * time, before any rendering occurs.
 *
 * Tolerance: 0.5° offset on each of the four cardinal neighbours is checked in
 * addition to the exact point. This handles regions whose centroids sit on
 * coastlines and are technically just outside the simplified 110m polygon. 0.5°
 * (~55 km) is large enough to cover reasonable coastal offsets but small enough
 * to still catch genuine misplacements (wrong-country placement is typically
 * hundreds of km off).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as topojson from "topojson-client";
import { geoContains } from "d3-geo";
import type { Topology } from "topojson-specification";
import type { GeoJsonProperties, FeatureCollection, Feature, Geometry } from "geojson";
import { REGIONS } from "../src/lib/regions";

// ---------------------------------------------------------------------------
// ISO-3 alpha → ISO numeric string mapping
// Source: ISO 3166-1. Only the country codes actually present in regions.ts are
// listed here; unmapped codes trigger a skip-with-log (see edge cases below).
// ---------------------------------------------------------------------------
const ISO3_TO_NUMERIC: Record<string, string> = {
  AFG: "004",
  AGO: "024",
  ALB: "008",
  AND: "020", // Andorra — NOT in 110m topojson; will be skipped
  ARE: "784",
  ARG: "032",
  ARM: "051",
  ATG: "028", // Antigua & Barbuda — NOT in 110m topojson
  AUS: "036",
  AUT: "040",
  AZE: "031",
  BDI: "108",
  BEL: "056",
  BEN: "204",
  BFA: "854",
  BGD: "050",
  BGR: "100",
  BHR: "048", // Bahrain — NOT in 110m topojson
  BHS: "044",
  BIH: "070",
  BLR: "112",
  BLZ: "084",
  BOL: "068",
  BRA: "076",
  BRB: "052", // Barbados — NOT in 110m topojson
  BRN: "096",
  BTN: "064",
  BWA: "072",
  CAF: "140",
  CAN: "124",
  CHE: "756",
  CHL: "152",
  CHN: "156",
  CIV: "384",
  CMR: "120",
  COD: "180",
  COG: "178",
  COL: "170",
  COM: "174", // Comoros — NOT in 110m topojson
  CPV: "132", // Cabo Verde — NOT in 110m topojson
  CRI: "188",
  CUB: "192",
  CYP: "196",
  CZE: "203",
  DEU: "276",
  DJI: "262",
  DMA: "212", // Dominica — NOT in 110m topojson
  DNK: "208",
  DOM: "214",
  DZA: "012",
  ECU: "218",
  EGY: "818",
  ERI: "232",
  ESP: "724",
  EST: "233",
  ETH: "231",
  FIN: "246",
  FJI: "242",
  FRA: "250",
  FSM: "583", // Micronesia — NOT in 110m topojson
  GAB: "266",
  GBR: "826",
  GEO: "268",
  GHA: "288",
  GIN: "324",
  GMB: "270",
  GNB: "624",
  GNQ: "226",
  GRC: "300",
  GRD: "308", // Grenada — NOT in 110m topojson
  GTM: "320",
  GUF: "254", // French Guiana — NOT in 110m topojson (overseas territory)
  GUY: "328",
  HND: "340",
  HRV: "191",
  HTI: "332",
  HUN: "348",
  IDN: "360",
  IND: "356",
  IRL: "372",
  IRN: "364",
  IRQ: "368",
  ISL: "352",
  ISR: "376",
  ITA: "380",
  JAM: "388",
  JOR: "400",
  JPN: "392",
  KAZ: "398",
  KEN: "404",
  KGZ: "417",
  KHM: "116",
  KIR: "296", // Kiribati — NOT in 110m topojson (atoll islands)
  KNA: "659", // St Kitts & Nevis — NOT in 110m topojson
  KOR: "410",
  KWT: "414",
  LAO: "418",
  LBN: "422",
  LBR: "430",
  LBY: "434",
  LCA: "662", // St Lucia — NOT in 110m topojson
  LIE: "438", // Liechtenstein — NOT in 110m topojson
  LKA: "144",
  LSO: "426",
  LTU: "440",
  LUX: "442",
  LVA: "428",
  MAR: "504",
  MCO: "492", // Monaco — NOT in 110m topojson
  MDA: "498",
  MDG: "450",
  MDV: "462", // Maldives — NOT in 110m topojson (atolls)
  MEX: "484",
  MHL: "584", // Marshall Islands — NOT in 110m topojson
  MKD: "807",
  MLI: "466",
  MLT: "470", // Malta — NOT in 110m topojson
  MMR: "104",
  MNE: "499",
  MNG: "496",
  MOZ: "508",
  MRT: "478",
  MUS: "480", // Mauritius — NOT in 110m topojson
  MWI: "454",
  MYS: "458",
  NAM: "516",
  NER: "562",
  NGA: "566",
  NIC: "558",
  NLD: "528",
  NOR: "578",
  NPL: "524",
  NRU: "520", // Nauru — NOT in 110m topojson
  NZL: "554",
  OMN: "512",
  PAK: "586",
  PAN: "591",
  PER: "604",
  PHL: "608",
  PLW: "585", // Palau — NOT in 110m topojson
  PNG: "598",
  POL: "616",
  PRK: "408",
  PRT: "620",
  PRY: "600",
  PSE: "275",
  QAT: "634",
  ROU: "642",
  RUS: "643",
  RWA: "646",
  SAU: "682",
  SDN: "729",
  SEN: "686",
  SGP: "702", // Singapore — NOT in 110m topojson
  SLB: "090",
  SLE: "694",
  SLV: "222",
  SMR: "674", // San Marino — NOT in 110m topojson
  SOM: "706",
  SRB: "688",
  SSD: "728",
  STP: "678", // São Tomé & Príncipe — NOT in 110m topojson
  SUR: "740",
  SVK: "703",
  SVN: "705",
  SWE: "752",
  SWZ: "748",
  SYC: "690", // Seychelles — NOT in 110m topojson
  SYR: "760",
  TCD: "148",
  TGO: "768",
  THA: "764",
  TJK: "762",
  TKM: "795",
  TLS: "626",
  TON: "776", // Tonga — NOT in 110m topojson
  TTO: "780",
  TUN: "788",
  TUR: "792",
  TUV: "798", // Tuvalu — NOT in 110m topojson
  TWN: "158",
  TZA: "834",
  UGA: "800",
  UKR: "804",
  URY: "858",
  USA: "840",
  UZB: "860",
  VCT: "670", // St Vincent — NOT in 110m topojson
  VEN: "862",
  VNM: "704",
  VUT: "548",
  WSM: "882", // Samoa — NOT in 110m topojson
  YEM: "887",
  ZAF: "710",
  ZMB: "894",
  ZWE: "716",
};

// ---------------------------------------------------------------------------
// Load and convert the TopoJSON
// ---------------------------------------------------------------------------

const topoPath = join(__dirname, "../src/data/countries-110m.json");
const topology = JSON.parse(readFileSync(topoPath, "utf-8")) as Topology;
const featureCollection = topojson.feature(
  topology,
  topology.objects["countries"],
) as FeatureCollection<Geometry, GeoJsonProperties>;

// Build a map: ISO numeric string → GeoJSON Feature
const numericToFeature = new Map<string, Feature<Geometry, GeoJsonProperties>>();
for (const feature of featureCollection.features) {
  const id = feature.id as string | undefined;
  if (id != null) {
    numericToFeature.set(String(id), feature);
  }
}

// ---------------------------------------------------------------------------
// Per-region polygon overrides
//
// countries-110m.json drops some islands from their parent-country polygon
// (Okinawa from JPN, Jeju from KOR, Vanuatu from its own archipelago bounds).
// Overrides supply a region-specific GeoJSON polygon used in place of the
// country polygon for the containment check. Coordinates are simple bounding
// boxes around the island — accuracy beyond "point falls inside box" is not
// needed for this invariant test.
// ---------------------------------------------------------------------------

const overridesPath = join(__dirname, "fixtures/region-polygon-overrides.geo.json");
const overridesCollection = JSON.parse(readFileSync(overridesPath, "utf-8")) as FeatureCollection<
  Geometry,
  GeoJsonProperties
>;
const regionIdToOverride = new Map<string, Feature<Geometry, GeoJsonProperties>>();
for (const feature of overridesCollection.features) {
  const id = feature.id as string | undefined;
  if (id != null) {
    regionIdToOverride.set(String(id), feature);
  }
}

// ---------------------------------------------------------------------------
// Tolerance: 0.5°
//
// We check the exact point AND the four cardinal neighbours at ±0.5°. This
// accepts regions whose centroid sits just outside a simplified coastline
// polygon. 0.5° (~55 km at the equator) is deliberate: large enough for
// coastal snap but small enough that a genuine wrong-country placement
// (typically hundreds of km off) still fails.
// ---------------------------------------------------------------------------
const TOLERANCE_DEG = 0.5;

function isContainedWithTolerance(
  feature: Feature<Geometry, GeoJsonProperties>,
  lon: number,
  lat: number,
): boolean {
  const candidates: [number, number][] = [
    [lon, lat],
    [lon + TOLERANCE_DEG, lat],
    [lon - TOLERANCE_DEG, lat],
    [lon, lat + TOLERANCE_DEG],
    [lon, lat - TOLERANCE_DEG],
  ];
  return candidates.some(([lo, la]) => geoContains(feature, [lo, la]));
}

// ---------------------------------------------------------------------------
// Build test cases, separating skipped entries
// ---------------------------------------------------------------------------

type TestCase = {
  id: string;
  country: string;
  lon: number;
  lat: number;
  feature: Feature<Geometry, GeoJsonProperties>;
};
type SkippedCase = { id: string; country: string; reason: string };

const testCases: TestCase[] = [];
const skippedCases: SkippedCase[] = [];

for (const region of REGIONS) {
  const numericId = ISO3_TO_NUMERIC[region.country];
  if (numericId == null) {
    // ISO-3 code not in our mapping table — likely a disputed territory or
    // code we haven't added yet. Log and skip.
    // TODO: extend ISO3_TO_NUMERIC if new country codes are added to regions.ts
    skippedCases.push({
      id: region.id,
      country: region.country,
      reason: `ISO-3 code "${region.country}" has no numeric mapping — add to ISO3_TO_NUMERIC`,
    });
    continue;
  }

  const feature = numericToFeature.get(numericId);
  if (feature == null) {
    // The 110m topojson omits many small island states and microstates
    // (Malta, Singapore, Kiribati, Palau, Tuvalu, etc.). Log and skip.
    // TODO: switch to a higher-resolution topojson if coverage for these is needed
    skippedCases.push({
      id: region.id,
      country: region.country,
      reason: `country "${region.country}" (numeric ${numericId}) has no polygon in countries-110m.json — likely a small island or microstate omitted from the 110m dataset`,
    });
    continue;
  }

  // Override polygon takes precedence over the country polygon for regions
  // whose island sits outside the 110m country boundary.
  const featureToCheck = regionIdToOverride.get(region.id) ?? feature;

  testCases.push({
    id: region.id,
    country: region.country,
    lon: region.lon,
    lat: region.lat,
    feature: featureToCheck,
  });
}

// ---------------------------------------------------------------------------
// Describe-block: log skipped regions once, then run the sweep
// ---------------------------------------------------------------------------

describe("pillar-country-containment", () => {
  // Report skipped regions (no assertion — just visibility in the test log)
  it("logs regions skipped due to missing polygons", () => {
    if (skippedCases.length > 0) {
      console.warn(
        `\n[pillar-country-containment] Skipping ${skippedCases.length} region(s) — no polygon in countries-110m.json or unmapped ISO-3:\n` +
          skippedCases.map((s) => `  SKIP ${s.id} (${s.country}): ${s.reason}`).join("\n"),
      );
    }
    // Always passes — this is a visibility test, not a hard assertion
    expect(skippedCases.length).toBeGreaterThanOrEqual(0);
  });

  it.each(testCases)(
    "region $id ($country) at (lon=$lon, lat=$lat) is inside its country polygon",
    ({ id, country, lon, lat, feature }) => {
      const contained = isContainedWithTolerance(feature, lon, lat);
      expect(
        contained,
        `region ${id} (${country}) at (lon=${lon}, lat=${lat}) is not inside its country polygon` +
          ` — fix coords in regions.ts, not in the test or with screen-px offsets`,
      ).toBe(true);
    },
  );
});
