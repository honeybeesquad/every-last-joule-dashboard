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
      { psrType: "B18", fuel: "wind", rate: 0.178 }, // BNetzA 2024: 4,562 GWh offshore wind curtailed / 25.7 TWh offshore wind generation.
      { psrType: "B19", fuel: "wind", rate: 0.030 }, // BNetzA 2024: 3,384 GWh onshore wind curtailed / 111.9 TWh onshore wind generation.
      { psrType: "B16", fuel: "solar", rate: 0.023 },
    ],
    sourceNote: "Germany 2024 calibrated to BNetzA/SMARD: 4.56 TWh offshore wind, 3.38 TWh onshore wind, and 1.39 TWh solar curtailed.",
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
      { psrType: "B18", fuel: "wind", rate: 0.049 }, // IEEFA 2025: Netherlands 2024 wind+solar curtailment 3.0 TWh, 4.9% VRE rate.
      { psrType: "B19", fuel: "wind", rate: 0.045 },
      { psrType: "B16", fuel: "solar", rate: 0.045 },
    ],
    sourceNote: "Netherlands calibrated to IEEFA 2025 summary of 2024 curtailment: 3.0 TWh wind+solar, 4.9% VRE curtailment rate.",
  },
  {
    id: "poland",
    domain: "10YPL-AREA-----S",
    technologies: [
      { psrType: "B19", fuel: "wind", rate: 0.005 }, // URE 2025: 127.9 GWh wind redispatch / Ember 2024 Poland wind 25.89 TWh.
      { psrType: "B16", fuel: "solar", rate: 0.035 }, // URE 2025: 621.38 GWh PV redispatch / Ember 2024 Poland solar 17.66 TWh.
    ],
    sourceNote: "Poland calibrated to URE 2024 redispatch report: 621 GWh PV and 128 GWh wind non-market RES reductions.",
  },
  {
    id: "greece",
    domain: "10YGR-HTSO-----Y",
    technologies: [
      { psrType: "B16", fuel: "solar", rate: 0.036 }, // HAEE/IPTO 2025: 860 GWh 2024 RES curtailed / Ember wind+solar 23.81 TWh.
      { psrType: "B19", fuel: "wind", rate: 0.036 }, // HAEE/IPTO 2025: 860 GWh 2024 RES curtailed / Ember wind+solar 23.81 TWh.
    ],
    sourceNote: "Greece calibrated to HAEE/IPTO official 2024 RES curtailment of 860 GWh, applied as one wind+solar aggregate rate.",
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
  // Italy split into three ENTSO-E bidding zones (v1t). Previous italy-national
  // used the aggregate national domain (10YIT-GRTN-----B) which is correct at
  // the national total level but hides geographic variation. Terna 2024 national
  // total 0.31 TWh/yr split approximately 35% north / 45% south / 20% islands.
  // North Italy is better-connected (Alps hydro + pumped storage absorbs solar);
  // South Italy and Sardinia are transmission-constrained → higher curtailment rates.
  {
    id: "italy-north-zone",
    domain: "10Y1001A1001A73I",
    technologies: [
      { psrType: "B16", fuel: "solar", rate: 0.006 },
      { psrType: "B19", fuel: "wind", rate: 0.003 },
    ],
    sourceNote: "ENTSO-E North Italy bidding zone; ~35% of Terna 2024 0.31 TWh national curtailment anchor (well-connected via Alps links, lower rates).",
  },
  {
    id: "italy-south",
    domain: "10Y1001A1001A86H",
    technologies: [
      { psrType: "B16", fuel: "solar", rate: 0.019 },
      { psrType: "B19", fuel: "wind", rate: 0.010 },
    ],
    sourceNote: "ENTSO-E South Italy bidding zone (Apulia / Basilicata / Calabria); ~45% of Terna 2024 national anchor — transmission-constrained North-South corridor, high solar+wind curtailment.",
  },
  {
    id: "italy-sardinia",
    domain: "10Y1001A1001A74G",
    technologies: [
      { psrType: "B16", fuel: "solar", rate: 0.047 },
      { psrType: "B19", fuel: "wind", rate: 0.020 },
    ],
    sourceNote: "ENTSO-E Sardinia bidding zone; ~20% of Terna 2024 national anchor — island isolation (HVDC Sapei link capacity-limited), high per-GWh curtailment rate.",
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
  // Ukraine removed from live ENTSO-E fetch: Ukrenergo (10Y1001C--00003F)
  // returns empty A75 generation data post-2022 synchronisation. Moved to
  // statics.json.ts as solar-dominant typical-shape fallback at 1.2 TWh/yr.
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
  // Switzerland — Swissgrid publishes via ENTSO-E. Swiss wind is
  // negligible (<0.1 GW installed) and hydro spill does not appear in
  // A75 actual-generation data, so only the PV component is modelled
  // here. That understates total Swiss curtailment (hydro spill during
  // spring snowmelt is a real phenomenon) but what we DO model is the
  // summer-midday PV oversupply curtailment on Swissgrid's south-to-north
  // transit corridor — the fastest-growing component. Conservative rate
  // anchored to Czech/Hungarian neighbours; Tier 1.2 audit to refine.
  {
    id: "switzerland",
    domain: "10YCH-SWISSGRIDZ",
    technologies: [{ psrType: "B16", fuel: "solar", rate: 0.015 }],
    sourceNote: "Swissgrid PV-only ENTSO-E feed; wind negligible and hydro spill not in A75. Models summer-midday PV oversupply only; understates total Swiss curtailment.",
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
    regionTier: "live" as const,
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
