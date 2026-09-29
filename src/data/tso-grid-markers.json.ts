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
  // 2026-09-29: statics anchors at or above the country's recorded generation of
  // their fuel (scripts/lib/statics-anchor-check.ts). Waste figures dropped.
  { id: "venezuela", note: "No curtailment series collected; grid present, waste unpublished. Its former 0.5 TWh/yr anchor (IRENA RE Statistics 2024) was 25× Venezuela's 2024 wind generation of 0.02 TWh (Our World in Data, from Ember and the Energy Institute), so it was dropped on 2026-09-29.", profileKind: "wind" },
  { id: "libya", note: "No curtailment series collected; grid present, waste unpublished. Its former 0.2 TWh/yr anchor (IRENA RCS 2025 / GECOL) was 20× Libya's 2024 solar generation of 0.01 TWh (Our World in Data, from Ember and the Energy Institute), so it was dropped on 2026-09-29.", profileKind: "solar" },
  { id: "colombia-wind", note: "No curtailment series collected; grid present, waste unpublished. Its former 1.5 TWh/yr anchor (an IRENA-capacity × Ember-share split of XM's system-wide spill) was 10× Colombia's 2024 wind generation of 0.15 TWh (Our World in Data, from Ember and the Energy Institute), so it was dropped on 2026-09-29. XM's measured system-wide spill stays on the Colombia region.", profileKind: "wind" },
  { id: "botswana", note: "No curtailment series collected; grid present, waste unpublished. Its former 0.05 TWh/yr anchor (IRENA Botswana 2024, held at a 0.05 TWh/yr coverage floor) was 5× Botswana's 2024 solar generation of 0.01 TWh (Our World in Data, from Ember and the Energy Institute), so it was dropped on 2026-09-29.", profileKind: "solar" },
  { id: "cote-divoire", note: "No curtailment series collected; grid present, waste unpublished. Its former 0.1 TWh/yr anchor (IRENA Cote d'Ivoire 2024) was 5× Côte d'Ivoire's 2024 solar generation of 0.02 TWh (Our World in Data, from Ember and the Energy Institute), so it was dropped on 2026-09-29.", profileKind: "solar" },
  { id: "south-sudan", note: "No curtailment series collected; grid present, waste unpublished. Its former 0.05 TWh/yr anchor (IRENA RCS 2025 / MEM South Sudan) was 5× South Sudan's 2024 solar generation of 0.01 TWh (Our World in Data, from Ember and the Energy Institute), so it was dropped on 2026-09-29.", profileKind: "solar" },
  { id: "nigeria", note: "No curtailment series collected; grid present, waste unpublished. Its former 0.5 TWh/yr anchor (Ember Nigeria 2024 + TCN Grid Stability Report 2024) was 3.8× Nigeria's 2024 solar generation of 0.13 TWh (Our World in Data, from Ember and the Energy Institute), so it was dropped on 2026-09-29.", profileKind: "solar" },
  { id: "nicaragua", note: "No curtailment series collected; grid present, waste unpublished. Its former 0.1 TWh/yr anchor (IRENA Nicaragua VRE statistics 2024) was 3.3× Nicaragua's 2024 solar generation of 0.03 TWh (Our World in Data, from Ember and the Energy Institute), so it was dropped on 2026-09-29.", profileKind: "solar" },
  { id: "laos", note: "No curtailment series collected; grid present, waste unpublished. Its former 0.2 TWh/yr anchor (IRENA RE Statistics 2024) was 2.2× Laos's 2024 solar generation of 0.09 TWh (Our World in Data, from Ember and the Energy Institute), so it was dropped on 2026-09-29.", profileKind: "solar" },
  { id: "guatemala", note: "No curtailment series collected; grid present, waste unpublished. Its former 0.4 TWh/yr anchor (IRENA Renewable Energy Statistics 2024) and guatemala-siepac's 0.1 together came to 1.8× Guatemala's 2024 solar generation of 0.28 TWh (Our World in Data, from Ember and the Energy Institute), so both were dropped on 2026-09-29.", profileKind: "solar" },
  { id: "guatemala-siepac", note: "No curtailment series collected; grid present, waste unpublished. Its former 0.1 TWh/yr anchor (IRENA Central America Interconnect 2024) and guatemala's 0.4 together came to 1.8× Guatemala's 2024 solar generation of 0.28 TWh (Our World in Data, from Ember and the Energy Institute), so both were dropped on 2026-09-29.", profileKind: "solar" },
  { id: "eswatini", note: "No curtailment series collected; grid present, waste unpublished. Its former 0.05 TWh/yr anchor (IRENA Eswatini 2024) was 1.7× Eswatini's 2024 solar generation of 0.03 TWh (Our World in Data, from Ember and the Energy Institute), so it was dropped on 2026-09-29.", profileKind: "solar" },
  { id: "myanmar", note: "No curtailment series collected; grid present, waste unpublished. Its former 0.2 TWh/yr anchor (IRENA RE Statistics 2024) was 1.7× Myanmar's 2024 solar generation of 0.12 TWh (Our World in Data, from Ember and the Energy Institute), so it was dropped on 2026-09-29.", profileKind: "solar" },
  { id: "niger", note: "No curtailment series collected; grid present, waste unpublished. Its former 0.05 TWh/yr anchor (IRENA RCS 2025 / NIGELEC) was 1.7× Niger's 2024 solar generation of 0.03 TWh (Our World in Data, from Ember and the Energy Institute), so it was dropped on 2026-09-29.", profileKind: "solar" },
  { id: "benin", note: "No curtailment series collected; grid present, waste unpublished. Its former 0.05 TWh/yr anchor (IRENA Benin 2024) was 1.2× Benin's 2024 solar generation of 0.04 TWh (Our World in Data, from Ember and the Energy Institute), so it was dropped on 2026-09-29.", profileKind: "solar" },
  { id: "sudan", note: "No curtailment series collected; grid present, waste unpublished. Its former 0.2 TWh/yr anchor (IRENA RE Statistics 2024) was 1.2× Sudan's 2024 solar generation of 0.16 TWh (Our World in Data, from Ember and the Energy Institute), so it was dropped on 2026-09-29.", profileKind: "solar" },
  { id: "ghana", note: "No curtailment series collected; grid present, waste unpublished. Its former 0.2 TWh/yr anchor (Ember Ghana 2024) was 1.2× Ghana's 2024 solar generation of 0.17 TWh (Our World in Data, from Ember and the Energy Institute), so it was dropped on 2026-09-29.", profileKind: "solar" },
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
