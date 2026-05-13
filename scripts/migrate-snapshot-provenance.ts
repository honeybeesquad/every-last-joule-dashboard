#!/usr/bin/env tsx
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stampSourceProvenance } from "../src/lib/source-provenance.js";
import type { RegionData, SourceProvenance } from "../src/lib/types.js";

const SNAP_DIR = join(process.cwd(), "data", "snapshots", "last-good");
const NON_REGION_FILES = new Set(["cbeci.json"]);
const LEGACY_REGION_SOURCE_PROVENANCE: ReadonlyMap<string, SourceProvenance> = new Map([
  ["bpa", "verified"],
  ["caiso", "verified"],
  ["denmark", "verified"],
  ["ercot-east", "verified"],
  ["ercot-native-east", "official-lead"],
  ["ercot-native-west", "official-lead"],
  ["ercot-west", "verified"],
  ["iso-ne", "verified"],
  ["miso", "verified"],
  ["n-norway", "verified"],
  ["north-sea-solar", "verified"],
  ["north-sea-wind", "verified"],
  ["nyiso", "verified"],
  ["pjm", "verified"],
  ["spp", "verified"],
  ["turkey", "verified"],
]);

function stableJson(value: unknown, previousText: string): string {
  const prettyPrinted = previousText.includes("\n");
  return prettyPrinted ? `${JSON.stringify(value, null, 2)}\n` : JSON.stringify(value);
}

function isRegionData(value: unknown): value is RegionData {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { regionId?: unknown }).regionId === "string" &&
    Array.isArray((value as { profile?: unknown }).profile)
  );
}

function stampLegacyRegionProvenance(value: unknown): unknown {
  if (isRegionData(value) && !value.sourceProvenance) {
    const sourceProvenance = LEGACY_REGION_SOURCE_PROVENANCE.get(value.regionId);
    return sourceProvenance ? { ...value, sourceProvenance } : value;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }
  const out: Record<string, unknown> = {};
  let touched = false;
  for (const [key, child] of Object.entries(value)) {
    const stamped = stampLegacyRegionProvenance(child);
    out[key] = stamped;
    touched ||= stamped !== child;
  }
  return touched ? out : value;
}

if (!existsSync(SNAP_DIR)) {
  console.error(`snapshot dir not found at ${SNAP_DIR}`);
  process.exit(2);
}

let filesChanged = 0;
let regionRecordsTouched = 0;

for (const file of readdirSync(SNAP_DIR).filter((name) => name.endsWith(".json"))) {
  if (NON_REGION_FILES.has(file)) continue;
  const path = join(SNAP_DIR, file);
  const before = readFileSync(path, "utf-8");
  const parsed = JSON.parse(before) as unknown;
  const stamped = stampLegacyRegionProvenance(stampSourceProvenance(parsed));
  const after = stableJson(stamped, before);

  if (after !== before) {
    writeFileSync(path, after);
    filesChanged++;
  }

  if (typeof stamped === "object" && stamped !== null && !Array.isArray(stamped)) {
    if ("regionId" in stamped && "sourceProvenance" in stamped) {
      regionRecordsTouched++;
    } else {
      regionRecordsTouched += Object.values(stamped).filter(
        (value) =>
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value) &&
          "regionId" in value &&
          "sourceProvenance" in value,
      ).length;
    }
  }
}

console.log(`Stamped sourceProvenance in ${filesChanged} files (${regionRecordsTouched} region records present).`);
