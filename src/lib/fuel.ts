import type { Region } from "./types";

/**
 * Four-way fuel bucketing for the renewable-only dashboard view. Flare is
 * deliberately excluded — it belongs to a separate always-on story and
 * would otherwise dominate the aggregate thanks to 24/7 base-load.
 */
export type Fuel = "solar" | "wind" | "hydro" | "other";

export const FUEL_ORDER: Fuel[] = ["solar", "wind", "hydro", "other"];

export const FUEL_LABEL: Record<Fuel, string> = {
  solar: "Solar",
  wind: "Wind",
  hydro: "Hydro",
  other: "Other / mixed",
};

/**
 * Colour tokens for timeline areas, hotspot column dots, and (optionally)
 * globe pillars. Chosen to sit in the existing teal palette while staying
 * visually separable.
 */
export const FUEL_COLOR: Record<Fuel, string> = {
  solar: "#f5c542",   // warm amber - mid-day sun
  wind:  "#14afac",   // brand teal
  hydro: "#3b82c4",   // water blue
  other: "#8b5fbf",   // muted violet
};

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
  "south-africa": { wind:  0.55, solar: 0.35, other: 0.10 },
};

/** True for any region that should contribute to the renewable headline. */
export function isRenewable(region: Region): boolean {
  return region.kind !== "flare";
}

/**
 * Fraction of the given region's curtailment GW that belongs to `fuel`.
 * Returns 0..1. Flare regions return 0 for every bucket.
 */
export function fuelShare(region: Region, fuel: Fuel): number {
  if (region.kind === "flare") return 0;
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
 */
export function dominantFuel(region: Region): Fuel {
  if (region.kind === "flare") return "other"; // should not be surfaced
  if (region.kind === "mixed") {
    const split = MIXED_SPLITS[region.id] ?? {};
    let best: Fuel = "other";
    let bestShare = 0;
    for (const f of FUEL_ORDER) {
      const s = split[f] ?? 0;
      if (s > bestShare) {
        best = f;
        bestShare = s;
      }
    }
    return best;
  }
  if (region.kind === "solar") return "solar";
  if (region.kind === "wind")  return "wind";
  if (region.kind === "hydro") return "hydro";
  return "other";
}
