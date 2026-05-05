import { buildEiaIsoRegion } from "../lib/eia-iso.js";

const loader = buildEiaIsoRegion({
  regionId: "pjm",
  respondent: "PJM",
  displayName: "PJM",
  windRate: 0.02,
  solarRate: 0.025,
});

export const parsePjm = loader.parse;

if (loader.isMain(import.meta.url)) {
  loader.runCli().catch((err) => {
    console.error("pjm loader failed", err);
    process.exit(1);
  });
}
