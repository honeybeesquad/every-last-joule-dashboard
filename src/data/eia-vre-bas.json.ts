import { pathToFileURL } from "url";
import { mapWithConcurrency } from "../lib/concurrency.js";
import { buildEiaIsoRegionPerFuel, type EiaIsoConfig } from "../lib/eia-iso.js";
import { withFallback } from "../lib/resilient.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { RegionData } from "../lib/types.js";
import { unpublishedEmptyRegion } from "../lib/waste-status.js";

/**
 * Remaining EIA-930 balancing authorities with VRE generation and no
 * published BA curtailment rate. Generation is collected; waste is unpublished.
 * Replaces the typical-shape `florida` and `tva` stubs.
 */
export const EIA_VRE_BA_CONFIGS: ReadonlyArray<EiaIsoConfig & { displayName: string }> = [
  { regionId: "tva", respondent: "TVA", displayName: "Tennessee Valley Authority", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "fpl", respondent: "FPL", displayName: "Florida Power & Light", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "fpc", respondent: "FPC", displayName: "Duke Energy Florida", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "tec", respondent: "TEC", displayName: "Tampa Electric", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "nevp", respondent: "NEVP", displayName: "NV Energy", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "walc", respondent: "WALC", displayName: "WAPA Desert Southwest", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "swpw", respondent: "SWPW", displayName: "SPP West (former WACM)", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "duk", respondent: "DUK", displayName: "Duke Energy Carolinas", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "cple", respondent: "CPLE", displayName: "Duke Energy Progress East", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "cplw", respondent: "CPLW", displayName: "Duke Energy Progress West", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "lgee", respondent: "LGEE", displayName: "LG&E / KU", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "iid", respondent: "IID", displayName: "Imperial Irrigation District", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "banc", respondent: "BANC", displayName: "Balancing Authority of Northern California", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "ldwp", respondent: "LDWP", displayName: "Los Angeles DWP", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "pnm", respondent: "PNM", displayName: "Public Service New Mexico", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "epe", respondent: "EPE", displayName: "El Paso Electric", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "aeci", respondent: "AECI", displayName: "Associated Electric Cooperative", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "spa", respondent: "SPA", displayName: "Southwestern Power Administration", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
  { regionId: "sceg", respondent: "SCEG", displayName: "Dominion Energy South Carolina", windRate: 0, solarRate: 0, wasteMode: "unpublished" },
];

function stampEstimated(pair: { wind: RegionData; solar: RegionData }): { wind: RegionData; solar: RegionData } {
  return {
    wind: applyUncertainty(pair.wind, { regionTier: "estimated", profileKind: "wind" }),
    solar: applyUncertainty(pair.solar, { regionTier: "estimated", profileKind: "solar" }),
  };
}

async function fetchOne(config: EiaIsoConfig): Promise<{ wind: RegionData; solar: RegionData }> {
  try {
    const pair = await buildEiaIsoRegionPerFuel(config).run();
    return stampEstimated(pair);
  } catch (err) {
    const note = `EIA-930 ${config.respondent} generation fetch failed (${(err as Error).message}); waste unpublished.`;
    console.warn(`[eia-vre-bas] ${config.regionId}: ${note}`);
    return stampEstimated({
      wind: unpublishedEmptyRegion(`${config.regionId}-wind`, note),
      solar: unpublishedEmptyRegion(`${config.regionId}-solar`, note),
    });
  }
}

const run = async (): Promise<Record<string, RegionData>> => {
  const pairs = await mapWithConcurrency(EIA_VRE_BA_CONFIGS, 4, fetchOne);
  const out: Record<string, RegionData> = {};
  EIA_VRE_BA_CONFIGS.forEach((config, i) => {
    out[`${config.regionId}-wind`] = pairs[i].wind;
    out[`${config.regionId}-solar`] = pairs[i].solar;
  });
  return out;
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<Record<string, RegionData>>("eia-vre-bas", run, {
    regionTier: "estimated" as const,
    tagLive: (r) => r,
    tagCached: (c) => c as Record<string, RegionData>,
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("eia-vre-bas loader failed", err);
      process.exit(1);
    });
}

export const buildEiaVreBasData = run;
