import { buildEiaIsoRegion } from "../lib/eia-iso.js";

const loader = buildEiaIsoRegion({
  regionId: "nyiso",
  respondent: "NYIS",
  displayName: "NYISO",
  windRate: 0.03,
  solarRate: 0.02,
});

export const parseNyiso = loader.parse;

if (loader.isMain(import.meta.url)) {
  loader.runCli().catch((err) => {
    console.error("nyiso loader failed", err);
    process.exit(1);
  });
}
