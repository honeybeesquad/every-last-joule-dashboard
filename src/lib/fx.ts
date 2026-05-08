import { fetchJSON } from "./fetch.js";

/** Supported non-USD currencies for electricity price conversion. */
export type SupportedCurrency = "USD" | "EUR" | "AUD";

/**
 * Parse the ECB SDMX-JSON response and return the most recent exchange rate.
 * Rate is expressed as USD per 1 unit of the foreign currency
 * (e.g. EUR/USD = 1.08 means 1 EUR = 1.08 USD).
 */
export function parseEcbRate(response: unknown): number {
  if (response == null || typeof response !== "object") {
    throw new Error("ECB response is null or not an object");
  }
  const r = response as Record<string, unknown>;
  const dataSets = r.dataSets as Array<{
    series: Record<string, { observations: Record<string, number[]> }>;
  }>;
  if (!Array.isArray(dataSets) || dataSets.length === 0) {
    throw new Error("ECB response missing dataSets");
  }
  const series = dataSets[0]?.series;
  if (!series) throw new Error("ECB response missing series");
  const firstKey = Object.keys(series)[0];
  if (!firstKey) throw new Error("ECB response series is empty");
  const observations = series[firstKey]?.observations;
  if (!observations) throw new Error("ECB response missing observations");
  const keys = Object.keys(observations).map(Number).sort((a, b) => a - b);
  if (keys.length === 0) throw new Error("ECB response has no observations");
  const lastKey = String(keys[keys.length - 1]);
  const value = observations[lastKey]?.[0];
  if (value == null || !Number.isFinite(value)) {
    throw new Error(`ECB rate value is invalid: ${value}`);
  }
  return value;
}

/** Convert a value from a supported currency to USD. */
export function convertToUsd(
  value: number,
  currency: SupportedCurrency,
  rate: number,
): number {
  if (currency === "USD") return value;
  if (currency !== "EUR" && currency !== "AUD") {
    throw new Error(`Unsupported currency: ${currency}`);
  }
  return value * rate;
}

/**
 * Fetch current EUR→USD and AUD→USD rates from the ECB SDMX-JSON API.
 * Falls back to provided defaults if the API is unavailable.
 */
export async function fetchFxRates(
  fallback = { EUR: 1.08, AUD: 0.65 },
): Promise<{ EUR: number; AUD: number }> {
  const BASE = "https://data-api.ecb.europa.eu/service/data/EXR";

  async function fetchRate(series: string): Promise<number> {
    const url = `${BASE}/${series}?format=jsondata&lastNObservations=1`;
    const data = await fetchJSON(url, { timeoutMs: 10_000, retries: 2 });
    return parseEcbRate(data);
  }

  const [eurResult, audResult] = await Promise.allSettled([
    fetchRate("D.USD.EUR.SP00.A"),
    fetchRate("D.USD.AUD.SP00.A"),
  ]);

  return {
    EUR: eurResult.status === "fulfilled" ? eurResult.value : fallback.EUR,
    AUD: audResult.status === "fulfilled" ? audResult.value : fallback.AUD,
  };
}
