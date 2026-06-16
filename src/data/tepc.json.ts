import { buildEiaIsoRegionPerFuel } from "../lib/eia-iso.js";

const loader = buildEiaIsoRegionPerFuel({
  regionId: "tepc",
  respondent: "TEPC",
  displayName: "Tucson Electric Power",
  windRate: 0.005,
  solarRate: 0.015,
  fallbackSplit: { wind: 0.1, solar: 0.9 },
});

export const parseTepc = loader.parsePerFuel;

if (loader.isMain(import.meta.url)) {
  loader.runCli().catch((err) => {
    console.error("tepc loader failed", err);
    process.exit(1);
  });
}
