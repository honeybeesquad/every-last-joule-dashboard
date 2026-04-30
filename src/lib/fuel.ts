import type { Region, RegionData } from "./types";

/**
 * Four-way fuel bucketing for the renewable-only dashboard view. Flare is
 * deliberately excluded — it belongs to a separate always-on story and
 * would otherwise dominate the aggregate thanks to 24/7 base-load.
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
 * that switching themes (Sunfire / Vellum / Eclipse) re-colours every
 * canvas-painted surface. Flare colour is locked across themes (BTC orange,
 * a data-meaning convention).
 */
const FUEL_VAR: Record<Fuel | "flare", string> = {
  solar: "--fuel-solar",
  wind:  "--fuel-wind",
  hydro: "--fuel-hydro",
  flare: "--data-flare",
};

const FUEL_DEFAULT: Record<Fuel | "flare", string> = {
  solar: "#ffd05a", // Sunfire default — used in SSR / non-DOM contexts only.
  wind:  "#67e8f9",
  hydro: "#b8cdff",
  flare: "#d83923",
};

export function getFuelColor(fuel: Fuel | "flare"): string {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return FUEL_DEFAULT[fuel];
  }
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(FUEL_VAR[fuel])
    .trim();
  return raw || FUEL_DEFAULT[fuel];
}

/**
 * Empirical curtailment split for `kind: "mixed"` regions, derived from
 * published generation-mix data for 2024. Values must sum to ≤ 1.0.
 *
 * - Peru: hydro-dominated (Mantaro, Charcani), growing solar in Atacama-
 *   adjacent region (Rubi, Tacna), small wind (Wayra I/II, Duna/Huambos).
 * - South Africa: wind (Jeffreys Bay, Cookhouse, Gouda) is the biggest
 *   renewable curtailment bucket; solar (Northern Cape IPP) smaller;
 *   residual goes to 'other' (CSP + biomass).
 */
const MIXED_SPLITS: Record<string, Partial<Record<Fuel, number>>> = {
  peru:           { hydro: 0.70, solar: 0.20, wind: 0.10 },
  // South Africa: the residual 10% (CSP + biomass) is folded into solar
  // now that 'other' no longer has a column of its own.
  "south-africa": { wind:  0.55, solar: 0.45 },
};

/** True for any region that should contribute to the renewable headline. */
export function isRenewable(region: Region): boolean {
  return region.kind !== "flare";
}

/**
 * Fraction of the given region's curtailment GW that belongs to `fuel`.
 * Returns 0..1. Flare regions return 0 for every bucket.
 *
 * A loader-emitted `regionData.fuelShare` takes precedence over the canonical
 * `region.kind` — this lets loaders that pull technology-separated feeds
 * (e.g. ONS Brazil: parallel wind+solar constrained-off) communicate the
 * real observed mix instead of being pigeonholed into a single kind.
 */
export function fuelShare(region: Region, fuel: Fuel, regionData?: RegionData): number {
  if (region.kind === "flare") return 0;
  if (regionData?.fuelShare && Object.keys(regionData.fuelShare).length > 0) {
    return regionData.fuelShare[fuel] ?? 0;
  }
  if (region.kind === "mixed") {
    const split = MIXED_SPLITS[region.id];
    return split?.[fuel] ?? 0;
  }
  // Canonical single-kind regions.
  if (region.kind === "solar" && fuel === "solar") return 1;
  if (region.kind === "wind"  && fuel === "wind")  return 1;
  if (region.kind === "hydro" && fuel === "hydro") return 1;
  return 0;
}

/**
 * Dominant fuel bucket for the given region — used to place it in the
 * correct hotspot column. Mixed regions sort into their largest split.
 * A loader-emitted `regionData.fuelShare` takes precedence.
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
  return "solar"; // solar + any unclassified renewable default
}
