import { buildEiaIsoRegionPerFuel } from "../lib/eia-iso.js";

const loader = buildEiaIsoRegionPerFuel({
  regionId: "nyiso-rest",
  respondent: "NYIS",
  displayName: "NYISO",
  windRate: 0.03,
  solarRate: 0.02,
  fallbackSplit: { wind: 0.7, solar: 0.3 },
});

export const parseNyisoRestPerFuel = loader.parsePerFuel;

if (loader.isMain(import.meta.url)) {
  loader.runCli().catch((err) => {
    console.error("nyiso-rest loader failed", err);
    process.exit(1);
  });
}
