import { buildEiaIsoRegionPerFuel } from "../lib/eia-iso.js";

const loader = buildEiaIsoRegionPerFuel({
  regionId: "pace",
  respondent: "PACE",
  displayName: "PacifiCorp East",
  windRate: 0.025,
  solarRate: 0.015,
  fallbackSplit: { wind: 0.8, solar: 0.2 },
});

export const parsePace = loader.parsePerFuel;

if (loader.isMain(import.meta.url)) {
  loader.runCli().catch((err) => {
    console.error("pace loader failed", err);
    process.exit(1);
  });
}
