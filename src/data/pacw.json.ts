import { buildEiaIsoRegionPerFuel } from "../lib/eia-iso.js";

const loader = buildEiaIsoRegionPerFuel({
  regionId: "pacw",
  respondent: "PACW",
  displayName: "PacifiCorp West",
  windRate: 0.02,
  solarRate: 0.015,
  fallbackSplit: { wind: 0.7, solar: 0.3 },
});

export const parsePacw = loader.parsePerFuel;

if (loader.isMain(import.meta.url)) {
  loader.runCli().catch((err) => {
    console.error("pacw loader failed", err);
    process.exit(1);
  });
}
