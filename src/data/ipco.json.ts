import { buildEiaIsoRegionPerFuel } from "../lib/eia-iso.js";

const loader = buildEiaIsoRegionPerFuel({
  regionId: "ipco",
  respondent: "IPCO",
  displayName: "Idaho Power",
  windRate: 0.015,
  solarRate: 0.02,
  fallbackSplit: { wind: 0.4, solar: 0.6 },
});

export const parseIpco = loader.parsePerFuel;

if (loader.isMain(import.meta.url)) {
  loader.runCli().catch((err) => {
    console.error("ipco loader failed", err);
    process.exit(1);
  });
}
