import { buildEiaIsoRegionPerFuel } from "../lib/eia-iso.js";

const loader = buildEiaIsoRegionPerFuel({
  regionId: "pjm",
  respondent: "PJM",
  displayName: "PJM",
  windRate: 0.02,
  solarRate: 0.025,
});

export const parsePjm = loader.parsePerFuel;

if (loader.isMain(import.meta.url)) {
  loader.runCli().catch((err) => {
    console.error("pjm loader failed", err);
    process.exit(1);
  });
}
