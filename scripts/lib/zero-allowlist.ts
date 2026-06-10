/**
 * Regions that legitimately produce all-zero live-tier profiles in the
 * rolling 30-day window. Extracted from scripts/validate-snapshots.ts
 * (seeded 2026-05-12, committee review DATA-3) so each exemption carries
 * an expiry: when `reviewBy` passes, `npm run validate` fails until a
 * human re-confirms the zero is legitimate and bumps the date — or
 * removes the entry / downgrades the region's tier.
 *
 * Adding an entry must remain a deliberate, reviewed action: the whole
 * point of the all-zero check is to surface silent upstream failure
 * (dead feed, expired token, parser drift) for everything NOT on this
 * list.
 */
export interface ZeroAllowlistEntry {
  regionId: string;
  /** ISO date the exemption was added. */
  addedDate: string;
  /** ISO date after which validation fails until re-confirmed. Inclusive. */
  reviewBy: string;
  /** Why the zero is believed legitimate. */
  note: string;
}

export const ZERO_ALLOWLIST: readonly ZeroAllowlistEntry[] = [
  {
    regionId: "aemo-tas-solar",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "Tasmania has ~0 GW utility solar; SEMIDISPATCHCAP almost never fires there.",
  },
  // Brazil ONS sub-state allocations: smaller states / "other" buckets
  // contribute near-zero after fuelShare splitting from the regional feed.
  {
    regionId: "brazil-maranhao-solar",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "ONS sub-state allocation; near-zero after fuelShare split.",
  },
  {
    regionId: "brazil-mg-wind",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "ONS sub-state allocation; near-zero after fuelShare split.",
  },
  {
    regionId: "brazil-sp-wind",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "ONS sub-state allocation; near-zero after fuelShare split.",
  },
  {
    regionId: "brazil-mt-wind",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "ONS sub-state allocation; near-zero after fuelShare split.",
  },
  {
    regionId: "brazil-mt-solar",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "ONS sub-state allocation; near-zero after fuelShare split.",
  },
  {
    regionId: "brazil-go-wind",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "ONS sub-state allocation; near-zero after fuelShare split.",
  },
  {
    regionId: "brazil-pr-wind",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "ONS sub-state allocation; near-zero after fuelShare split.",
  },
  {
    regionId: "brazil-pr-solar",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "ONS sub-state allocation; near-zero after fuelShare split.",
  },
  {
    regionId: "brazil-rs-solar",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "ONS sub-state allocation; near-zero after fuelShare split.",
  },
  {
    regionId: "brazil-other-solar",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "ONS 'other' bucket; near-zero after fuelShare split.",
  },
  {
    regionId: "serbia-solar",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "Demoted live→estimated 2026-06-06 (PR #119, EnC non-reporting); entry only matters if re-promoted — likely removable at review.",
  },
  {
    regionId: "bosnia-and-herzegovina",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "Small Balkan zone; limited renewable installed base; A75 legitimately zero for the window.",
  },
  {
    regionId: "north-macedonia-solar",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "Demoted live→estimated 2026-06-06 (PR #119, EnC non-reporting); entry only matters if re-promoted — likely removable at review.",
  },
  {
    regionId: "montenegro",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "Small Balkan zone; limited renewable installed base; A75 legitimately zero for the window.",
  },
  {
    regionId: "uruguay",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "ADME: very small grid; renewable curtailment frequently zero.",
  },
  // ENTSO-E small-grid wind zones where the A75 signal is structurally
  // below the 1 MW (0.001 GW) threshold — tiny installed wind capacity
  // or an acknowledged placeholder calibration rate.
  {
    regionId: "italy-north-zone-wind",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "Calibration rate 0.3% is an acknowledged placeholder; signal below 1 MW threshold.",
  },
  {
    regionId: "czech-republic-wind",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "Calibration rate 1% placeholder; signal below 1 MW threshold.",
  },
  {
    regionId: "slovenia-wind",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "Tiny installed wind capacity; signal below 1 MW threshold.",
  },
  {
    regionId: "slovakia-wind",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "Tiny installed wind capacity; signal below 1 MW threshold.",
  },
  {
    regionId: "moldova-wind",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "Tiny installed wind capacity; signal below 1 MW threshold.",
  },
  {
    regionId: "nyiso-rest-solar",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "EIA aggregates NYIS solar into 'other'; SUN fuel-type feed returns all-zero. Known data limitation, not parser failure.",
  },
  {
    regionId: "japan-okinawa",
    addedDate: "2026-06-07",
    reviewBy: "2026-09-07",
    note: "Very small island grid (~170 MW solar); curtailment minimal. Confirmed legitimate by 2026-06-07 live fetch (0.0000 GW peak).",
  },
];

export function zeroAllowlistIds(): ReadonlySet<string> {
  return new Set(ZERO_ALLOWLIST.map((e) => e.regionId));
}

/** Entries whose reviewBy date has passed (inclusive of the date itself). */
export function expiredZeroAllowlistEntries(now: Date): ZeroAllowlistEntry[] {
  return ZERO_ALLOWLIST.filter(
    (e) => new Date(`${e.reviewBy}T00:00:00Z`).getTime() <= now.getTime(),
  );
}
