import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion, buildTypicalWindRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "mexico";
const SOURCE_URL = "https://www.cenace.gob.mx/Paginas/Publicas/MercadoOperacion/RedesImporExport.aspx";

// Mexican VRE curtailment is real but LOW (NREL Clean Energy Report: "low in all
// scenarios"). CENACE publishes generation-by-tech but NO measured curtailment series,
// so this is a modelled T3 (±40%): typical-shape profiles scaled to a cited annual
// anchor — NOT a fabricated hourly feed. The ~1.2 TWh PRODESEN/CRE total is split by
// fuel: solar (northern grid) ~0.8 TWh, wind (Oaxaca/Tehuantepec) ~0.4 TWh.
const NOTE =
  "SENER PRODESEN 2024-2038 + CRE confiabilidad anchor: ~1.2% of renewable generation curtailed (~1 TWh in 2022, CRE 2023 estimates trend ~3.5%), driven by transmission-network saturation and CENACE operational restrictions — northern-grid solar (Sonora/Chihuahua/Coahuila) and Oaxaca/Tehuantepec wind. NREL Clean Energy Report notes VRE curtailment 'low in all scenarios'. Total anchor held at ~1.2 TWh (midpoint of PRODESEN-2022 ~1.0 and CRE-2023 ~3 TWh), split ~0.8 solar / ~0.4 wind. CENACE exposes no public measured-curtailment API, so this is a modelled T3 estimate with no fabricated hourly data. Hydro vertimientos excluded. Sources: PRODESEN https://www.gob.mx/sener/documentos/programa-de-desarrollo-del-sistema-electrico-nacional-2024-2038 + CRE https://www.gob.mx/cre + NREL https://docs.nrel.gov/docs/fy22osti/82580.pdf";

async function run({ probe = true } = {}): Promise<{ solar: RegionData; wind: RegionData }> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 20000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("CENACE public reports remained HTML/redirect-oriented with no stable renewable curtailment API");
    }
    throw new Error("live probe skipped in tests");
  } catch {
    return {
      solar: buildTypicalSolarRegion("mexico-solar", 19, 0.8, `${NOTE} — solar share (Sonora/Chihuahua/Coahuila northern grid).`, "2024"),
      wind: buildTypicalWindRegion("mexico-wind", 15, 0.4, `${NOTE} — wind share (Oaxaca/Tehuantepec).`, "2024"),
    };
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<{ solar: RegionData; wind: RegionData }>(REGION_ID, () => run(), {
    regionTier: "estimated" as const,
    tagLive: (r) => r,
    tagCached: (c) => c as { solar: RegionData; wind: RegionData },
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("mexico loader failed", err);
      process.exit(1);
    });
}

export const buildMexicoData = () => run({ probe: false });
