import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "saudi-solar";
const SOURCE_URL = "https://www.se.com.sa/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("SEC/ECRA public pages do not expose hourly solar curtailment");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalSolarRegion(
      REGION_ID,
      9,
      0.8,
      "GASTAT (General Authority for Statistics) Renewable Energy Statistics Publication 2024 (published 2025): Saudi Arabia recorded 5.2% renewable curtailment rate in 2024, ~0.8 TWh, attributed to grid constraints and rapid scale-up of utility-scale solar (Sudair, Sakaka, NEOM Helios) outpacing transmission expansion. T3-modelled, ±40% envelope. Source: https://www.stats.gov.sa/ — Gemini-3.1 research wave 4 (2026-04-30, reliability 5/5). Expected to fluctuate as Vision 2030 BESS + transmission upgrades land.",
      "2024",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("saudi-solar loader failed", err); process.exit(1); });
}

export const buildSaudiSolarData = () => run({ probe: false });
