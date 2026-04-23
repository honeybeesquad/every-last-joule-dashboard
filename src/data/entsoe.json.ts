import { withFallback } from "../lib/resilient.js";
import type { RegionData } from "../lib/types.js";
import {
  fetchEntsoeZone,
  parseEntsoeXml as parseEntsoeXmlImpl,
  buildZoneData as buildZoneDataImpl,
} from "../lib/entsoe.js";
import { pathToFileURL } from "url";

export const ZONES = [
  {
    id: "germany",
    domain: "10Y1001A1001A82H",
    technologies: [
      { psrType: "B19", fuel: "wind", rate: 0.08 },
      { psrType: "B16", fuel: "solar", rate: 0.023 },
    ],
    sourceNote: "Germany 2024 calibrated to BNetzA Monitoringbericht 2025 preliminary: 7.95 TWh wind + 1.39 TWh solar = 9.34 TWh/yr total.",
  },
  {
    id: "iberia",
    domain: "10YES-REE------0",
    technologies: [
      { psrType: "B16", fuel: "solar", rate: 0.055 },
      { psrType: "B19", fuel: "wind", rate: 0.11 },
    ],
    sourceNote: "Spain 2024 calibrated to REE Informe del Sistema Eléctrico 2024: 6.8 TWh wind + 2.4 TWh PV + 1.4 TWh CSP = ~10.6 TWh/yr total.",
  },
  {
    id: "portugal",
    domain: "10YPT-REN------W",
    technologies: [
      { psrType: "B16", fuel: "solar", rate: 0.10 },
      { psrType: "B19", fuel: "wind", rate: 0.03 },
    ],
    sourceNote: "Portugal 2024 calibration: solar primary plus ~0.1 TWh/yr wind.",
  },
  {
    id: "finland",
    domain: "10YFI-1--------U",
    technologies: [{ psrType: "B19", fuel: "wind", rate: 0.05 }],
    sourceNote: "Finland wind-only calibration; solar negligible at Finnish latitude.",
  },
  {
    id: "netherlands",
    domain: "10YNL----------L",
    technologies: [
      { psrType: "B18", fuel: "wind", rate: 0.09 },
      { psrType: "B19", fuel: "wind", rate: 0.045 },
      { psrType: "B16", fuel: "solar", rate: 0.045 },
    ],
    sourceNote: "Netherlands calibrated to TenneT / CBS 2024: curtailment tripled to >3 TWh (offshore B18 dominant, onshore B19 + rising solar B16).",
  },
  {
    id: "poland",
    domain: "10YPL-AREA-----S",
    technologies: [
      { psrType: "B19", fuel: "wind", rate: 0.02 },
      { psrType: "B16", fuel: "solar", rate: 0.015 },
    ],
    sourceNote: "Poland PSE 2024 calibration with growing solar contribution.",
  },
  {
    id: "greece",
    domain: "10YGR-HTSO-----Y",
    technologies: [
      { psrType: "B16", fuel: "solar", rate: 0.025 },
      { psrType: "B19", fuel: "wind", rate: 0.015 },
    ],
    sourceNote: "Greece HEDNO 2024 mixed wind+solar calibration.",
  },
  {
    id: "romania",
    domain: "10YRO-TEL------P",
    technologies: [
      { psrType: "B16", fuel: "solar", rate: 0.04 },
      { psrType: "B19", fuel: "wind", rate: 0.025 },
    ],
    sourceNote: "Romania Transelectrica 2024 calibration; solar fixed in v1.f plus wind added.",
  },
  {
    id: "italy-north",
    domain: "10YIT-GRTN-----B",
    technologies: [
      { psrType: "B16", fuel: "solar", rate: 0.007 },
      { psrType: "B19", fuel: "wind", rate: 0.0035 },
    ],
    sourceNote: "Italy North calibrated to Terna Rapporto Mensile 2024: total national wind+solar only 0.31 TWh/yr (most curtailment is South/Islands, not Italy North).",
  },
  {
    id: "sweden-north",
    domain: "10Y1001A1001A46L",
    technologies: [{ psrType: "B19", fuel: "wind", rate: 0.01 }],
    sourceNote: "ENTSO-E SE2 wind-only calibration; solar negligible in SE2.",
  },
  {
    id: "sweden-south",
    domain: "10Y1001A1001A47J",
    technologies: [
      { psrType: "B16", fuel: "solar", rate: 0.07 },
      { psrType: "B19", fuel: "wind", rate: 0.02 },
    ],
    sourceNote: "ENTSO-E SE4 mixed calibration with PV and some wind.",
  },
  {
    id: "ukraine",
    domain: "10Y1001C--00003F",
    technologies: [
      { psrType: "B19", fuel: "wind", rate: 0.03 },
      { psrType: "B16", fuel: "solar", rate: 0.02 },
    ],
    sourceNote: "Ukrenergo post-synchronisation mixed wind+solar calibration.",
  },
  {
    id: "hungary",
    domain: "10YHU-MAVIR----U",
    technologies: [
      { psrType: "B16", fuel: "solar", rate: 0.03 },
      { psrType: "B19", fuel: "wind", rate: 0.01 },
    ],
    sourceNote: "MAVIR 2024 calibration: solar dominant, small wind.",
  },
  {
    id: "czech-republic",
    domain: "10YCZ-CEPS-----N",
    technologies: [
      { psrType: "B16", fuel: "solar", rate: 0.02 },
      { psrType: "B19", fuel: "wind", rate: 0.01 },
    ],
    sourceNote: "CEPS 2024 calibration: solar dominant, wind secondary.",
  },
  {
    id: "bulgaria",
    domain: "10YCA-BULGARIA-R",
    technologies: [
      { psrType: "B16", fuel: "solar", rate: 0.02 },
      { psrType: "B19", fuel: "wind", rate: 0.015 },
    ],
    sourceNote: "ESO Bulgaria 2024 mixed wind+solar calibration.",
  },
  {
    id: "baltics",
    domain: "10YLT-1001A0008Q",
    technologies: [{ psrType: "B19", fuel: "wind", rate: 0.025 }],
    sourceNote: "ENTSO-E Litgrid wind-only Baltic regional proxy; solar negligible for this feed.",
  },
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
