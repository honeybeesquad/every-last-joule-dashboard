import { REGIONS } from "./regions.js";
import { EIA_VRE_BA_CONFIGS } from "../data/eia-vre-bas.json.js";
import { TSO_GRID_MARKERS } from "../data/tso-grid-markers.json.js";

export type CollectStatus =
  | "live-tso"
  | "relay-tso"
  | "not-collecting"
  | "no-public-series"
  | "conflict-blocked";

export interface TsoGridRosterRow {
  operator: string;
  iso3: string;
  fuels: string;
  collectStatus: CollectStatus;
  loaderKey: string;
  wasteStatus: "measured" | "measured-zero" | "unpublished" | "legacy-unspecified";
  regionIds: string;
  notes: string;
}

const EIA_VRE_IDS = new Set(
  EIA_VRE_BA_CONFIGS.flatMap((c) => [`${c.regionId}-wind`, `${c.regionId}-solar`]),
);
const MARKER_IDS = new Set(TSO_GRID_MARKERS.map((m) => m.id));

const ENTSO_UNPUBLISHED = new Set([
  "malta",
  "albania",
  "austria-wind",
  "austria-solar",
  "latvia-wind",
  "latvia-solar",
  "lithuania-wind",
  "lithuania-solar",
  "sweden-se1-wind",
  "sweden-se1-solar",
  "sweden-se2-wind",
  "sweden-se2-solar",
  "bosnia-wind",
  "bosnia-solar",
  "montenegro-wind",
  "montenegro-solar",
  "kosovo-wind",
  "kosovo-solar",
  "bosnia-and-herzegovina",
  "montenegro",
]);

const RELAY_TSO = new Set([
  "mexico-wind",
  "mexico-solar",
  "argentina",
  "india-grid-india",
]);

const LIVE_UNPUBLISHED_GEN = new Set([
  "bangladesh",
  "philippines-solar",
  "philippines-wind",
  "dominican-republic",
  "dominican-republic-wind",
]);

/** Operators with no dashboard region, or honesty overlays. */
const EXTRA_OPERATORS: TsoGridRosterRow[] = [
  { operator: "REE ESIOS", iso3: "ESP", fuels: "wind,solar", collectStatus: "not-collecting", loaderKey: "spain-esios", wasteStatus: "unpublished", regionIds: "spain-wind;spain-solar", notes: "Parser shipped. Returns {} without ESIOS_API_TOKEN. Does not overwrite ENTSO T1a Spain. Indicator 704 is mixed-fuel — no invented split." },
  { operator: "KPX", iso3: "KOR", fuels: "wind,solar", collectStatus: "not-collecting", loaderKey: "southKorea", wasteStatus: "unpublished", regionIds: "south-korea-wind;south-korea-solar", notes: "PvAmountByLocHr parser behind DATA_GO_KR_SERVICE_KEY. Ember×rate until the key is issued. Wind stays Ember until a KPX wind series exists." },
  { operator: "OC SENI", iso3: "DOM", fuels: "mixed", collectStatus: "live-tso", loaderKey: "dominican", wasteStatus: "unpublished", regionIds: "dominican-republic;dominican-republic-wind", notes: "GetGeneracionReprogramadaJSon GENERACION MW is total system, not VRE waste. Generation collected." },
  { operator: "Noga / IEC", iso3: "ISR", fuels: "solar", collectStatus: "not-collecting", loaderKey: "israel", wasteStatus: "unpublished", regionIds: "israel", notes: "noga-iso.co.il 403 from this IP. PUA literature waste kept until a Noga series exists." },
  { operator: "NEPCO", iso3: "JOR", fuels: "solar,wind", collectStatus: "not-collecting", loaderKey: "jordan", wasteStatus: "unpublished", regionIds: "jordan", notes: "No hourly dashboard. PDF commentary is not a TSO series." },
  { operator: "Taipower", iso3: "TWN", fuels: "mixed", collectStatus: "not-collecting", loaderKey: "taiwan", wasteStatus: "unpublished", regionIds: "taiwan", notes: "genary.txt geo-blocked from this IP. Relay from in-region IP required." },
  { operator: "EMA / SP PowerGrid", iso3: "SGP", fuels: "solar", collectStatus: "not-collecting", loaderKey: "", wasteStatus: "unpublished", regionIds: "singapore", notes: "EMA TES / wholesale half-hourly not a public JSON from this IP." },
  { operator: "IEMOP / NGCP", iso3: "PHL", fuels: "solar,wind", collectStatus: "live-tso", loaderKey: "philippines", wasteStatus: "unpublished", regionIds: "philippines-solar;philippines-wind", notes: "WESM RTD SCHED_MW ZIP is public. No available-capacity column. Waste unpublished." },
  { operator: "EVN / NSMO / NLDC", iso3: "VNM", fuels: "solar", collectStatus: "not-collecting", loaderKey: "vietnam", wasteStatus: "unpublished", regionIds: "vietnam", notes: "nldc.evn.vn timed out from this IP. 4 TWh literature kept until a PDF relay writes CSV. 365 GWh 2020 is not T2." },
  { operator: "NTDC / NPCC", iso3: "PAK", fuels: "wind,solar", collectStatus: "not-collecting", loaderKey: "pakistan", wasteStatus: "unpublished", regionIds: "pakistan-wind;pakistan-solar", notes: "NEPRA NPMV 1.34 TWh is published missed volume — keep until NTDC series exists." },
  { operator: "PGCB / BPDB", iso3: "BGD", fuels: "solar", collectStatus: "live-tso", loaderKey: "bangladesh", wasteStatus: "unpublished", regionIds: "bangladesh", notes: "PGCB hourly solar generation collected. Waste unpublished. Invented 0.1 TWh dropped." },
  { operator: "PREPA / LUMA", iso3: "PRI", fuels: "wind,solar", collectStatus: "no-public-series", loaderKey: "tso-grid-markers", wasteStatus: "unpublished", regionIds: "puerto-rico-wind;puerto-rico-solar", notes: "EIA-930 probe 2026-09-20: 83 respondents, no PREP/LUMA/CEPR (total=0). Contiguous-US BAs only. LUMA BPS daily PDFs exclude solar/wind from Available Supply. Mi LUMA JSON is outages only." },
  { operator: "Landsnet", iso3: "ISL", fuels: "hydro", collectStatus: "not-collecting", loaderKey: "", wasteStatus: "unpublished", regionIds: "iceland", notes: "No public Landsnet time series. Keep Orkustofnun 5.3 TWh modelled spill until a TSO series exists." },
  { operator: "Grid-India / RLDCs", iso3: "IND", fuels: "solar,wind", collectStatus: "relay-tso", loaderKey: "india-grid-india", wasteStatus: "unpublished", regionIds: "india-grid-india", notes: "CEA gen-re state CSVs summed. abed is not an India PoP. Not a substitute for SLDC subgrids." },
  { operator: "SGCC North", iso3: "CHN", fuels: "wind,solar,hydro", collectStatus: "no-public-series", loaderKey: "", wasteStatus: "unpublished", regionIds: "", notes: "No machine-readable dispatch. Provincial Ember×NEA is not this TSO." },
  { operator: "SGCC Central", iso3: "CHN", fuels: "wind,solar,hydro", collectStatus: "no-public-series", loaderKey: "", wasteStatus: "unpublished", regionIds: "", notes: "No machine-readable dispatch." },
  { operator: "SGCC East", iso3: "CHN", fuels: "wind,solar,hydro", collectStatus: "no-public-series", loaderKey: "", wasteStatus: "unpublished", regionIds: "", notes: "No machine-readable dispatch." },
  { operator: "SGCC Northeast", iso3: "CHN", fuels: "wind,solar,hydro", collectStatus: "no-public-series", loaderKey: "", wasteStatus: "unpublished", regionIds: "", notes: "No machine-readable dispatch." },
  { operator: "CSG", iso3: "CHN", fuels: "wind,solar,hydro", collectStatus: "no-public-series", loaderKey: "", wasteStatus: "unpublished", regionIds: "", notes: "No machine-readable dispatch." },
  { operator: "Mengxi", iso3: "CHN", fuels: "wind,solar", collectStatus: "no-public-series", loaderKey: "", wasteStatus: "unpublished", regionIds: "", notes: "No machine-readable dispatch." },
  { operator: "SEC", iso3: "SAU", fuels: "solar", collectStatus: "no-public-series", loaderKey: "saudiSolar", wasteStatus: "unpublished", regionIds: "saudi-solar", notes: "Structural dark. 5.2% June audit figure is irradiance, not curtailment. Partnership email." },
  { operator: "EWEC/TRANSCO", iso3: "ARE", fuels: "solar", collectStatus: "no-public-series", loaderKey: "uae", wasteStatus: "unpublished", regionIds: "uae", notes: "Structural dark. Partnership email." },
  { operator: "DEWA", iso3: "ARE", fuels: "solar", collectStatus: "no-public-series", loaderKey: "", wasteStatus: "unpublished", regionIds: "", notes: "Structural dark." },
  { operator: "OETC", iso3: "OMN", fuels: "solar", collectStatus: "no-public-series", loaderKey: "oman", wasteStatus: "unpublished", regionIds: "oman", notes: "Structural dark." },
  { operator: "Kahramaa", iso3: "QAT", fuels: "solar", collectStatus: "no-public-series", loaderKey: "", wasteStatus: "unpublished", regionIds: "", notes: "Structural dark." },
  { operator: "EETC", iso3: "EGY", fuels: "solar,wind", collectStatus: "no-public-series", loaderKey: "egypt", wasteStatus: "unpublished", regionIds: "egypt", notes: "Structural dark." },
  { operator: "ONEE", iso3: "MAR", fuels: "solar,wind", collectStatus: "no-public-series", loaderKey: "morocco", wasteStatus: "unpublished", regionIds: "morocco", notes: "Structural dark." },
  { operator: "STEG", iso3: "TUN", fuels: "solar,wind", collectStatus: "no-public-series", loaderKey: "", wasteStatus: "unpublished", regionIds: "tunisia", notes: "Structural dark." },
  { operator: "GRTE/Sonelgaz", iso3: "DZA", fuels: "solar", collectStatus: "no-public-series", loaderKey: "", wasteStatus: "unpublished", regionIds: "", notes: "Structural dark." },
  { operator: "SO UPS Siberia/Far East/Kaliningrad", iso3: "RUS", fuels: "hydro,wind", collectStatus: "no-public-series", loaderKey: "", wasteStatus: "unpublished", regionIds: "", notes: "Post-2022 opacity. Murmansk stays T2; European UES modelled." },
  { operator: "Ukrenergo", iso3: "UKR", fuels: "wind,solar", collectStatus: "conflict-blocked", loaderKey: "", wasteStatus: "unpublished", regionIds: "ukraine;ukraine-wind", notes: "ENTSO absent post-war. Ember is not Ukrenergo." },
  { operator: "DPRK", iso3: "PRK", fuels: "hydro", collectStatus: "no-public-series", loaderKey: "", wasteStatus: "unpublished", regionIds: "north-korea", notes: "Dark. Roster row so every grid is honest about darkness." },
];

function classify(id: string, tier: string, provenance: string | undefined): Pick<TsoGridRosterRow, "collectStatus" | "loaderKey" | "wasteStatus" | "notes"> {
  if (EIA_VRE_IDS.has(id)) {
    return { collectStatus: "live-tso", loaderKey: "eia-vre-bas", wasteStatus: "unpublished", notes: "EIA-930 generation; BA publishes no curtailment rate." };
  }
  if (ENTSO_UNPUBLISHED.has(id)) {
    return { collectStatus: "live-tso", loaderKey: "entsoe", wasteStatus: "unpublished", notes: "ENTSO-E A75 generation; waste unpublished." };
  }
  if (MARKER_IDS.has(id)) {
    return { collectStatus: "no-public-series", loaderKey: "tso-grid-markers", wasteStatus: "unpublished", notes: "Grid present; no public ops series wired." };
  }
  if (RELAY_TSO.has(id)) {
    return { collectStatus: "relay-tso", loaderKey: id.startsWith("mexico") ? "mexico" : id.startsWith("colombia") ? "colombia" : id.startsWith("india") ? "india-grid-india" : "argentina", wasteStatus: "unpublished", notes: "Relay CSV / geoblocked live path. Waste unpublished unless operator publishes restricciones." };
  }
  if (LIVE_UNPUBLISHED_GEN.has(id)) {
    const loaderKey = id.startsWith("philippines")
      ? "philippines"
      : id.startsWith("dominican")
        ? "dominican"
        : id;
    return { collectStatus: "live-tso", loaderKey, wasteStatus: "unpublished", notes: "TSO generation collected; waste unpublished." };
  }
  if (tier === "live" || tier === "live-domestic-anchored" || tier === "live-neighbour-anchored") {
    return { collectStatus: "live-tso", loaderKey: "", wasteStatus: "legacy-unspecified", notes: "Existing live waste or Path-B generation×rate." };
  }
  if (tier === "anchored") {
    return { collectStatus: "not-collecting", loaderKey: "statics", wasteStatus: "legacy-unspecified", notes: "T2 annual waste anchor. Not hourly TSO collection." };
  }
  if (provenance === "official-lead") {
    return { collectStatus: "not-collecting", loaderKey: "", wasteStatus: "unpublished", notes: "Authoritative operator exists; live path not producing usable waste." };
  }
  return { collectStatus: "not-collecting", loaderKey: "statics", wasteStatus: "unpublished", notes: "Country/T3 stub — Ember/IRENA is not TSO collection." };
}

export function buildTsoGridRoster(): TsoGridRosterRow[] {
  const fromRegions: TsoGridRosterRow[] = REGIONS.map((r) => {
    const c = classify(r.id, r.tier, r.sourceProvenance);
    return {
      operator: r.name,
      iso3: r.country,
      fuels: r.kind,
      collectStatus: c.collectStatus,
      loaderKey: c.loaderKey,
      wasteStatus: c.wasteStatus,
      regionIds: r.id,
      notes: c.notes,
    };
  });
  return [...fromRegions, ...EXTRA_OPERATORS];
}

export const TSO_GRID_ROSTER_COLUMNS = [
  "operator",
  "iso3",
  "fuels",
  "collect_status",
  "loader_key",
  "waste_status",
  "region_ids",
  "notes",
] as const;

export function rosterToCsv(rows: TsoGridRosterRow[]): string {
  const header = TSO_GRID_ROSTER_COLUMNS.join(",");
  const body = rows.map((r) =>
    [
      r.operator,
      r.iso3,
      r.fuels,
      r.collectStatus,
      r.loaderKey,
      r.wasteStatus,
      r.regionIds,
      r.notes,
    ].map(csvEscape).join(","),
  );
  return [header, ...body].join("\n") + "\n";
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}
