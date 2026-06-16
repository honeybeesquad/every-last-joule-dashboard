import { buildEiaIsoRegionPerFuel } from "../lib/eia-iso.js";

const loader = buildEiaIsoRegionPerFuel({
  regionId: "srp",
  respondent: "SRP",
  displayName: "Salt River Project",
  windRate: 0.005,
  solarRate: 0.015,
  fallbackSplit: { wind: 0.1, solar: 0.9 },
});

export const parseSrp = loader.parsePerFuel;

if (loader.isMain(import.meta.url)) {
  loader.runCli().catch((err) => {
    console.error("srp loader failed", err);
    process.exit(1);
  });
}
