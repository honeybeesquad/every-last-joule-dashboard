import { buildEiaIsoRegionPerFuel } from "../lib/eia-iso.js";

const loader = buildEiaIsoRegionPerFuel({
  regionId: "miso",
  respondent: "MISO",
  displayName: "MISO",
  windRate: 0.08,
  solarRate: 0.04,
  fallbackSplit: { wind: 0.85, solar: 0.15 },
});

export const parseMiso = loader.parsePerFuel;

if (loader.isMain(import.meta.url)) {
  loader.runCli().catch((err) => {
    console.error("miso loader failed", err);
    process.exit(1);
  });
}
