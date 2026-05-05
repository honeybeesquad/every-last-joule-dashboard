import { buildEiaIsoRegionPerFuel } from "../lib/eia-iso.js";

const loader = buildEiaIsoRegionPerFuel({
  regionId: "iso-ne-rest",
  respondent: "ISNE",
  displayName: "ISO-NE",
  windRate: 0.03,
  solarRate: 0.02,
});

export const parseIsoNeRestPerFuel = loader.parsePerFuel;

if (loader.isMain(import.meta.url)) {
  loader.runCli().catch((err) => {
    console.error("iso-ne-rest loader failed", err);
    process.exit(1);
  });
}
