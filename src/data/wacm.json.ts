import { buildEiaIsoRegionPerFuel } from "../lib/eia-iso.js";

const loader = buildEiaIsoRegionPerFuel({
  regionId: "wacm",
  respondent: "WACM",
  displayName: "WAPA Rocky Mountain",
  windRate: 0.025,
  solarRate: 0.015,
  fallbackSplit: { wind: 0.7, solar: 0.3 },
});

export const parseWacm = loader.parsePerFuel;

if (loader.isMain(import.meta.url)) {
  loader.runCli().catch((err) => {
    console.error("wacm loader failed", err);
    process.exit(1);
  });
}
