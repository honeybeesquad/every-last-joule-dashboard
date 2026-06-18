import type { Region, RegionData } from "./types";

/**
 * Three-way fuel bucketing for the renewable-only dashboard view.
 */
export type Fuel = "solar" | "wind" | "hydro";

export const FUEL_ORDER: Fuel[] = ["solar", "wind", "hydro"];

export const FUEL_LABEL: Record<Fuel, string> = {
  solar: "Solar",
  wind: "Wind",
  hydro: "Hydro",
};

/**
 * Per-fuel colour tokens. Themed at runtime via CSS custom properties so
 * that switching themes (Sunfire / Deepcurrent) re-colours every
 * canvas-painted surface.
 */
const FUEL_VAR: Record<Fuel, string> = {
  solar: "--fuel-solar",
  wind:  "--fuel-wind",
  hydro: "--fuel-hydro",
};

const FUEL_DEFAULT: Record<Fuel, string> = {
  solar: "#ffd05a",
  wind:  "#67e8f9",
  hydro: "#b8cdff",
};

export function getFuelColor(fuel: Fuel): string {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return FUEL_DEFAULT[fuel];
  }
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(FUEL_VAR[fuel])
    .trim();
  return raw || FUEL_DEFAULT[fuel];
}

/**
 * Region-aware pillar/swatch colour resolver.
 */
export function getRegionFuelColor(region: Region, regionData?: RegionData): string {
  return getFuelColor(dominantFuel(region, regionData));
}

/**
 * Empirical curtailment split for `kind: "mixed"` regions, derived from
 * published generation-mix data for 2024.
 */
const MIXED_SPLITS: Record<string, Partial<Record<Fuel, number>>> = {
  peru:           { hydro: 0.70, solar: 0.20, wind: 0.10 },
  "south-africa": { wind:  0.55, solar: 0.45 },
};

/** True for any region that should contribute to the renewable headline. */
export function isRenewable(_region: Region): boolean {
  return true;
}

/**
 * Fraction of the given region's curtailment GW that belongs to `fuel`.
 * Returns 0..1.
 *
 * A loader-emitted `regionData.fuelShare` takes precedence over the canonical
 * `region.kind` — this lets loaders that pull technology-separated feeds
 * (e.g. ONS Brazil: parallel wind+solar constrained-off) communicate the
 * real observed mix instead of being pigeonholed into a single kind.
 */
export function fuelShare(region: Region, fuel: Fuel, regionData?: RegionData): number {
  if (regionData?.fuelShare && Object.keys(regionData.fuelShare).length > 0) {
    return regionData.fuelShare[fuel] ?? 0;
  }
  if (region.kind === "mixed") {
    const split = MIXED_SPLITS[region.id];
    return split?.[fuel] ?? 0;
  }
  if (region.kind === "solar" && fuel === "solar") return 1;
  if (region.kind === "wind"  && fuel === "wind")  return 1;
  if (region.kind === "hydro" && fuel === "hydro") return 1;
  if (region.kind === "geo"   && fuel === "hydro") return 1;
  return 0;
}

/**
 * Dominant fuel bucket for the given region.
 */
export function dominantFuel(region: Region, regionData?: RegionData): Fuel {
  const hasDynamic = regionData?.fuelShare && Object.keys(regionData.fuelShare).length > 0;
  if (hasDynamic) {
    let best: Fuel = "solar";
    let bestShare = -1;
    for (const f of FUEL_ORDER) {
      const s = regionData!.fuelShare![f] ?? 0;
      if (s > bestShare) { best = f; bestShare = s; }
    }
    return best;
  }
  if (region.kind === "mixed") {
    const split = MIXED_SPLITS[region.id] ?? {};
    let best: Fuel = "solar";
    let bestShare = -1;
    for (const f of FUEL_ORDER) {
      const s = split[f] ?? 0;
      if (s > bestShare) {
        best = f;
        bestShare = s;
      }
    }
    return best;
  }
  if (region.kind === "wind")  return "wind";
  if (region.kind === "hydro") return "hydro";
  if (region.kind === "geo")   return "hydro";
  return "solar";
}
