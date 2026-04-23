import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";
import { pathToFileURL } from "url";

const ATACAMA_ANNUAL_TWH = 5.9;
const ATACAMA_SOLAR_NOON_UTC = 16.5;

const run = async (): Promise<RegionData> =>
  buildTypicalSolarRegion(
    "atacama",
    ATACAMA_SOLAR_NOON_UTC,
    ATACAMA_ANNUAL_TWH,
    "Typical-shape solar fallback via solarProfile(16.5, 5.9) after Chile Cloudflare challenge blocked dependable machine access in B2.",
    "2024",
  );

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>("atacama-chile", run, {
    tagLive: (result) => ({ ...result, sourceStatus: "live" as const }),
    tagCached: (cached) => ({ ...cached, sourceStatus: "cached" as const }),
  })
    .then((data) => {
      process.stdout.write(JSON.stringify(data));
    })
    .catch((err) => {
      console.error("atacama-chile loader failed", err);
      process.exit(1);
    });
}
