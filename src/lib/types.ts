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
  intervalHours?: number;  // duration represented by this observation; defaults to 1h
}

/** Data produced by a loader for one region. */
export interface RegionData {
  regionId: string;
  profile: number[];       // 24 GW values, index = UTC hour 0..23
  latestProfile: number[] | null; // latest complete UTC day, raw hourly GW; null when unavailable
  totalTWh: number;        // trailing-30-day total (scaled to annual)
  peakGW: number;          // max of profile
  lastUpdated: string;     // ISO 8601 UTC of most recent source data
  sourceNote?: string;     // optional provenance addendum
  /**
   * Indicates whether the current payload came from a live fetch or
   * a fallback snapshot. Absent or "live" = fresh data. "cached" = the
   * live fetch failed on this build and we served the previous snapshot.
   * Surfaced in the methodology page so readers can see freshness.
   */
  sourceStatus?: "live" | "cached";
  /**
   * Data-driven fuel-mix override. If present, this takes precedence over the
   * region's canonical `kind` for bucketing in hotspot columns and timeline
   * stacking. Values are fractions in 0..1 and should sum to ≤ 1.
   *
   * Loaders that pull technology-separated curtailment feeds (e.g. ONS Brazil
   * which publishes wind and solar constrained-off in parallel) compute this
   * ratio from observed volumes so Bahia or Piauí can appear correctly in
   * BOTH the wind and solar hotspot columns proportional to real curtailment.
   */
  fuelShare?: Partial<Record<"solar" | "wind" | "hydro", number>>;
  /**
   * Confidence tier for the emitted peakGW value. Derived deterministically
   * from the loader's Region.tier and (for statics) the profile kind.
   * See `src/lib/uncertainty.ts` for derivation and
   * `docs/methodology/uncertainty.md` for the methodology writeup.
   *
   *   T1-live-TSO         live feed, ±2σ from 5yr backfill
   *   T2-annual-calibrated static anchored to published annual (±20%)
   *   T3-modelled         static with typical-shape profile (±40%)
   *   T4-structural-gap   reserved; not emitted in RegionData
   */
  confidenceTier?:
    | "T1-live-TSO"
    | "T2-annual-calibrated"
    | "T3-modelled"
    | "T4-structural-gap";
  /** Lower bound on peakGW (GW). peakGW - uncertaintyLowGW is the half-width when symmetric. */
  uncertaintyLowGW?: number;
  /** Upper bound on peakGW (GW). peakGW + uncertaintyHighGW is the upper half-width when symmetric. */
  uncertaintyHighGW?: number;
}

/** Network consumption and hashrate reference from Cambridge CBECI. */
export interface CBECIData {
  hashrateEHps: number;           // current network hashrate
  annualisedConsumptionTWh: number; // current network consumption
  lastUpdated: string;             // ISO 8601
  sourceStatus?: "live" | "cached";
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
