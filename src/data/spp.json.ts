import { buildEiaIsoRegion } from "../lib/eia-iso.js";

const loader = buildEiaIsoRegion({
  regionId: "spp",
  respondent: "SWPP",
  displayName: "SPP",
  windRate: 0.04,
  solarRate: 0.03,
});

export const parseSpp = loader.parse;

if (loader.isMain(import.meta.url)) {
  loader.runCli().catch((err) => {
    console.error("spp loader failed", err);
    process.exit(1);
  });
}
