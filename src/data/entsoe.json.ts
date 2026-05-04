import { withFallback } from "../lib/resilient.js";
import type { RegionData } from "../lib/types.js";
import {
  fetchEntsoeZone,
  parseEntsoeXml as parseEntsoeXmlImpl,
  buildZoneData as buildZoneDataImpl,
} from "../lib/entsoe.js";
import { pathToFileURL } from "url";

export const ZONES = [
  // belgium — split per-fuel (Elia publishes wind+solar but dashboard needs per-fuel rows)
  {
    id: "belgium-wind",
    domain: "10YBE----------2",
    technologies: [{ psrType: "B18", fuel: "wind", rate: 0.02 }],
    sourceNote: "Elia wind curtailment — B18 (offshore) + B19 (onshore) combined; 2024 anchor.",
  },
  {
    id: "belgium-solar",
    domain: "10YBE----------2",
    technologies: [{ psrType: "B16", fuel: "solar", rate: 0.01 }],
    sourceNote: "Elia solar curtailment — B16 PV; 2024 anchor.",
  },
  // spain (formerly iberia) — split per-fuel (REE publishes wind+solar separately)
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
  // portugal — split per-fuel
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
  // germany — split per-fuel (BNetzA/SMARD published anchors for wind+ solar)
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
  // france — RTE eco2mix split (wind+solar published separately)
  {
    id: "finland",
    domain: "10YFI-1--------U",
    technologies: [{ psrType: "B19", fuel: "wind", rate: 0.05 }],
    sourceNote: "Finland wind-only calibration; solar negligible at Finnish latitude.",
  },
  // netherlands — split per-fuel (IEEFA 2025 published anchors)
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
  // denmark-east (DK2) — split per-fuel
  // poland — split per-fuel (URE 2024 redispatch report)
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
  // greece — split per-fuel (HAEE/IPTO 2025 Greek TSO/regulator)
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
  // romania — split per-fuel (Transelectrica ENTSO-E A75, regional defaults)
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
  // Italy split into three ENTSO-E bidding zones. Terna 2024 national total
  // 0.31 TWh/yr; North Italy is better-connected (Alps hydro absorbs solar),
  // Sicily and Sardinia are island-isolated (HVDC capacity-limited) and carry
  // the highest per-GWh curtailment rates.
  //
  // NOTE: ENTSO-E domains IT-South (10Y1001A1001A86H), IT-Central North
  // (10Y1001A1001A84D), and IT-Central South (10Y1001A1001A85B) all return
  // error code 999 — Terna does not publish A75 data for those mainland zones.
  // IT-Sicily (10Y1001A1001A75E) is well-published and is used in place of
  // the original italy-south entry. Sicily is heavily wind-loaded and
  // transmission-constrained via the Sorgente-Rizziconi HVDC link, making it
  // the most representative southern-Italy curtailment signal available.
  // italy-north-zone — split per-fuel (Terna A75, ~35% of national 0.31 TWh)
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
  // italy-sicily — split per-fuel (Terna A75, island-isolated, high rates)
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
  // italy-sardinia — split per-fuel (Terna A75, island-isolated, high rates)
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
  // sweden-south (SE4) — split per-fuel
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
  // Ukraine removed from live ENTSO-E fetch: Ukrenergo (10Y1001C--00003F)
  // returns empty A75 generation data post-2022 synchronisation. Moved to
  // statics.json.ts as solar-dominant typical-shape fallback at 1.2 TWh/yr.
  // hungary — split per-fuel (MAVIR 2024 anchor)
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
  // czech-republic — split per-fuel (CEPS 2024 anchor)
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
  // bulgaria — split per-fuel (ESO Bulgaria 2024 anchor)
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
  // Balkans (8) — ENTSO-E A75 hourly generation published for all. Calibration
  // uses conservative regional defaults (no domestic published anchor for most).
  // Hydro-dominated systems (ALB, BIH, MNE) are excluded per methodology: hydro
  // curtailment is structural/spill, not dispatch-driven VRE curtailment.
  // serbia — split per-fuel (EMS ENTSO-E A75, regional defaults)
  {
    id: "serbia-wind",
    domain: "10YCS-SERBIATSOV",
    technologies: [{ psrType: "B19", fuel: "wind", rate: 0.03 }],
    sourceNote: "EMS Serbia ENTSO-E A75 wind: regional default ~3%.",
  },
  {
    id: "serbia-solar",
    domain: "10YCS-SERBIATSOV",
    technologies: [{ psrType: "B16", fuel: "solar", rate: 0.02 }],
    sourceNote: "EMS Serbia ENTSO-E A75 solar: regional default ~2%.",
  },
  {
    id: "bosnia-and-herzegovina",
    domain: "10YBA-JPCC-----D",
    technologies: [], // hydro-dominated; dispatch-driven VRE curtailment negligible
    sourceNote: "BH Krajina A75 feed; hydro-dominated system. Structural hydro spill (not dispatch-driven VRE curtailment) excluded per methodology. No published anchor.",
  },
  // north-macedonia — split per-fuel (MEPSO ENTSO-E A75, regional defaults)
  {
    id: "north-macedonia-wind",
    domain: "10YMK-MEPSO----8",
    technologies: [{ psrType: "B19", fuel: "wind", rate: 0.03 }],
    sourceNote: "MEPSO North Macedonia: regional default ~3% wind.",
  },
  {
    id: "north-macedonia-solar",
    domain: "10YMK-MEPSO----8",
    technologies: [{ psrType: "B16", fuel: "solar", rate: 0.02 }],
    sourceNote: "MEPSO North Macedonia: regional default ~2% solar.",
  },
  {
    id: "montenegro",
    domain: "10YCS-CG-TSO---S",
    technologies: [], // hydro-dominated; dispatch-driven VRE curtailment negligible
    sourceNote: "CGES Montenegro A75 feed; hydro-dominated system. Structural hydro spill excluded per methodology. No published anchor.",
  },
  // croatia — split per-fuel (HOPS ENTSO-E A75, regional defaults)
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
  // slovenia — split per-fuel (ELES ENTSO-E A75, regional defaults)
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
  // slovakia — split per-fuel (SEPS ENTSO-E A75, regional defaults)
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
  // Baltic states + small EU — ENTSO-E A75 hourly generation published.
  // Moldova is not synchronised with ENTSO-E but publishes via MEPSO
  // (former Soviet TSO; some cross-border coordination with UA/RO).
  {
    id: "lithuania",
    domain: "10YLT-1001A0008Q",
    technologies: [
      { psrType: "B19", fuel: "wind", rate: 0.025 }, // Litgrid 2024 anchor (B4 Option B); solar negligible
    ],
    sourceNote: "Litgrid Lithuania ENTSO-E A75 feed. Wind 2.5% rate anchored to Litgrid published 2024 wind curtailment data (same anchor used for existing baltics aggregate). Solar negligible at Lithuanian latitude.",
  },
  {
    id: "latvia",
    domain: "10YLV-1001A00074",
    technologies: [
      { psrType: "B19", fuel: "wind", rate: 0.025 }, // regional default — no published anchor; consistent with lithuania/estonia
    ],
    sourceNote: "AST Latvia ENTSO-E A75 feed. Wind 2.5% regional default — no published Latvian curtailment anchor found.",
  },
  {
    id: "estonia",
    domain: "10Y1001A1001A39I",
    technologies: [
      { psrType: "B19", fuel: "wind", rate: 0.025 }, // regional default — no published anchor; consistent with lithuania/latvia
    ],
    sourceNote: "Elering Estonia ENTSO-E A75 feed. Wind 2.5% regional default — no published Estonian curtailment anchor found. Solar at Estonian latitude is dominated by behind-meter distributed PV (not in A75); wind is the dispatch-curtailable component.",
  },
  // luxembourg — split per-fuel (Cegedel ENTSO-E A75, regional defaults)
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
  // moldova — split per-fuel (Moldelectrica via MEPSO protocol, regional defaults)
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
