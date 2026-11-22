import { buildEiaIsoRegionPerFuel } from "../lib/eia-iso.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData } from "../lib/types.js";
import { attachEiaGeneration, fetchSppVerCurtailments } from "./spp.json.js";

/**
 * SPP RTO West (`swpw-wind` / `swpw-solar`). SPP took over the former WACM
 * balancing authority on 2026-04-01 as SWPW. SPP's VER Curtailments report
 * carries SWPW as its own BAA, with the same measured 5-minute columns as the
 * SPP BA, so the curtailment here is measured the same way as `spp-*` (see
 * parseSppVerCurtailments). Generation is EIA-930 respondent SWPW, the same BA.
 *
 * When the report cannot be read (portal.spp.org drops traffic from some
 * networks), run throws, so withFallback serves the last measured snapshot,
 * stamped cached. A generation-only record is never served under the live
 * tier, and a failed fetch never overwrites the measured snapshot.
 */
const eia = buildEiaIsoRegionPerFuel({
  regionId: "swpw",
  respondent: "SWPW",
  displayName: "SPP West (former WACM)",
  windRate: 0,
  solarRate: 0,
  wasteMode: "unpublished",
});

const run = async (): Promise<{ wind: RegionData; solar: RegionData }> => {
  const [measured, gen] = await Promise.allSettled([fetchSppVerCurtailments("SWPW"), eia.run()]);
  const genPair = gen.status === "fulfilled" ? gen.value : null;
  if (gen.status === "rejected") {
    console.warn(`SWPW EIA-930 generation unavailable: ${(gen.reason as Error).message}`);
  }
  if (measured.status === "rejected") {
    throw new Error(`SWPW measured curtailment unavailable: ${(measured.reason as Error).message}`);
  }
  return attachEiaGeneration(measured.value, genPair);
};

if (eia.isMain(import.meta.url)) {
  withFallback<{ wind: RegionData; solar: RegionData }>("swpw", run, {
    regionTier: "live" as const,
    tagLive: (r) => r,
    tagCached: (c) => c as { wind: RegionData; solar: RegionData },
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("swpw loader failed", err);
      process.exit(1);
    });
}
