// Emits scripts/backfill/zones.json from the canonical TS rate tables.
// Run (from repo root): npx tsx scripts/backfill/emit-zones.ts > scripts/backfill/zones.json
//
// The output is a flattened, Python-friendly list of zone records, each with
// a uniform `technologies: [{psrType, fuel, rate}]` shape regardless of the
// original loader's internal representation. Kept here rather than generated
// on demand so backfill agents can run without a Node toolchain if needed.

import { ZONES as ENTSOE_ZONES } from "../../src/data/entsoe.json.ts";

interface OutTech {
  psrType: string;
  fuel: string;
  rate: number;
}

interface OutZone {
  source: string;
  id: string;
  domain: string | null;
  technologies: OutTech[];
  sourceNote: string;
}

const zones: OutZone[] = [];

// ENTSO-E (multi-technology per zone)
for (const z of ENTSOE_ZONES) {
  zones.push({
    source: "entsoe",
    id: z.id,
    domain: z.domain,
    technologies: z.technologies.map((t) => ({ psrType: t.psrType, fuel: t.fuel, rate: t.rate })),
    sourceNote: z.sourceNote ?? "",
  });
}

// Norway — single rate per zone in the loader; we expand to B12 (hydro) + B19 (wind)
// matching how src/data/norway.json.ts queries the Transparency API.
const NORWAY_ZONES = [
  { id: "norway-no1", domain: "10YNO-1--------2", rate: 0.015, label: "NO1 Oslo / South-East hydro (load-centre, low curtailment)" },
  { id: "norway-no2", domain: "10YNO-2--------T", rate: 0.08,  label: "NO2 Kristiansand / South-West hydro+offshore wind (export-constrained)" },
  { id: "norway-no3", domain: "10YNO-3--------J", rate: 0.04,  label: "NO3 Trondheim / Central hydro+onshore wind" },
  { id: "norway-no4", domain: "10YNO-4--------9", rate: 0.06,  label: "NO4 Tromsø / North hydro+wind (export-constrained)" },
  { id: "norway-no5", domain: "10YNO-5--------8", rate: 0.025, label: "NO5 Bergen / West reservoir hydro (spring-spill only)" },
];
for (const z of NORWAY_ZONES) {
  zones.push({
    source: "entsoe",
    id: z.id,
    domain: z.domain,
    technologies: [
      { psrType: "B12", fuel: "hydro", rate: z.rate },
      { psrType: "B19", fuel: "wind", rate: z.rate },
    ],
    sourceNote: `Norway ${z.label}`,
  });
}

const out = {
  generated: new Date().toISOString(),
  note: "Auto-generated from src/data/*.json.ts. Do not edit by hand; re-run scripts/backfill/emit-zones.ts.",
  zones,
};

process.stdout.write(JSON.stringify(out, null, 2) + "\n");
