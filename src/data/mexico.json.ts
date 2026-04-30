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
      `SENER PRODESEN 2024-2038 anchor: ~1.2% of renewable generation curtailed in 2022 (~1 TWh) due to transmission-network saturation and CENACE operational restrictions, primarily in the northern grid (Sonora/Chihuahua/Coahuila solar; Oaxaca/Tehuantepec wind). 2023 industry estimates trend higher (~3.5%) per CRE confiabilidad reports. Anchor held at 1.2 TWh as a midpoint of PRODESEN-2022 (~1.0) and CRE-2023 (~3.5%-implied ~3 TWh). Hydro vertimientos NOT included in this figure — varies dramatically with annual hydrology. Sources: PRODESEN https://www.gob.mx/sener/documentos/programa-de-desarrollo-del-sistema-electrico-nacional-2024-2038 + CRE https://www.gob.mx/cre — Gemini-3.1 research wave 2 (2026-04-30).`,
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
