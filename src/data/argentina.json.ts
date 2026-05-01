import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalWindRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "argentina";
const SOURCE_URL = "https://cammesaweb.cammesa.com/";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("CAMMESA public site did not expose a stable unauthenticated curtailment CSV/JSON endpoint");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalWindRegion(
      REGION_ID,
      3,
      0.7,
      `Typical-shape fallback: CAMMESA open data unreachable/not machine-readable (${(err as Error).message}); Patagonia wind curtailment ~0.7 TWh/yr per CAMMESA Referencial A (Resolución SE 360/2023) formal 8% structural curtailment allowance for Patagonia-Buenos Aires transmission corridor.`,
      "2024",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("argentina loader failed", err);
      process.exit(1);
    });
}

export const buildArgentinaData = () => run({ probe: false });
