import { isSolarNight } from "./solar-mask.js";
import type { Region, RegionData } from "./types";

/**
 * Three-way fuel bucketing (solar / wind / hydro) for the renewable
 * dashboard. Geothermal collapses into the hydro bucket — both are
 * always-on baseload renewables, narratively grouped together.
 */
export type Fuel = "solar" | "wind" | "hydro";

export const FUEL_ORDER: Fuel[] = ["solar", "wind", "hydro"];

/** Bucket for a `kind: "mixed"` region with neither a MIXED_SPLITS entry nor
 *  a loader-emitted fuelShare. Hydro because it is the always-on bucket: an
 *  unsourced region should not be asserted to be solar, which is the one
 *  fuel whose output is physically impossible for half of every day. */
export const UNSPLIT_MIXED_FUEL: Fuel = "hydro";

export const FUEL_LABEL: Record<Fuel, string> = {
  solar: "Solar",
  wind: "Wind",
  hydro: "Hydro",
};

/**
 * Per-fuel colour tokens. Themed at runtime via CSS custom properties so
 * that switching mode (light / dark) re-colours every canvas-painted
 * surface.
 */
const FUEL_VAR: Record<Fuel, string> = {
  solar: "--fuel-solar",
  wind:  "--fuel-wind",
  hydro: "--fuel-hydro",
};

const FUEL_DEFAULT: Record<Fuel, string> = {
  solar: "#ffd05a", // the paper figure's palette — used in SSR / non-DOM contexts only.
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
 * Region-aware pillar/swatch colour resolver. Centralises dominant-fuel
 * routing so individual call sites (globe canvas, tooltip, future legend
 * strips) resolve colour identically.
 */
export function getRegionFuelColor(region: Region, regionData?: RegionData): string {
  return getFuelColor(dominantFuel(region, regionData));
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
  // Each split below is read off the capacity the region's own `source:`
  // string in regions.ts already cites — no new numbers are introduced.
  // Azerbaijan: "~200 MW solar + ~200 MW wind in operation post-2023".
  azerbaijan:     { solar: 0.50, wind: 0.50 },
  // Georgia: "~100 MW solar+wind combined, ~1.8 GW hydro" — hydro is ~95%
  // of renewable capacity, and the 100 MW is split evenly for want of a
  // finer published breakdown.
  georgia:        { hydro: 0.95, solar: 0.025, wind: 0.025 },
  // Sri Lanka: "~450 MW solar + ~300 MW wind operational".
  "sri-lanka":    { solar: 0.60, wind: 0.40 },
  peru:           { hydro: 0.70, solar: 0.20, wind: 0.10 },
  // South Africa: the residual 10% (CSP + biomass) is folded into solar
  // now that 'other' no longer has a column of its own.
  "south-africa": { wind:  0.55, solar: 0.45 },
};

/**
 * True for any region that should contribute to the renewable headline.
 * The dataset is renewables-only, so this holds for every region; retained
 * as the single semantic marker for that invariant and the call-site filter.
 */
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
  // A single-kind row is already one fuel. Zones that are split into
  // per-fuel rows (Norway NO1-NO4, Belgium) still carry the PARENT zone's
  // combined fuelShare on every child, because the split rows are derived
  // from one series. Applying that combined share to a child re-splits an
  // already-split row: `norway-no1-wind` was being credited 74.6% hydro, so
  // a wind row appeared in the hydro column at three quarters of its value,
  // and the same volume was counted twice across the two columns.
  if (region.kind === "solar" || region.kind === "wind" || region.kind === "hydro") {
    return canonicalKindShare(region.kind, fuel);
  }
  if (region.kind === "geo") return fuel === "hydro" ? 1 : 0;
  if (regionData?.fuelShare && Object.keys(regionData.fuelShare).length > 0) {
    return regionData.fuelShare[fuel] ?? 0;
  }
  if (region.kind === "mixed") {
    const split = MIXED_SPLITS[region.id];
    return split?.[fuel] ?? 0;
  }
  return 0;
}

/**
 * The solar share of a region at a given UTC hour: its ordinary share while
 * the sun is up where the region is, and zero while it is not.
 *
 * Callers that split an hourly total by fuel must use this rather than the
 * flat annual `fuelShare`. A mixed region's profile is one combined series —
 * its wind and hydro legitimately run overnight — so multiplying the 3am
 * total by an annual solar ratio manufactures solar curtailment in the dark.
 * Masking the region's whole profile cannot fix that without deleting the
 * wind and hydro along with it; the attribution is what has to be masked.
 *
 * The daylight window is isSolarNight from solar-mask.ts — the same predicate
 * maskSolarNight uses, so a region cannot be lit by one rule and dark by the
 * other. It was duplicated here as a literal; that is what this shares.
 */
export function solarShareAtHour(
  region: Region,
  utcHour: number,
  regionData?: RegionData,
): number {
  const share = fuelShare(region, "solar", regionData);
  if (share <= 0) return 0;
  return isSolarNight(utcHour, region.lon) ? 0 : share;
}

/**
 * Hourly-correct fuel split. Identical to `fuelShare` for wind and hydro,
 * which run at any hour; solar additionally goes to zero in local darkness.
 */
export function fuelShareAtHour(
  region: Region,
  fuel: Fuel,
  utcHour: number,
  regionData?: RegionData,
): number {
  return fuel === "solar"
    ? solarShareAtHour(region, utcHour, regionData)
    : fuelShare(region, fuel, regionData);
}

/** Canonical single-kind mapping. Geothermal collapses into the hydro
 *  bucket for the 3-way scheme: both are always-on baseload renewables. */
function canonicalKindShare(kind: "solar" | "wind" | "hydro", fuel: Fuel): number {
  return kind === fuel ? 1 : 0;
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
    // With no split and no loader fuelShare every share is 0, and a
    // `bestShare = -1` seed made the FIRST fuel in FUEL_ORDER win by
    // default — which is solar. Eleven mixed regions had no split, so each
    // was drawn as a solar pillar whatever it actually burns: Georgia is
    // ~95% hydro by the capacity its own source cites and still rendered
    // gold, on a flat profile, so it read as solar curtailing at midnight.
    // Seed at 0 and require a real share to win; fall back to hydro, the
    // always-on bucket, so an unsplit region is never asserted to be solar.
    let best: Fuel = UNSPLIT_MIXED_FUEL;
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
  if (region.kind === "wind")  return "wind";
  if (region.kind === "hydro") return "hydro";
  if (region.kind === "geo")   return "hydro"; // geo collapses to hydro bucket
  return "solar"; // solar + any unclassified renewable default
}
