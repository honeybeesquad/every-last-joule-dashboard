import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "oman";
const SOURCE_URL = "https://www.omanpwp.om/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("OPWP/Nama public pages do not expose hourly curtailment");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalSolarRegion(
      REGION_ID,
      4,
      0.1,
      `Typical-shape fallback: Oman live feed unavailable (${(err as Error).message}); calibration anchor ~0.1 TWh/yr solar curtailment — Nama PWP (formerly OPWP) 7-Year Statement 2024-2030 (Table 14 "Renewable Energy Spillage") confirms negligible (~0 GWh) actual curtailment 2022-2024 (Ibri II 500 MW and Dhofar Wind 50 MW fully absorbed); 114 GWh projected for 2025 when Manah I/II 1,000 MW comes online; 245 GWh projected 2026. Anchor held at 0.1 TWh as transitional forward estimate. UTC+4 Arabia Standard Time. T3-modelled, ±40% envelope. Gemini-3.1 research wave 5 (2026-04-30).`,
      "2024",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("oman loader failed", err); process.exit(1); });
}

export const buildOmanData = () => run({ probe: false });
