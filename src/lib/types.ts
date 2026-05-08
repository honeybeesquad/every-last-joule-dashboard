/**
 * Canonical region tier determines rendering and cadence treatment.
 *
 * The three live sub-tiers reflect rate-derivation provenance (B4 Option B,
 * locked 2026-04-25 in `docs/proposals/b4-option-b-decision.md`):
 *
 *   "live"                       — TSO publishes hourly + own-jurisdiction
 *                                  calibration rate (T1a, ±15%)
 *   "live-domestic-anchored"     — TSO publishes hourly + domestic stat-
 *                                  agency rate or modelled-share split
 *                                  (T1b, ±50% empirical post-B1 rerun)
 *   "live-neighbour-anchored"    — TSO publishes hourly + rate is
 *                                  extrapolated from a neighbouring zone
 *                                  (T1c, ±35.5% empirical)
 *
 * For rendering, all three live sub-tiers behave identically. The
 * distinction is surfaced in the methodology page and the §2.5 / §5.2
 * paper tier table only.
 */
export type RegionTier =
  | "live"
  | "live-domestic-anchored"
  | "live-neighbour-anchored"
  | "static"
  | "flare";

/** The waste modality drives colouring (teal vs orange) and narrative. */
export type RegionKind = "solar" | "wind" | "hydro" | "geo" | "mixed" | "flare";

/** Freshness state of an upstream source or fallback snapshot. */
export type SourceStatus = "live" | "cached" | "degraded";

/**
 * Source provenance — orthogonal to RegionTier. Records what kind of upstream
 * link the region has, distinct from per-fetch freshness (`SourceStatus`) and
 * from confidence tier (`Region.tier` / `RegionData.confidenceTier`).
 *
 *   "verified"          snapshot value comes from a verified upstream feed
 *                       or anchor.
 *   "official-lead"     authoritative source exists and loader is wired or
 *                       scaffolded, but the live path is not producing usable
 *                       data (geoblocked, auth-gated, parser pending). The
 *                       emitted snapshot falls back to modelled or last-good.
 *   "modelled-fallback" no verified upstream link. Snapshot is a typical-shape
 *                       profile scaled to an anchor, or otherwise estimated.
 *
 * The "exclude" state from the methodology doc is intentionally NOT here: it
 * means the region is not in the canonical REGIONS list at all and therefore
 * never appears in `RegionData`. See
 * `docs/methodology/tier-classification-guide.md#source-provenance-orthogonal-to-tier`.
 */
export type SourceProvenance = "verified" | "official-lead" | "modelled-fallback";

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
  /**
   * Optional per-region declaration of upstream-link kind. Loaders propagate
   * this into the emitted `RegionData.sourceProvenance` so the CI tier-coherence
   * check can validate the (tier, sourceProvenance) pair at build time.
   * Unset = legacy region; treated as null in the snapshot.
   */
  sourceProvenance?: SourceProvenance;
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
  lastSuccessAt: string;   // ISO 8601 UTC when this snapshot was last refreshed successfully
  sourceNote?: string;     // optional provenance addendum
  /**
   * Indicates whether the current payload came from a live fetch,
   * a recent fallback snapshot, or a stale fallback snapshot.
   * Surfaced in the methodology page so readers can see freshness.
   * Distinct from `sourceProvenance`, which records the kind of
   * upstream link the region has (provenance, not freshness).
   */
  sourceStatus?: SourceStatus;
  /**
   * Per-region declaration of upstream-link kind, propagated from
   * the canonical Region declaration. Orthogonal to `confidenceTier`.
   * The `(confidenceTier, sourceProvenance)` pair is validated at build
   * time by `scripts/ci/check-source-provenance-coherence.ts`.
   * See `docs/methodology/tier-classification-guide.md#source-provenance-orthogonal-to-tier`.
   */
  sourceProvenance?: SourceProvenance;
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
   *   T1a-live-tso                     live feed + own-jurisdiction
   *                                    calibration rate, ±2σ from 5yr
   *                                    backfill (fallback ±15%)
   *   T1b-live-domestic-anchored       live feed + domestic stat-agency
   *                                    rate or modelled-share split
   *                                    (empirical ±50% post-B1 rerun)
   *   T1c-live-neighbour-anchored      live feed + neighbour-extrapolated
   *                                    rate (empirical ±35.5%)
   *   T2-annual-calibrated             static anchored to published annual
   *                                    (±20%)
   *   T3-modelled                      static with typical-shape profile
   *                                    (±40%)
   *   T4-structural-gap                reserved; not emitted in RegionData
   *
   * The pre-2026-04-25 single label "T1-live-TSO" is retained as an alias
   * mapped from `regionTier === "live"` for backward compatibility with
   * older snapshots; new emissions use the T1a/T1b/T1c labels.
   */
  confidenceTier?:
    | "T1-live-TSO"
    | "T1a-live-tso"
    | "T1b-live-domestic-anchored"
    | "T1c-live-neighbour-anchored"
    | "T2-annual-calibrated"
    | "T3-modelled"
    | "T4-structural-gap";
  /** Lower bound on peakGW (GW). peakGW - uncertaintyLowGW is the half-width when symmetric. */
  uncertaintyLowGW?: number;
  /** Upper bound on peakGW (GW). peakGW + uncertaintyHighGW is the upper half-width when symmetric. */
  uncertaintyHighGW?: number;
  /** Empirical standard deviation of historical annual peakGW, used for T1 2σ bounds. */
  observedStdGW?: number;
  /**
   * Optional hourly renewable generation profile (24 GW values, index = UTC hour).
   * Reserved in v1.0.0 for the two-output positioning: this dataset documents
   * BOTH gross renewable generation AND the curtailment fraction derived from it.
   * When present, exposes the gross renewable generation that the curtailment
   * estimate was computed against. Loaders populate this progressively across
   * v1.x; absence means the loader has not yet exposed generation as a
   * first-class field.
   */
  generationProfile?: number[];
  /** Trailing-30-day total renewable generation (TWh), companion to generationProfile. */
  generationTotalTWh?: number;
}

/** Network consumption and hashrate reference from Cambridge CBECI. */
export interface CBECIData {
  hashrateEHps: number;           // current network hashrate
  annualisedConsumptionTWh: number; // current network consumption
  lastUpdated: string;             // ISO 8601
  lastSuccessAt?: string;           // ISO 8601 UTC when this snapshot was last refreshed successfully
  sourceStatus?: SourceStatus;
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
