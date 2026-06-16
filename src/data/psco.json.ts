import { buildEiaIsoRegionPerFuel } from "../lib/eia-iso.js";

const loader = buildEiaIsoRegionPerFuel({
  regionId: "psco",
  respondent: "PSCO",
  displayName: "Public Service Colorado",
  windRate: 0.03,
  solarRate: 0.02,
  fallbackSplit: { wind: 0.7, solar: 0.3 },
});

export const parsePsco = loader.parsePerFuel;

if (loader.isMain(import.meta.url)) {
  loader.runCli().catch((err) => {
    console.error("psco loader failed", err);
    process.exit(1);
  });
}
