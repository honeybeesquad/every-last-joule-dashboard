import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalWindRegion, buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "pakistan";
const SOURCE_URL = "https://nepra.org.pk/";

async function run({ probe = true } = {}): Promise<{ wind: RegionData; solar: RegionData }> {
  try {
    if (probe) {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
      throw new Error("NEPRA reports are PDF/monthly style and do not expose hourly curtailment data");
    }
    throw new Error("live probe skipped in tests");
  } catch (err) {
    const note = `NEPRA State of Industry Report 2024 anchor: Non-Project Missed Volume (NPMV) for wind generation = 1,337 GWh in FY2023-24, equivalent to PKR 39.5 billion in compensation paid to wind IPPs for transmission-constrained dispatch-down in the Sindh wind corridor (Jhimpir/Gharo/Thatta). Solar curtailment exists per IGCEP narratives but is not separately quantified by NEPRA — small share-fraction held conservatively. Source: https://nepra.org.pk/publications/State%20of%20Industry%20Reports/State%20of%20Industry%20Report%202024.pdf — Gemini-3.1 research wave 2 (2026-04-30).`;
    return {
      wind:  buildTypicalWindRegion("pakistan-wind",  15, 1.34 * 0.9, note + " — wind share (90%)", "2024"),
      solar: buildTypicalSolarRegion("pakistan-solar",  7, 1.34 * 0.1, note + " — solar share (10%)", "2024"),
    };
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback<{ wind: RegionData; solar: RegionData }>(REGION_ID, () => run(), {
    regionTier: "estimated" as const,
    tagLive: r => r,
    tagCached: c => c as { wind: RegionData; solar: RegionData },
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("pakistan loader failed", err); process.exit(1); });
}

export const buildPakistanData = () => run({ probe: false });
