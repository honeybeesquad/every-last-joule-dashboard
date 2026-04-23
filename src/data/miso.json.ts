import { buildEiaIsoRegion } from "../lib/eia-iso.js";

const loader = buildEiaIsoRegion({
  regionId: "miso",
  respondent: "MISO",
  displayName: "MISO",
  windRate: 0.08,
  solarRate: 0.04,
});

export const parseMiso = loader.parse;

if (loader.isMain(import.meta.url)) {
  loader.runCli().catch((err) => {
    console.error("miso loader failed", err);
    process.exit(1);
  });
}
