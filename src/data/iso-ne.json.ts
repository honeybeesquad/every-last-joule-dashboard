import { buildEiaIsoRegion } from "../lib/eia-iso.js";

const loader = buildEiaIsoRegion({
  regionId: "iso-ne",
  respondent: "ISNE",
  displayName: "ISO-NE",
  windRate: 0.03,
  solarRate: 0.02,
});

export const parseIsoNe = loader.parse;

if (loader.isMain(import.meta.url)) {
  loader.runCli().catch((err) => {
    console.error("iso-ne loader failed", err);
    process.exit(1);
  });
}
