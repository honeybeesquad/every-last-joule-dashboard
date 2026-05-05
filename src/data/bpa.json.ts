import { buildEiaIsoRegion } from "../lib/eia-iso.js";

const loader = buildEiaIsoRegion({
  regionId: "bpa",
  respondent: "BPAT",
  displayName: "BPA",
  windRate: 0.06,
  solarRate: 0.02,
});

export const parseBpa = loader.parse;

if (loader.isMain(import.meta.url)) {
  loader.runCli().catch((err) => {
    console.error("bpa loader failed", err);
    process.exit(1);
  });
}
