#!/usr/bin/env tsx
/**
 * National renewable generation by fuel, for every country in REGIONS, from
 * Our World in Data's "electricity production by source" series (Ember and
 * the Energy Institute). Writes data/national-generation.json, which
 * tests/data/statics-anchor-vs-generation.test.ts reads: a modelled waste
 * anchor in statics.json cannot claim more curtailment than the country
 * generated from that fuel.
 *
 * Per fuel, the value is the latest year up to MAX_YEAR that has one. A zero
 * that follows non-zero years counts as missing, and the latest non-zero
 * value is used instead: OWID shows Lesotho's hydro at 0.39–0.54 TWh for
 * 2016–2022 and 0 for 2023–2024, a break in the series, not a shutdown.
 * Treating such zeros as gaps can only make the test more lenient.
 *
 * Usage: npx tsx scripts/research/national-generation.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { REGIONS } from "../../src/lib/regions.js";

const OWID_URL =
  "https://ourworldindata.org/grapher/electricity-prod-source-stacked.csv?v=1&csvType=full&useColumnShortNames=true";
const MAX_YEAR = 2024;
const COLUMNS = {
  solar: "solar_generation__twh",
  wind: "wind_generation__twh",
  hydro: "hydro_generation__twh",
  otherRenewables: "other_renewables_generation__twh",
  bioenergy: "bioenergy_stacked_generation__twh",
} as const;
type Fuel = keyof typeof COLUMNS;

export interface FuelValue {
  twh: number;
  year: number;
}

export type CountryGeneration = Record<Fuel, FuelValue | null>;

/** Latest usable value per fuel from one country's { year → TWh or null } series. */
export function pickValue(series: Map<number, number | null>, maxYear = MAX_YEAR): FuelValue | null {
  const years = [...series.keys()].filter((y) => y <= maxYear).sort((a, b) => a - b);
  let latest: FuelValue | null = null;
  let latestNonZero: FuelValue | null = null;
  for (const year of years) {
    const twh = series.get(year);
    if (twh == null) continue;
    latest = { twh, year };
    if (twh > 0) latestNonZero = { twh, year };
  }
  if (latest && latest.twh === 0 && latestNonZero) return latestNonZero;
  return latest;
}

async function main(): Promise<void> {
  const res = await fetch(OWID_URL, { headers: { "User-Agent": "every-last-joule research script" } });
  if (!res.ok) throw new Error(`OWID returned HTTP ${res.status}`);
  const lines = (await res.text()).trim().split("\n");
  const header = lines[0].split(",");
  const col = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`OWID CSV has no column ${name}`);
    return i;
  };
  const codeCol = col("code");
  const yearCol = col("year");
  const wanted = new Set(REGIONS.map((r) => r.country));
  const series = new Map<string, Record<Fuel, Map<number, number | null>>>();
  for (const line of lines.slice(1)) {
    const f = line.split(",");
    const code = f[codeCol];
    if (!wanted.has(code)) continue;
    const year = Number(f[yearCol]);
    const bucket =
      series.get(code) ??
      series
        .set(code, Object.fromEntries(Object.keys(COLUMNS).map((k) => [k, new Map()])) as Record<Fuel, Map<number, number | null>>)
        .get(code)!;
    for (const [fuel, name] of Object.entries(COLUMNS) as [Fuel, string][]) {
      const raw = f[col(name)];
      bucket[fuel].set(year, raw === "" || raw === undefined ? null : Number(raw));
    }
  }
  const countries: Record<string, CountryGeneration> = {};
  for (const code of [...series.keys()].sort()) {
    const s = series.get(code)!;
    countries[code] = Object.fromEntries(
      (Object.keys(COLUMNS) as Fuel[]).map((fuel) => [fuel, pickValue(s[fuel])]),
    ) as CountryGeneration;
  }
  const missing = [...wanted].filter((c) => !countries[c]).sort();
  const out = {
    source: "Our World in Data, electricity production by source (Ember; Energy Institute Statistical Review of World Energy)",
    url: OWID_URL,
    fetched: new Date().toISOString().slice(0, 10),
    unit: "TWh",
    rule: `Per fuel, the latest year up to ${MAX_YEAR} with a value; a zero after non-zero years is treated as a gap and the latest non-zero value is used.`,
    countriesWithoutData: missing,
    countries,
  };
  const path = join(process.cwd(), "data", "national-generation.json");
  // One country per line, so a refresh reviews as a line diff per country.
  const { countries: byCountry, ...meta } = out;
  const head = JSON.stringify(meta, null, 2).replace(/\n}$/, ",\n");
  const rows = Object.entries(byCountry).map(([code, fuels]) => `    ${JSON.stringify(code)}: ${JSON.stringify(fuels)}`);
  writeFileSync(path, `${head}  "countries": {\n${rows.join(",\n")}\n  }\n}\n`);
  console.log(`wrote ${path}: ${Object.keys(countries).length} countries; no OWID data for ${missing.length} (${missing.join(", ")})`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
