import { withFallback } from "../lib/resilient.js";
import type { RegionData } from "../lib/types.js";
import {
  fetchEntsoeZone,
  parseEntsoeXml as parseEntsoeXmlImpl,
  buildZoneData as buildZoneDataImpl,
} from "../lib/entsoe.js";
import { pathToFileURL } from "url";

export const ZONES = [
  { id: "germany", domain: "10Y1001A1001A82H", psrType: "B19", rate: 0.02,
    sourceNote: "ENTSO-E wind onshore × 2% calibrated curtailment rate (Germany 2024 redispatch book figures)" },
  { id: "iberia",  domain: "10YES-REE------0", psrType: "B16", rate: 0.02,
    sourceNote: "ENTSO-E solar × 2% calibrated curtailment rate (Iberia 2024)" },
  { id: "finland", domain: "10YFI-1--------U", psrType: "B19", rate: 0.05,
    sourceNote: "ENTSO-E wind onshore × 5% calibrated curtailment rate (Finland 2024 Nord Pool neg-price)" },
  { id: "france", domain: "10YFR-RTE------C", psrType: "B19", rate: 0.03,
    sourceNote: "ENTSO-E wind onshore × 3% calibrated curtailment rate (France 2024 redispatch)" },
  { id: "netherlands", domain: "10YNL----------L", psrType: "B16", rate: 0.04,
    sourceNote: "ENTSO-E solar × 4% calibrated curtailment rate (NL 2024 solar surge)" },
  { id: "denmark-west", domain: "10Y1001A1001A65H", psrType: "B19", rate: 0.04,
    sourceNote: "ENTSO-E wind onshore × 4% calibrated curtailment rate (DK-1 wind oversupply)" },
  { id: "poland", domain: "10YPL-AREA-----S", psrType: "B19", rate: 0.02,
    sourceNote: "ENTSO-E wind onshore × 2% calibrated curtailment rate (Poland PSE 2024)" },
  { id: "turkey", domain: "10YTR-TEIAS----W", psrType: "B19", rate: 0.02,
    sourceNote: "ENTSO-E wind onshore × 2% calibrated curtailment rate (Turkey TEİAŞ 2024)" },
  { id: "greece", domain: "10YGR-HTSO-----Y", psrType: "B16", rate: 0.025,
    sourceNote: "ENTSO-E solar × 2.5% calibrated curtailment rate (Greece HEDNO 2024)" },
  { id: "romania", domain: "10YRO-TEL------P", psrType: "B19", rate: 0.015,
    sourceNote: "ENTSO-E wind onshore × 1.5% calibrated curtailment rate (Romania Transelectrica 2024)" },
  { id: "italy-north", domain: "10YIT-GRTN-----B", psrType: "B16", rate: 0.02,
    sourceNote: "ENTSO-E solar × 2% calibrated curtailment rate (Italy Terna national aggregate 2024)" },
] as const;

export const parseEntsoeXml = parseEntsoeXmlImpl;
export const buildZoneData = buildZoneDataImpl;

const run = async (): Promise<Record<string, RegionData>> => {
  const results = await Promise.all(ZONES.map(fetchEntsoeZone));
  const out: Record<string, RegionData> = {};
  for (let i = 0; i < ZONES.length; i++) out[ZONES[i].id] = results[i];
  return out;
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<Record<string, RegionData>>("entsoe", run, {
    tagLive: (r) => {
      const tagged: Record<string, RegionData> = {};
      for (const [k, v] of Object.entries(r)) tagged[k] = { ...v, sourceStatus: "live" };
      return tagged;
    },
    tagCached: (c) => {
      const tagged: Record<string, RegionData> = {};
      for (const [k, v] of Object.entries(c)) tagged[k] = { ...v, sourceStatus: "cached" };
      return tagged;
    },
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("entsoe loader failed", err);
      process.exit(1);
    });
}
