import type { RegionData, PriceData } from "./types.js";

/**
 * Compute the instantaneous USD value of curtailment for one region at one UTC hour.
 *
 * Unit arithmetic:
 *   profile[h] is in GW. Multiply by 1000 to get MW.
 *   price is in USD/MWh.
 *   MW × USD/MWh = USD/h.
 *
 * T1 (live): priceProfileUSD[h] × profile[h] × 1000
 * T2 (static): priceUSD × profile[h] × 1000
 * T3 (none): 0
 */
export function usdValueAtHour(
  rd: RegionData,
  pd: PriceData,
  utcHour: number,
): number {
  if (pd.priceTier === "none") return 0;

  const h = ((Math.floor(utcHour) % 24) + 24) % 24;
  const mw = (rd.profile[h] ?? 0) * 1000; // GW → MW
  if (mw <= 0) return 0;

  if (pd.priceTier === "live") {
    const price = pd.priceProfileUSD?.[h];
    if (price == null || !Number.isFinite(price)) return 0;
    return price * mw;
  }

  if (pd.priceTier === "static") {
    const price = pd.priceUSD;
    if (price == null || !Number.isFinite(price)) return 0;
    return price * mw;
  }

  return 0;
}

/**
 * Annualise the per-hour USD value by multiplying by 8760.
 */
export function usdValuePerYear(
  rd: RegionData,
  pd: PriceData,
  utcHour: number,
): number {
  return usdValueAtHour(rd, pd, utcHour) * 8760;
}

/**
 * Sum instantaneous USD value across all regions that have price data.
 * Regions absent from priceData contribute 0.
 */
export function aggregateUsdAtHour(
  regionData: Record<string, RegionData>,
  priceData: Record<string, PriceData>,
  utcHour: number,
): number {
  let total = 0;
  for (const [id, rd] of Object.entries(regionData)) {
    const pd = priceData[id];
    if (!pd) continue;
    total += usdValueAtHour(rd, pd, utcHour);
  }
  return total;
}

/**
 * Count regions with curtailment but no price data.
 */
export function countNoPriceRegions(
  regionData: Record<string, RegionData>,
  priceData: Record<string, PriceData>,
): number {
  let count = 0;
  for (const id of Object.keys(regionData)) {
    const pd = priceData[id];
    if (!pd || pd.priceTier === "none") count++;
  }
  return count;
}

/** Format a global USD/h value: "$427M/h", "$1.2B/h", etc. */
export function formatUsdPerHour(usdPerHour: number): string {
  if (usdPerHour >= 1e9) return `$${(usdPerHour / 1e9).toFixed(1)}B/h`;
  if (usdPerHour >= 1e6) return `$${(usdPerHour / 1e6).toFixed(0)}M/h`;
  if (usdPerHour >= 1e3) return `$${(usdPerHour / 1e3).toFixed(0)}K/h`;
  return `$${usdPerHour.toFixed(0)}/h`;
}

/** Format an annualised USD value: "$3.7T/year", "$427B/year", etc. */
export function formatUsdPerYear(usdPerYear: number): string {
  if (usdPerYear >= 1e12) return `$${(usdPerYear / 1e12).toFixed(1)}T/year`;
  if (usdPerYear >= 1e9)  return `$${(usdPerYear / 1e9).toFixed(0)}B/year`;
  if (usdPerYear >= 1e6)  return `$${(usdPerYear / 1e6).toFixed(0)}M/year`;
  return `$${usdPerYear.toFixed(0)}/year`;
}

/** Format a per-region USD/h value: "$48.0M/h", "$3K/h", etc. */
export function formatRegionUsdPerHour(usdPerHour: number): string {
  if (usdPerHour >= 1e9) return `$${(usdPerHour / 1e9).toFixed(2)}B/h`;
  if (usdPerHour >= 1e6) return `$${(usdPerHour / 1e6).toFixed(1)}M/h`;
  if (usdPerHour >= 1e3) return `$${(usdPerHour / 1e3).toFixed(0)}K/h`;
  return `$${usdPerHour.toFixed(0)}/h`;
}
