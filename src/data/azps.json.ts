import { buildEiaIsoRegionPerFuel } from "../lib/eia-iso.js";

const loader = buildEiaIsoRegionPerFuel({
  regionId: "azps",
  respondent: "AZPS",
  displayName: "Arizona Public Service",
  windRate: 0.01,
  solarRate: 0.02,
  fallbackSplit: { wind: 0.1, solar: 0.9 },
});

export const parseAzps = loader.parsePerFuel;

if (loader.isMain(import.meta.url)) {
  loader.runCli().catch((err) => {
    console.error("azps loader failed", err);
    process.exit(1);
  });
}
