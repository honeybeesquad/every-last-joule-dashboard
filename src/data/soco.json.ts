import { buildEiaIsoRegionPerFuel } from "../lib/eia-iso.js";

const loader = buildEiaIsoRegionPerFuel({
  regionId: "soco",
  respondent: "SOCO",
  displayName: "Southern Company",
  windRate: 0.002,
  solarRate: 0.01,
  fallbackSplit: { wind: 0.1, solar: 0.9 },
});

export const parseSoco = loader.parsePerFuel;

if (loader.isMain(import.meta.url)) {
  loader.runCli().catch((err) => {
    console.error("soco loader failed", err);
    process.exit(1);
  });
}
