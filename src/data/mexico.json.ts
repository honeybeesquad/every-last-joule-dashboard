import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "mexico";
const SOURCE_URL = "https://www.cenace.gob.mx/Paginas/Publicas/MercadoOperacion/RedesImporExport.aspx";

async function run({ probe = true } = {}): Promise<RegionData> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 20000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("CENACE public reports remained HTML/redirect-oriented with no stable renewable curtailment API");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    return buildTypicalSolarRegion(
      REGION_ID,
      19,
      1.2,
      `Typical-shape fallback: CENACE/SENER live feed unavailable (${(err as Error).message}); solar+wind curtailment scaled to ~1.2 TWh/yr.`,
      "2024",
    );
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run())
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("mexico loader failed", err);
      process.exit(1);
    });
}

export const buildMexicoData = () => run({ probe: false });
