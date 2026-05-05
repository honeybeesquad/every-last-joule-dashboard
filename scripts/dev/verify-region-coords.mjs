// Verifies that each region's (lat, lon) lies inside the parent country
// polygon from Natural Earth 110m countries-topojson. Used during the
// per-fuel coord differentiation sweep so we don't accidentally place
// spain-wind in Portugal or pakistan-solar in India.
//
// Usage:  node scripts/dev/verify-region-coords.mjs candidates.json
// candidates.json: [{ id, country, lat, lon }, ...] where `country` is ISO-3.

import fs from "node:fs";
import * as topojson from "topojson-client";
import { geoContains } from "d3-geo";

const topo = JSON.parse(fs.readFileSync("src/data/countries-110m.json", "utf8"));
const countriesFc = topojson.feature(topo, topo.objects.countries);

// NE 110m countries-topojson here only carries `properties.name`; feature.id
// is the numeric M49 code. Map ISO-3 → name for the countries we need.
const ISO3_TO_NAME = {
  ESP: "Spain", PRT: "Portugal", FRA: "France", DEU: "Germany", ITA: "Italy",
  GRC: "Greece", TUR: "Turkey", BGR: "Bulgaria", ROU: "Romania", HUN: "Hungary",
  SVK: "Slovakia", CZE: "Czechia", HRV: "Croatia", SRB: "Serbia", SVN: "Slovenia",
  MKD: "Macedonia", MDA: "Moldova", BLR: "Belarus", POL: "Poland",
  NLD: "Netherlands", BEL: "Belgium", LUX: "Luxembourg",
  FIN: "Finland", IRL: "Ireland", GBR: "United Kingdom",
  DNK: "Denmark", SWE: "Sweden", NOR: "Norway",
  CHN: "China", PHL: "Philippines", PAK: "Pakistan",
  USA: "United States of America", AUS: "Australia", NZL: "New Zealand",
};

function findFeature(iso3) {
  const name = ISO3_TO_NAME[iso3];
  if (!name) return null;
  return countriesFc.features.find((f) => f.properties?.name === name) ?? null;
}

const candidates = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
let pass = 0;
let fail = 0;
for (const c of candidates) {
  const feat = findFeature(c.country);
  if (!feat) {
    console.log(`SKIP ${c.id} country=${c.country} (no NE polygon)`);
    continue;
  }
  const inside = geoContains(feat, [c.lon, c.lat]);
  if (inside) {
    pass++;
    console.log(`OK   ${c.id} (${c.lat}, ${c.lon}) inside ${c.country}`);
  } else {
    fail++;
    console.log(`FAIL ${c.id} (${c.lat}, ${c.lon}) NOT inside ${c.country}`);
  }
}
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
