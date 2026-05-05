import { buildEiaIsoRegionPerFuel } from "../lib/eia-iso.js";

const loader = buildEiaIsoRegionPerFuel({
  regionId: "bpa",
  respondent: "BPAT",
  displayName: "BPA",
  windRate: 0.06,
  solarRate: 0.02,
  fallbackSplit: { wind: 0.95, solar: 0.05 },
});

export const parseBpa = loader.parsePerFuel;

if (loader.isMain(import.meta.url)) {
  loader.runCli().catch((err) => {
    console.error("bpa loader failed", err);
    process.exit(1);
  });
}
