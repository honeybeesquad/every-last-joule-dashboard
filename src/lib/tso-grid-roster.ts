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
  "puerto-rico-wind",
  "puerto-rico-solar",
]);

/** Operators with no dashboard region, or honesty overlays. */
const EXTRA_OPERATORS: TsoGridRosterRow[] = [
  { operator: "REE ESIOS", iso3: "ESP", fuels: "wind,solar", collectStatus: "not-collecting", loaderKey: "entsoe", wasteStatus: "unpublished", regionIds: "spain-wind;spain-solar", notes: "Human gate: consultasios@ree.es token. Generation already ENTSO. Do not start parser until token is in Vercel." },
  { operator: "KPX", iso3: "KOR", fuels: "wind,solar", collectStatus: "not-collecting", loaderKey: "southKorea", wasteStatus: "unpublished", regionIds: "south-korea-wind;south-korea-solar", notes: "Human gate: data.go.kr serviceKey (Korean ID)." },
  { operator: "OC SENI", iso3: "DOM", fuels: "wind,solar", collectStatus: "not-collecting", loaderKey: "", wasteStatus: "unpublished", regionIds: "dominican-republic;dominican-republic-wind", notes: "GetGeneracionReprogramadaJSon is scheduled/actual total, not VRE waste. Generation collectable; waste unpublished." },
  { operator: "Noga / IEC", iso3: "ISR", fuels: "solar", collectStatus: "not-collecting", loaderKey: "israel", wasteStatus: "unpublished", regionIds: "israel", notes: "Typical stub. Probe Noga open data; waste unpublished unless Noga documents it." },
  { operator: "NEPCO", iso3: "JOR", fuels: "solar,wind", collectStatus: "not-collecting", loaderKey: "jordan", wasteStatus: "unpublished", regionIds: "jordan", notes: "PDF commentary exists. No hourly dashboard wired." },
  { operator: "Taipower", iso3: "TWN", fuels: "mixed", collectStatus: "not-collecting", loaderKey: "taiwan", wasteStatus: "unpublished", regionIds: "taiwan", notes: "genary.json geo-blocked. Relay from in-region IP required. Annual PDF is not live waste. Britta fetchers are scaffolding." },
  { operator: "EMA / SP PowerGrid", iso3: "SGP", fuels: "solar", collectStatus: "not-collecting", loaderKey: "", wasteStatus: "unpublished", regionIds: "singapore", notes: "EMA TES / wholesale half-hourly not wired. Waste unpublished." },
  { operator: "IEMOP / NGCP", iso3: "PHL", fuels: "solar,wind", collectStatus: "not-collecting", loaderKey: "philippines", wasteStatus: "unpublished", regionIds: "philippines-solar;philippines-wind", notes: "WESM SPA has SCHED/actual; no curtailment column on the free tier. Headless capture not wired." },
  { operator: "EVN / NSMO / NLDC", iso3: "VNM", fuels: "solar", collectStatus: "not-collecting", loaderKey: "vietnam", wasteStatus: "unpublished", regionIds: "vietnam", notes: "TLS fail, PDF daily dispatch. Relay not writing CSV. 365 GWh 2020 quote is not a T2 anchor." },
  { operator: "NTDC / NPCC", iso3: "PAK", fuels: "wind,solar", collectStatus: "not-collecting", loaderKey: "pakistan", wasteStatus: "unpublished", regionIds: "pakistan-wind;pakistan-solar", notes: "NEPRA PDF / NPCC TLS. Waste unpublished." },
  { operator: "PGCB / BPDB", iso3: "BGD", fuels: "solar", collectStatus: "not-collecting", loaderKey: "bangladesh", wasteStatus: "unpublished", regionIds: "bangladesh", notes: "BPDB daily PDF Pattern-D not automated. Waste unpublished." },
  { operator: "PREPA / LUMA / Genera", iso3: "PRI", fuels: "wind,solar", collectStatus: "relay-tso", loaderKey: "puerto-rico", wasteStatus: "unpublished", regionIds: "puerto-rico-wind;puerto-rico-solar", notes: "operationdata.prepa.pr.gov dataSource.js utility-scale PPOA SiteTotal MW. abed NordVPN on 403 → relay CSV. EIA-930 has no PR BA. Waste unpublished. Not T1a. Lake needs ≥24 snapshots before a diurnal is emitted." },
  { operator: "Landsnet", iso3: "ISL", fuels: "hydro", collectStatus: "not-collecting", loaderKey: "", wasteStatus: "unpublished", regionIds: "iceland", notes: "iceland is T3 hydro modelled. Landsnet generation is not a public time series. Spill unpublished unless Orkustofnun publishes it." },
  { operator: "Grid-India / RLDCs", iso3: "IND", fuels: "solar,wind", collectStatus: "not-collecting", loaderKey: "india-grid-india", wasteStatus: "unpublished", regionIds: "india-grid-india", notes: "abed is Starlink CHC, not an India PoP. SLDCs are subgrids only when their portal yields a series." },
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
    return { collectStatus: "relay-tso", loaderKey: id.startsWith("mexico") ? "mexico" : id.startsWith("colombia") ? "colombia" : id.startsWith("puerto-rico") ? "puerto-rico" : "argentina", wasteStatus: "unpublished", notes: "Relay CSV / geoblocked live path. Waste unpublished unless operator publishes restricciones." };
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
