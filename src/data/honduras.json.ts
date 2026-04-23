import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "honduras";
const SOURCE_URL = "https://ods.org.hn/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      // ODS publishes quarterly "energía vertida" tables in PDF but not a stable hourly feed — stay on fallback.
      throw new Error("ODS published 201.87 GWh curtailed in 2023 but exposes only PDF quarterly reports, not hourly data");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalSolarRegion(
      REGION_ID,
      18,
      0.2,
      `Typical-shape fallback: ODS live feed unavailable (${(err as Error).message}); Honduras solar+wind curtailment calibrated to ODS-reported 201.87 GWh for 2023 (~0.2 TWh/yr).`,
      "2023",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("honduras loader failed", err);
      process.exit(1);
    });
}

export const buildHondurasData = () => run({ probe: false });
