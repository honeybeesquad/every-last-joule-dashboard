import { buildEiaIsoRegionPerFuel } from "../lib/eia-iso.js";

const loader = buildEiaIsoRegionPerFuel({
  regionId: "spp",
  respondent: "SWPP",
  displayName: "SPP",
  windRate: 0.04,
  solarRate: 0.03,
  fallbackSplit: { wind: 0.85, solar: 0.15 },
});

export const parseSpp = loader.parsePerFuel;

if (loader.isMain(import.meta.url)) {
  loader.runCli().catch((err) => {
    console.error("spp loader failed", err);
    process.exit(1);
  });
}
