import { fetchJSON } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import type { CBECIData } from "../lib/types.js";

/**
 * Network-reference loader.
 *
 * Intended source: Cambridge CBECI (https://ccaf.io/cbnsi/cbeci). CBECI's
 * public API endpoints are gated behind a recaptcha token - useful for their
 * interactive dashboard, but not usable from a server-side data loader running
 * in GitHub Actions. Documented in docs/data-source-log.md.
 *
 * Substitute source (v0): mempool.space's mining stats endpoint, which
 * publishes a 24-hour-average hashrate and is freely queryable. Annualised
 * consumption is derived at 16 J/TH fleet efficiency (CBECI's implied fleet
 * average, and our dashboard's primary ASIC reference).
 */

const ENDPOINT = "https://mempool.space/api/v1/mining/hashrate/24h";
const ASIC_JPER_TH = 16;

interface MempoolHashrateResponse {
  currentHashrate: number;   // hashes per second
  currentDifficulty: number;
  hashrates?: Array<{ timestamp: number; avgHashrate: number }>;
  difficulty?: unknown[];
}

export function parseHashrate(raw: MempoolHashrateResponse): CBECIData {
  const hashesPerSecond = raw.currentHashrate;
  const hashrateEHps = hashesPerSecond / 1e18;

  // Annualised consumption at 16 J/TH:
  //   power_W      = hashrate_TH/s * eff_J/TH
  //   energy_TWh/y = power_W * 8760 h / 1e12
  //   equivalently: TWh/y = hashrate_EH/s * 1e6 * eff_J/TH * 8760 / 1e12
  const hashrateTHps = hashrateEHps * 1e6;
  const powerW = hashrateTHps * ASIC_JPER_TH;
  const annualisedConsumptionTWh = (powerW * 8760) / 1e12;

  // Mempool returns no explicit timestamp for currentHashrate; use now.
  const lastUpdated = new Date().toISOString();

  return { hashrateEHps, annualisedConsumptionTWh, lastUpdated };
}

const run = async (): Promise<CBECIData> => {
  const raw = await fetchJSON<MempoolHashrateResponse>(ENDPOINT);
  return parseHashrate(raw);
};

withFallback<CBECIData>("cbeci", run, {
  tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
  tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
})
  .then((data) => {
    process.stdout.write(JSON.stringify(data));
  })
  .catch((err) => {
    console.error("cbeci loader failed", err);
    process.exit(1);
  });
