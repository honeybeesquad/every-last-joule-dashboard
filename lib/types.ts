/** Canonical region tier determines rendering and cadence treatment. */
export type RegionTier = "live" | "static" | "flare";

/** The waste modality drives colouring (teal vs orange) and narrative. */
export type RegionKind = "solar" | "wind" | "hydro" | "mixed" | "flare";

/** Canonical region definition. Immutable; does not change per build. */
export interface Region {
  id: string;              // kebab-case stable id
  name: string;            // display name
  country: string;         // ISO-3 or display country
  lat: number;             // WGS84 latitude
  lon: number;             // WGS84 longitude
  tier: RegionTier;
  kind: RegionKind;
  source: string;          // primary data source label
  sourceUrl: string;       // canonical source URL
}

/** A single instantaneous observation from a grid API. */
export interface CurtailmentPoint {
  utcTimestamp: string;    // ISO 8601 UTC
  mw: number;              // non-negative megawatts curtailed
}

/** Data produced by a loader for one region. */
export interface RegionData {
  regionId: string;
  profile: number[];       // 24 GW values, index = UTC hour 0..23
  totalTWh: number;        // trailing-30-day total (scaled to annual)
  peakGW: number;          // max of profile
  lastUpdated: string;     // ISO 8601 UTC of most recent source data
  sourceNote?: string;     // optional provenance addendum
}

/** Network consumption and hashrate reference from Cambridge CBECI. */
export interface CBECIData {
  hashrateEHps: number;           // current network hashrate
  annualisedConsumptionTWh: number; // current network consumption
  lastUpdated: string;             // ISO 8601
}

/** Global anchor figure from Ember / IEA. */
export interface GlobalAnchor {
  sourceName: string;
  globalCurtailmentTWh: number;
  sourceReportDate: string;
  sourceUrl: string;
}

/** Combined per-hour aggregate. */
export interface AggregateResult {
  utcHour: number;               // 0..23
  totalGW: number;
  hashrateEHps: number;          // at 16 J/TH
  pctOfNetwork: number;          // 0..100+
  perRegionGW: Record<string, number>;
}

/** The object index.md consumes. */
export interface DashboardData {
  regions: Region[];
  regionData: Record<string, RegionData>;
  cbeci: CBECIData;
  anchor: GlobalAnchor;
  generatedAt: string;           // build timestamp
}
