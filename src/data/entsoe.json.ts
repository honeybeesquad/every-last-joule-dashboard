import { readFileSync } from "node:fs";
import { join } from "node:path";
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
    id: "spain-wind",
    domain: "10YES-REE------0",
    technologies: [
      { psrType: "B19", fuel: "wind", rate: 0.11 },
    ],
    sourceNote: "Spain 2024 REE wind curtailment: ~6.8 TWh/yr per REE Informe del Sistema Eléctrico 2024.",
  },
  {
    id: "spain-solar",
    domain: "10YES-REE------0",
    technologies: [
      { psrType: "B16", fuel: "solar", rate: 0.055 },
    ],
    sourceNote: "Spain 2024 REE PV curtailment: ~2.4 TWh/yr + 1.4 TWh CSP per REE Informe 2024.",
  },
  {
    id: "portugal-wind",
    domain: "10YPT-REN------W",
    technologies: [{ psrType: "B19", fuel: "wind", rate: 0.03 }],
    sourceNote: "Portugal 2024 wind: ~0.1 TWh/yr anchor.",
  },
  {
    id: "portugal-solar",
    domain: "10YPT-REN------W",
    technologies: [{ psrType: "B16", fuel: "solar", rate: 0.10 }],
    sourceNote: "Portugal 2024 solar: primary per REN/ENTSO-E.",
  },
  {
    id: "germany-wind",
    domain: "10Y1001A1001A82H",
    technologies: [
      { psrType: "B18", fuel: "wind", rate: 0.178 },
      { psrType: "B19", fuel: "wind", rate: 0.030 },
    ],
    sourceNote: "Germany 2024 BNetzA/SMARD: 4.56 TWh offshore wind + 3.38 TWh onshore wind curtailed.",
  },
  {
    id: "germany-solar",
    domain: "10Y1001A1001A82H",
    technologies: [{ psrType: "B16", fuel: "solar", rate: 0.023 }],
    sourceNote: "Germany 2024 BNetzA/SMARD solar: 1.39 TWh curtailed.",
  },
  {
    id: "finland-wind",
    domain: "10YFI-1--------U",
    technologies: [{ psrType: "B19", fuel: "wind", rate: 0.05 }],
    sourceNote: "Finland 2024 wind: ENTSO-E A75 FI bidding zone B19.",
  },
  {
    id: "finland-solar",
    domain: "10YFI-1--------U",
    technologies: [{ psrType: "B16", fuel: "solar", rate: 0.01 }],
    sourceNote: "Finland 2024 solar: ENTSO-E A75 FI bidding zone B16; very small at high latitude.",
  },
  {
    id: "netherlands-wind",
    domain: "10YNL----------L",
    technologies: [
      { psrType: "B18", fuel: "wind", rate: 0.049 },
      { psrType: "B19", fuel: "wind", rate: 0.045 },
    ],
    sourceNote: "Netherlands 2024 IEEFA: 3.0 TWh wind+solar curtailment, wind-dominant share.",
  },
  {
    id: "netherlands-solar",
    domain: "10YNL----------L",
    technologies: [{ psrType: "B16", fuel: "solar", rate: 0.045 }],
    sourceNote: "Netherlands 2024 IEEFA solar share of 3.0 TWh total.",
  },
  {
    id: "poland-wind",
    domain: "10YPL-AREA-----S",
    technologies: [{ psrType: "B19", fuel: "wind", rate: 0.02 }],
    sourceNote: "Poland 2024 URE wind curtailment: regional default ~2%.",
  },
  {
    id: "poland-solar",
    domain: "10YPL-AREA-----S",
    technologies: [{ psrType: "B16", fuel: "solar", rate: 0.01 }],
    sourceNote: "Poland 2024 URE solar curtailment: regional default ~1%.",
  },
  {
    id: "greece-wind",
    domain: "10YGR-HTSO-----Y",
    technologies: [{ psrType: "B19", fuel: "wind", rate: 0.03 }],
    sourceNote: "Greece 2024 IPTO wind curtailment: regional default ~3%.",
  },
  {
    id: "greece-solar",
    domain: "10YGR-HTSO-----Y",
    technologies: [{ psrType: "B16", fuel: "solar", rate: 0.02 }],
    sourceNote: "Greece 2024 IPTO solar curtailment: regional default ~2%.",
  },
  {
    id: "romania-wind",
    domain: "10YRO-TEL------P",
    technologies: [{ psrType: "B19", fuel: "wind", rate: 0.02 }],
    sourceNote: "Romania 2024 Transelectrica wind: regional default ~2%.",
  },
  {
    id: "romania-solar",
    domain: "10YRO-TEL------P",
    technologies: [{ psrType: "B16", fuel: "solar", rate: 0.015 }],
    sourceNote: "Romania 2024 Transelectrica solar: regional default ~1.5%.",
  },
  {
    id: "italy-north-zone-wind",
    domain: "10Y1001A1001A73I",
    technologies: [{ psrType: "B19", fuel: "wind", rate: 0.003 }],
    sourceNote: "ENTSO-E North Italy: ~35% of Terna 2024 national curtailment, wind share.",
  },
  {
    id: "italy-north-zone-solar",
    domain: "10Y1001A1001A73I",
    technologies: [{ psrType: "B16", fuel: "solar", rate: 0.006 }],
    sourceNote: "ENTSO-E North Italy: ~35% of Terna 2024 national curtailment, solar share.",
  },
  {
    id: "italy-sicily-wind",
    domain: "10Y1001A1001A75E",
    technologies: [{ psrType: "B19", fuel: "wind", rate: 0.035 }],
    sourceNote: "ENTSO-E Sicily: island HVDC constraint; wind-dominant.",
  },
  {
    id: "italy-sicily-solar",
    domain: "10Y1001A1001A75E",
    technologies: [{ psrType: "B16", fuel: "solar", rate: 0.040 }],
    sourceNote: "ENTSO-E Sicily: island HVDC constraint; significant solar.",
  },
  {
    id: "italy-sardinia-wind",
    domain: "10Y1001A1001A74G",
    technologies: [{ psrType: "B19", fuel: "wind", rate: 0.020 }],
    sourceNote: "ENTSO-E Sardinia: island HVDC constraint; wind share.",
  },
  {
    id: "italy-sardinia-solar",
    domain: "10Y1001A1001A74G",
    technologies: [{ psrType: "B16", fuel: "solar", rate: 0.047 }],
    sourceNote: "ENTSO-E Sardinia: island HVDC constraint; solar-dominant share.",
  },
  {
    id: "sweden-north",
    domain: "10Y1001A1001A46L",
    technologies: [{ psrType: "B19", fuel: "wind", rate: 0.01 }],
    sourceNote: "ENTSO-E SE2 wind-only calibration; solar negligible in SE2.",
  },
  {
    id: "sweden-south-wind",
    domain: "10Y1001A1001A47J",
    technologies: [{ psrType: "B19", fuel: "wind", rate: 0.02 }],
    sourceNote: "ENTSO-E SE4 wind: regional default ~2%.",
  },
  {
    id: "sweden-south-solar",
    domain: "10Y1001A1001A47J",
    technologies: [{ psrType: "B16", fuel: "solar", rate: 0.07 }],
    sourceNote: "ENTSO-E SE4 solar: PV-heavy per SE4 grid characteristics.",
  },
  {
    id: "hungary-wind",
    domain: "10YHU-MAVIR----U",
    technologies: [{ psrType: "B19", fuel: "wind", rate: 0.01 }],
    sourceNote: "MAVIR 2024: wind secondary, regional default ~1%.",
  },
  {
    id: "hungary-solar",
    domain: "10YHU-MAVIR----U",
    technologies: [{ psrType: "B16", fuel: "solar", rate: 0.03 }],
    sourceNote: "MAVIR 2024: solar dominant.",
  },
  {
    id: "czech-republic-wind",
    domain: "10YCZ-CEPS-----N",
    technologies: [{ psrType: "B19", fuel: "wind", rate: 0.01 }],
    sourceNote: "CEPS 2024: wind secondary, regional default ~1%.",
  },
  {
    id: "czech-republic-solar",
    domain: "10YCZ-CEPS-----N",
    technologies: [{ psrType: "B16", fuel: "solar", rate: 0.02 }],
    sourceNote: "CEPS 2024: solar dominant.",
  },
  {
    id: "bulgaria-wind",
    domain: "10YCA-BULGARIA-R",
    technologies: [{ psrType: "B19", fuel: "wind", rate: 0.015 }],
    sourceNote: "ESO Bulgaria 2024: wind share.",
  },
  {
    id: "bulgaria-solar",
    domain: "10YCA-BULGARIA-R",
    technologies: [{ psrType: "B16", fuel: "solar", rate: 0.02 }],
    sourceNote: "ESO Bulgaria 2024: solar share.",
  },
  {
    id: "switzerland",
    domain: "10YCH-SWISSGRIDZ",
    technologies: [{ psrType: "B16", fuel: "solar", rate: 0.015 }],
    sourceNote: "Swissgrid PV-only ENTSO-E feed; wind negligible and hydro spill not in A75. Models summer-midday PV oversupply only; understates total Swiss curtailment.",
  },
  {
    id: "serbia-wind",
    domain: "10YCS-SERBIATSOV",
    technologies: [{ psrType: "B19", fuel: "wind", rate: 0.03 }],
    sourceNote: "EMS Serbia ENTSO-E A75 wind: regional default ~3%.",
  },
  // serbia-solar removed 2026-06-06: ENTSO-E A75 B16 feed ceased ~2026-05-13.
  // EMS Serbia is a non-EU Energy Community TSO; EU Reg 543/2013 does not bind
  // it and reporting is voluntary. Reverted to estimated anchor in statics.json.ts.
  {
    id: "bosnia-and-herzegovina",
    domain: "10YBA-JPCC-----D",
    technologies: [],
    sourceNote: "BH Krajina A75 feed; hydro-dominated system. Structural hydro spill excluded per methodology.",
  },
  {
    id: "north-macedonia-wind",
    domain: "10YMK-MEPSO----8",
    technologies: [{ psrType: "B19", fuel: "wind", rate: 0.03 }],
    sourceNote: "MEPSO North Macedonia: regional default ~3% wind.",
  },
  // north-macedonia-solar removed 2026-06-06: ENTSO-E A75 B16 feed ceased ~2026-05-13.
  // MEPSO is a non-EU Energy Community TSO; EnC Secretariat 2023 report found
  // transparency "well below required levels" with 543/2013 not transposed into
  // national law. Reverted to estimated anchor in statics.json.ts. Note: NMK solar
  // capacity grew to 833 MW (end-2024) → 1.2 GW (end-2025); curtailment is real
  // and growing but no machine-readable live source is available.
  {
    id: "montenegro",
    domain: "10YCS-CG-TSO---S",
    technologies: [],
    sourceNote: "CGES Montenegro A75 feed; hydro-dominated system. Structural hydro spill excluded per methodology.",
  },
  {
    id: "croatia-wind",
    domain: "10YHR-HEP------M",
    technologies: [{ psrType: "B19", fuel: "wind", rate: 0.025 }],
    sourceNote: "HOPS Croatia ENTSO-E A75 wind: regional default ~2.5%.",
  },
  {
    id: "croatia-solar",
    domain: "10YHR-HEP------M",
    technologies: [{ psrType: "B16", fuel: "solar", rate: 0.02 }],
    sourceNote: "HOPS Croatia ENTSO-E A75 solar: regional default ~2%.",
  },
  {
    id: "slovenia-wind",
    domain: "10YSI-ELES-----O",
    technologies: [{ psrType: "B19", fuel: "wind", rate: 0.02 }],
    sourceNote: "ELES Slovenia ENTSO-E A75 wind: regional default ~2%.",
  },
  {
    id: "slovenia-solar",
    domain: "10YSI-ELES-----O",
    technologies: [{ psrType: "B16", fuel: "solar", rate: 0.02 }],
    sourceNote: "ELES Slovenia ENTSO-E A75 solar: regional default ~2%.",
  },
  {
    id: "slovakia-wind",
    domain: "10YSK-SEPS-----K",
    technologies: [{ psrType: "B19", fuel: "wind", rate: 0.02 }],
    sourceNote: "SEPS Slovakia ENTSO-E A75 wind: regional default ~2%.",
  },
  {
    id: "slovakia-solar",
    domain: "10YSK-SEPS-----K",
    technologies: [{ psrType: "B16", fuel: "solar", rate: 0.025 }],
    sourceNote: "SEPS Slovakia ENTSO-E A75 solar: regional default ~2.5%.",
  },
  // Lithuania + Latvia were here until 2026-05-11. Removed because Litgrid/AST
  // publish no verifiable A75 curtailment rate; the loader was producing values
  // but they were always clobbered by the statics.json.ts IRENA 2024 anchor in
  // index.md (`...statics` spread runs after the explicit ENTSO-E wiring). Now
  // tier="estimated" in regions.ts and flowing purely from statics.
  {
    id: "estonia",
    domain: "10Y1001A1001A39I",
    technologies: [
      { psrType: "B19", fuel: "wind", rate: 0.025 },
    ],
    sourceNote: "Elering Estonia ENTSO-E A75 feed. Wind 2.5% regional default.",
  },
  {
    id: "luxembourg-wind",
    domain: "10YLU-CEGEDEL-NQ",
    technologies: [{ psrType: "B19", fuel: "wind", rate: 0.02 }],
    sourceNote: "Cegedel Luxembourg ENTSO-E A75 wind: regional default ~2%.",
  },
  {
    id: "luxembourg-solar",
    domain: "10YLU-CEGEDEL-NQ",
    technologies: [{ psrType: "B16", fuel: "solar", rate: 0.02 }],
    sourceNote: "Cegedel Luxembourg ENTSO-E A75 solar: regional default ~2%.",
  },
  {
    id: "moldova-wind",
    domain: "10Y1001A1001A990",
    technologies: [{ psrType: "B19", fuel: "wind", rate: 0.03 }],
    sourceNote: "Moldelectrica ENTSO-E A75 wind: regional default ~3%.",
  },
  {
    id: "moldova-solar",
    domain: "10Y1001A1001A990",
    technologies: [{ psrType: "B16", fuel: "solar", rate: 0.02 }],
    sourceNote: "Moldelectrica ENTSO-E A75 solar: regional default ~2%.",
  },
  // Malta was here until 2026-05-11. Enemalta's A75 feed returns zero curtailment
  // (the loader produced peakGW=0); reverted to estimated and flowing from statics.
] as const;

export const parseEntsoeXml = parseEntsoeXmlImpl;
export const buildZoneData = buildZoneDataImpl;

const run = async (): Promise<Record<string, RegionData>> => {
  const cachePath = join(process.cwd(), "data", "snapshots", "last-good", "entsoe.json");
  let previous: Record<string, RegionData> = {};
  try {
    previous = JSON.parse(readFileSync(cachePath, "utf-8")) as Record<string, RegionData>;
  } catch { /* no previous cache */ }

  const out: Record<string, RegionData> = {};
  let anySuccess = false;

  for (const zone of ZONES) {
    try {
      if (zone.technologies.length === 0) {
        // Zones where structural spill is excluded per methodology.
        // Preserve previous cache if available; otherwise emit honest zero.
        out[zone.id] = previous[zone.id] ?? {
          regionId: zone.id,
          profile: Array(24).fill(0),
          latestProfile: null,
          totalTWh: 0,
          peakGW: 0,
          lastUpdated: new Date().toISOString(),
          lastSuccessAt: new Date().toISOString(),
          sourceNote: zone.sourceNote,
        };
        continue;
      }
      out[zone.id] = await fetchEntsoeZone(zone);
      anySuccess = true;
    } catch (err) {
      console.warn(`ENTSO-E zone ${zone.id} failed: ${(err as Error).message}`);
      if (previous[zone.id]) {
        const prev = previous[zone.id];
        const lastSuccessAt = prev.lastSuccessAt ?? prev.lastUpdated ?? "";
        const ageHours = lastSuccessAt
          ? (Date.now() - new Date(lastSuccessAt).getTime()) / 3_600_000
          : Infinity;
        out[zone.id] = {
          ...prev,
          sourceStatus: ageHours > 24 ? "degraded" : "cached",
        };
      } else {
        throw new Error(`ENTSO-E zone ${zone.id} failed and no cached data available`);
      }
    }
  }

  if (!anySuccess) {
    throw new Error("All ENTSO-E zones failed");
  }

  return out;
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<Record<string, RegionData>>("entsoe", run, {
    regionTier: "live" as const,
    tagLive: (r) => {
      const tagged: Record<string, RegionData> = {};
      for (const [k, v] of Object.entries(r)) {
        // Preserve "cached"/"degraded" stamped by per-zone fallback in run();
        // only promote truly-live zones to "live".
        tagged[k] = {
          ...v,
          sourceStatus: (v.sourceStatus === "cached" || v.sourceStatus === "degraded")
            ? v.sourceStatus
            : "live",
        };
      }
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
