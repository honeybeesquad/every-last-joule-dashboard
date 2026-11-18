/**
 * A modelled waste anchor in src/data/statics.json.ts claims that much energy
 * of one fuel was curtailed each year. It cannot claim as much as the whole
 * country generated from that fuel: curtailment equal to generation means half
 * the fuel's potential output was thrown away, which no national grid
 * reports. On 2026-09-29 seventeen anchors failed this and were dropped (see
 * STATUS.md); tests/data/statics-anchor-vs-generation.test.ts keeps it from
 * recurring, against data/national-generation.json
 * (scripts/research/national-generation.ts).
 *
 * The claim is the region's public `kind` in regions.ts, which the region page
 * shows as its waste modality. Regions in one country that claim the same
 * fuels are summed, so two small anchors cannot pass one at a time.
 *
 * Only recorded, non-zero generation can contradict an anchor. The reference
 * rounds to 0.01 TWh, so a recorded value stands for up to half a unit more.
 * A recorded zero proves nothing: for small grids the reference records no
 * solar at all where the operator lists a few MW of PV (Djibouti, East Timor,
 * Haiti), so zero often means "not reported". A claim spanning several fuels
 * is untestable when any of them is missing, since a partial sum would
 * understate the country's generation.
 */
import type { Region } from "../../src/lib/types.js";

export type Fuel = "solar" | "wind" | "hydro" | "otherRenewables" | "bioenergy";

export interface FuelValue {
  twh: number;
  year: number;
}

export interface NationalGeneration {
  countries: Record<string, Record<Fuel, FuelValue | null>>;
}

/** Half the reference's 0.01 TWh rounding unit. */
export const ROUNDING_TWH = 0.005;

/** The fuels a region's public kind claims. Mixed compares with all renewables. */
export function fuelsFor(kind: Region["kind"]): Fuel[] {
  switch (kind) {
    case "solar":
      return ["solar"];
    case "wind":
      return ["wind"];
    case "hydro":
      return ["hydro"];
    case "geo":
      return ["otherRenewables"];
    case "mixed":
      return ["solar", "wind", "hydro", "otherRenewables", "bioenergy"];
  }
}

export interface AnchorGroup {
  country: string;
  fuels: Fuel[];
  regionIds: string[];
  anchorTWh: number;
  /** Null when the reference lacks a value for any of the fuels. */
  generationTWh: number | null;
  years: number[];
}

export type Verdict = "passes" | "contradicted" | "untestable";

export function verdict(group: AnchorGroup): Verdict {
  if (group.generationTWh === null || group.generationTWh === 0) return "untestable";
  return group.anchorTWh >= group.generationTWh + ROUNDING_TWH ? "contradicted" : "passes";
}

/** One group per country and claimed fuel set, over the regions that have a statics anchor. */
export function anchorGroups(
  regions: readonly Pick<Region, "id" | "country" | "kind">[],
  anchors: Readonly<Record<string, { annualTWh: number }>>,
  generation: NationalGeneration,
): AnchorGroup[] {
  const groups = new Map<string, AnchorGroup>();
  for (const region of regions) {
    const anchor = anchors[region.id];
    if (!anchor) continue;
    const fuels = fuelsFor(region.kind);
    const key = `${region.country}|${fuels.join("+")}`;
    let group = groups.get(key);
    if (!group) {
      const values = fuels
        .map((fuel) => generation.countries[region.country]?.[fuel] ?? null)
        .filter((v): v is FuelValue => v !== null);
      const complete = values.length === fuels.length;
      group = {
        country: region.country,
        fuels,
        regionIds: [],
        anchorTWh: 0,
        generationTWh: complete ? values.reduce((sum, v) => sum + v.twh, 0) : null,
        years: [...new Set(values.map((v) => v.year))].sort(),
      };
      groups.set(key, group);
    }
    group.regionIds.push(region.id);
    group.anchorTWh += anchor.annualTWh;
  }
  return [...groups.values()];
}
