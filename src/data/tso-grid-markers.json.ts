import { pathToFileURL } from "url";
import { withFallback } from "../lib/resilient.js";
import { applyUncertainty, type TierInputs } from "../lib/uncertainty.js";
import type { RegionData } from "../lib/types.js";
import { unpublishedEmptyRegion } from "../lib/waste-status.js";

type ProfileKind = NonNullable<TierInputs["profileKind"]>;

/**
 * Control areas with no public operational series (or a human-gated portal).
 * Visible as unpublished grid markers; not TSO-collected generation.
 */
export const TSO_GRID_MARKERS: ReadonlyArray<{
  id: string;
  note: string;
  profileKind: ProfileKind;
}> = [
  { id: "kauai", note: "KIUC Kauai: annual PDF only; no hourly TSO series. Grid present, ops unpublished.", profileKind: "solar" },
  { id: "alaska-railbelt", note: "Alaska Railbelt (Chugach/MEA/GVEA/HEA): no public hourly series. Grid present, ops unpublished.", profileKind: "mixed" },
  { id: "puerto-rico-wind", note: "PREPA/LUMA. EIA-930 has no PR BA (83 respondents 2026-09-20; PREP/LUMA/CEPR total=0). LUMA BPS daily PDFs exclude solar/wind from Available Supply. Mi LUMA JSON is outages. Waste unpublished.", profileKind: "wind" },
  { id: "puerto-rico-solar", note: "PREPA/LUMA. EIA-930 has no PR BA (83 respondents 2026-09-20; PREP/LUMA/CEPR total=0). LUMA BPS daily PDFs exclude solar/wind from Available Supply. Mi LUMA JSON is outages. Waste unpublished.", profileKind: "solar" },
  { id: "guam", note: "GPA Guam: annual reports only. Grid present, ops unpublished.", profileKind: "solar" },
  { id: "us-virgin-islands", note: "USVI WAPA: annual reports only. Grid present, ops unpublished.", profileKind: "solar" },
  { id: "american-samoa", note: "ASPA: annual reports only. Grid present, ops unpublished.", profileKind: "solar" },
  { id: "northern-mariana-islands", note: "CNMI CUC: annual reports only. Grid present, ops unpublished.", profileKind: "solar" },
  { id: "new-brunswick", note: "NB Power: no hourly TSO series wired. Grid present, ops unpublished.", profileKind: "mixed" },
  { id: "nova-scotia", note: "NS Power: no hourly TSO series wired. Grid present, ops unpublished.", profileKind: "wind" },
  { id: "prince-edward-island", note: "Maritime Electric: no hourly TSO series wired. Grid present, ops unpublished.", profileKind: "wind" },
  { id: "newfoundland-labrador", note: "NL Hydro: no hourly TSO series wired. Grid present, ops unpublished.", profileKind: "hydro-seasonal" },
  { id: "yukon", note: "Yukon Energy: isolated diesel/hydro. Grid present, VRE waste unpublished.", profileKind: "hydro-seasonal" },
  { id: "northwest-territories", note: "NTPC: isolated diesel/hydro. Grid present, VRE waste unpublished.", profileKind: "hydro-seasonal" },
  { id: "nunavut", note: "Qulliq Energy: isolated diesel. Grid present, VRE waste unpublished.", profileKind: "mixed" },
  { id: "greenland", note: "Nukissiorfiit: isolated hydro/diesel. Grid present, ops unpublished.", profileKind: "hydro-seasonal" },
  { id: "hong-kong-clp", note: "CLP Hong Kong: Cloudflare/no hourly. Grid present, waste unpublished.", profileKind: "solar" },
  { id: "hong-kong-hke", note: "HK Electric: Cloudflare/no hourly. Grid present, waste unpublished.", profileKind: "solar" },
  { id: "macau", note: "CEM Macau: no hourly series. Grid present, waste unpublished.", profileKind: "solar" },
  { id: "malaysia-sarawak", note: "Sarawak Energy: separate from Peninsular GSO. No time series wired. Waste unpublished.", profileKind: "hydro-seasonal" },
  { id: "malaysia-sabah", note: "SESB Sabah: separate from Peninsular GSO. No time series wired. Waste unpublished.", profileKind: "solar" },
  { id: "reunion", note: "EDF SEI Réunion: no hourly series wired. Grid present, waste unpublished.", profileKind: "solar" },
  { id: "martinique", note: "EDF SEI Martinique: no hourly series wired. Grid present, waste unpublished.", profileKind: "solar" },
  { id: "guadeloupe", note: "EDF SEI Guadeloupe: no hourly series wired. Grid present, waste unpublished.", profileKind: "solar" },
  { id: "new-caledonia", note: "Enercal: no hourly series wired. Grid present, waste unpublished.", profileKind: "solar" },
  { id: "french-polynesia", note: "EDT: no hourly series wired. Grid present, waste unpublished.", profileKind: "solar" },
  { id: "wallis-and-futuna", note: "EEWF: no hourly series wired. Grid present, waste unpublished.", profileKind: "solar" },
];

function run(): Record<string, RegionData> {
  const out: Record<string, RegionData> = {};
  for (const marker of TSO_GRID_MARKERS) {
    out[marker.id] = applyUncertainty(
      unpublishedEmptyRegion(marker.id, marker.note),
      { regionTier: "estimated", profileKind: marker.profileKind },
    );
  }
  return out;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<Record<string, RegionData>>("tso-grid-markers", async () => run(), {
    regionTier: "estimated" as const,
    tagLive: (r) => r,
    tagCached: (c) => c as Record<string, RegionData>,
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("tso-grid-markers loader failed", err);
      process.exit(1);
    });
}

export const buildTsoGridMarkers = run;
