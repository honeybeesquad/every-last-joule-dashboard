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
  /** ISO date on or after which validation fails until re-confirmed. */
  reviewBy: string;
  /** Why the zero is believed legitimate. */
  note: string;
}

export const ZERO_ALLOWLIST: readonly ZeroAllowlistEntry[] = [
  // Germany netztransparenz measured curtailment: renewable redispatch is concentrated
  // in the northern 50Hertz/TenneT zones; Amprion (W/inland Germany) measures ~0 renewable
  // curtailment (confirmed across May-2025 + May-2026 windows). Measured-zero is accurate,
  // NOT a dead feed — the loader picks up nonzero data in windier months. reviewBy is set
  // post-winter to re-confirm Amprion stays low through a high-wind season.
  {
    regionId: "germany-amprion-wind",
    addedDate: "2026-06-25",
    reviewBy: "2026-12-25",
    note: "netztransparenz measured: Amprion (W Germany) has negligible renewable redispatch curtailment; ~0 confirmed across May 2025 + May 2026. Curtailment concentrates in 50Hertz/TenneT (north).",
  },
  {
    regionId: "germany-amprion-solar",
    addedDate: "2026-06-25",
    reviewBy: "2026-12-25",
    note: "netztransparenz measured: Amprion (W Germany) has negligible renewable redispatch curtailment; ~0 confirmed across May 2025 + May 2026. Curtailment concentrates in 50Hertz/TenneT (north).",
  },
  {
    regionId: "aemo-tas-solar",
    addedDate: "2026-05-12",
    reviewBy: "2027-03-01",
    note: "Tasmania has ~0 GW utility solar; SEMIDISPATCHCAP almost never fires there. Re-confirmed 2026-09-05: AEMO feed alive — 9 of 10 AEMO regions carry positive signal in the same snapshot, so the TAS-solar zero is structural, not a dead feed. reviewBy set past the southern-hemisphere summer solar peak (Dec-Feb).",
  },
  // Rye Park Wind (NSW): the only one of the 10 AEMO per-plant regions with no
  // curtailment in the window. Unlike the other nine this is a *capped but not
  // constrained* zero — SEMIDISPATCHCAP fires, but UIGF never exceeds
  // TOTALCLEARED, so the measured curtailment is genuinely nil. Added 2026-09-06
  // with the loader change that stopped dropping sub-threshold plants.
  {
    regionId: "aemo-ryepark1-wind",
    addedDate: "2026-09-06",
    reviewBy: "2027-02-15",
    note: "NEMWEB feed verified live for this DUID, not merely for its parent: RYEPARK1 appears in all 30 daily Next_Day_Dispatch CSVs (8,640 dispatch intervals, 176 of them at SEMIDISPATCHCAP=1) over the window ending 2026-09-05, and 9 of the 10 aemo-per-plant regions carry positive signal in the same snapshot. On every capped interval UIGF − TOTALCLEARED ≤ 0, so zero is the measured reading, not a dead feed. reviewBy is set past the southern-hemisphere spring/summer negative-price season (Sep-Feb) when NSW wind curtailment peaks. If Rye Park starts carrying signal, REMOVE this entry rather than bumping it — an allowlist entry on a region that normally curtails suppresses the silent-failure alarm the gate exists to raise (the lesson of the 2026-09-05 review).",
  },
  // Brazil ONS sub-state allocations: smaller states / "other" buckets
  // contribute near-zero after fuelShare splitting from the regional feed.
  {
    regionId: "brazil-maranhao-solar",
    addedDate: "2026-05-12",
    reviewBy: "2027-02-01",
    note: "ONS sub-state allocation; near-zero after fuelShare split. Re-confirmed 2026-09-05: ONS feed alive — 18 of 28 brazil-ne regions carry positive signal in the same snapshot, so these sub-state zeros are allocation artefacts, not a dead feed.",
  },
  {
    regionId: "brazil-mg-wind",
    addedDate: "2026-05-12",
    reviewBy: "2027-02-01",
    note: "ONS sub-state allocation; near-zero after fuelShare split. Re-confirmed 2026-09-05: ONS feed alive — 18 of 28 brazil-ne regions carry positive signal in the same snapshot, so these sub-state zeros are allocation artefacts, not a dead feed.",
  },
  {
    regionId: "brazil-sp-wind",
    addedDate: "2026-05-12",
    reviewBy: "2027-02-01",
    note: "ONS sub-state allocation; near-zero after fuelShare split. Re-confirmed 2026-09-05: ONS feed alive — 18 of 28 brazil-ne regions carry positive signal in the same snapshot, so these sub-state zeros are allocation artefacts, not a dead feed.",
  },
  {
    regionId: "brazil-mt-wind",
    addedDate: "2026-05-12",
    reviewBy: "2027-02-01",
    note: "ONS sub-state allocation; near-zero after fuelShare split. Re-confirmed 2026-09-05: ONS feed alive — 18 of 28 brazil-ne regions carry positive signal in the same snapshot, so these sub-state zeros are allocation artefacts, not a dead feed.",
  },
  {
    regionId: "brazil-mt-solar",
    addedDate: "2026-05-12",
    reviewBy: "2027-02-01",
    note: "ONS sub-state allocation; near-zero after fuelShare split. Re-confirmed 2026-09-05: ONS feed alive — 18 of 28 brazil-ne regions carry positive signal in the same snapshot, so these sub-state zeros are allocation artefacts, not a dead feed.",
  },
  {
    regionId: "brazil-go-wind",
    addedDate: "2026-05-12",
    reviewBy: "2027-02-01",
    note: "ONS sub-state allocation; near-zero after fuelShare split. Re-confirmed 2026-09-05: ONS feed alive — 18 of 28 brazil-ne regions carry positive signal in the same snapshot, so these sub-state zeros are allocation artefacts, not a dead feed.",
  },
  {
    regionId: "brazil-pr-wind",
    addedDate: "2026-05-12",
    reviewBy: "2027-02-01",
    note: "ONS sub-state allocation; near-zero after fuelShare split. Re-confirmed 2026-09-05: ONS feed alive — 18 of 28 brazil-ne regions carry positive signal in the same snapshot, so these sub-state zeros are allocation artefacts, not a dead feed.",
  },
  {
    regionId: "brazil-pr-solar",
    addedDate: "2026-05-12",
    reviewBy: "2027-02-01",
    note: "ONS sub-state allocation; near-zero after fuelShare split. Re-confirmed 2026-09-05: ONS feed alive — 18 of 28 brazil-ne regions carry positive signal in the same snapshot, so these sub-state zeros are allocation artefacts, not a dead feed.",
  },
  {
    regionId: "brazil-rs-solar",
    addedDate: "2026-05-12",
    reviewBy: "2027-02-01",
    note: "ONS sub-state allocation; near-zero after fuelShare split. Re-confirmed 2026-09-05: ONS feed alive — 18 of 28 brazil-ne regions carry positive signal in the same snapshot, so these sub-state zeros are allocation artefacts, not a dead feed.",
  },
  {
    regionId: "brazil-other-solar",
    addedDate: "2026-05-12",
    reviewBy: "2027-02-01",
    note: "ONS 'other' bucket; near-zero after fuelShare split. Re-confirmed 2026-09-05: ONS feed alive — 18 of 28 brazil-ne regions carry positive signal in the same snapshot, so these sub-state zeros are allocation artefacts, not a dead feed.",
  },
  {
    regionId: "bosnia-and-herzegovina",
    addedDate: "2026-05-12",
    reviewBy: "2027-03-15",
    note: "Small Balkan zone; limited renewable installed base; A75 legitimately zero for the window. Re-confirmed 2026-09-05: ENTSO-E feed alive — 52 of 54 zones carry positive signal in the same snapshot.",
  },
  {
    regionId: "montenegro",
    addedDate: "2026-05-12",
    reviewBy: "2027-03-15",
    note: "Small Balkan zone; limited renewable installed base; A75 legitimately zero for the window. Re-confirmed 2026-09-05: ENTSO-E feed alive — 52 of 54 zones carry positive signal in the same snapshot.",
  },
  {
    regionId: "uruguay",
    addedDate: "2026-05-12",
    reviewBy: "2027-01-31",
    note: "ADME: very small grid; renewable curtailment frequently zero. Re-confirmed 2026-09-05 by a live loader run: adme.com.uy returned HTTP 200, the loader parsed the 2026-08 Restricciones Operativas workbook and emitted sourceStatus=live with peakGW 0. Zero is the true reading, not a dead feed.",
  },
  {
    regionId: "nyiso-rest-solar",
    addedDate: "2026-05-12",
    reviewBy: "2027-04-01",
    note: "EIA aggregates NYIS solar into 'other'; SUN fuel-type feed returns all-zero. Known data limitation, not parser failure. Re-confirmed 2026-09-05: sibling nyiso-rest-wind carries positive signal from the same feed, so the NYISO fetch is alive.",
  },
  {
    regionId: "japan-okinawa",
    addedDate: "2026-06-07",
    reviewBy: "2027-04-15",
    note: "Very small island grid (~170 MW solar); curtailment minimal. Confirmed legitimate by 2026-06-07 live fetch (0.0000 GW peak). Re-confirmed 2026-09-05: eria_jukyu feed alive — 11 of 12 Japan areas carry positive signal in the same snapshot.",
  },
  // Chubu reads zero because OCCTO curtailment is strongly seasonal (spring
  // peak, mid-year ~0), not because the feed is dead. The 2026-08-20 fix
  // restored the fetch after Chuden began deleting standalone monthly CSVs
  // once republished into the yearly archive; the recovered August file
  // parses 922 rows with zero curtailment throughout. reviewBy lands in the
  // autumn shoulder, when a persistent zero would no longer be explicable
  // by season and should be re-diagnosed rather than re-exempted.
  {
    regionId: "japan-chubu",
    addedDate: "2026-08-20",
    reviewBy: "2026-11-20",
    note: "OCCTO eria_jukyu seasonality: curtailment peaks in spring and sits at ~0 mid-year. Fetch confirmed healthy 2026-08-20 (922 August rows parsed, zero curtailment throughout) after the yearly-zip fallback landed.",
  },
  // NZ hydro reads zero because the ≤$0/MWh nodal-price proxy almost never
  // fires, not because the feed is dead: the 2026-08-01 live fetch parsed
  // 32/33 EMI daily files (~5,700 hydro rows/day) and found no ≤$0 half-hours.
  // Nine months of EMI FinalEnergyPrices (2025-10 → 2026-06) hit ≤$0 at these
  // nodes on one day only (2025-11), flooring at $0.010 otherwise. reviewBy is
  // set past the Oct–Dec high-inflow season — the window the single historical
  // ≤$0 event fell in — so a spring with genuine spill forces a re-confirm.
  {
    regionId: "new-zealand-hydro",
    addedDate: "2026-08-01",
    reviewBy: "2027-01-15",
    note: "EMI ≤$0/MWh proxy is a floor, not a measure: feed verified live (32/33 daily files parsed 2026-08-01) but ≤$0 hydro prices occurred on 1 day in the 9 months 2025-10 → 2026-06. Zero is the true reading, not a dead feed.",
  },
];

export function zeroAllowlistIds(): ReadonlySet<string> {
  return new Set(ZERO_ALLOWLIST.map((e) => e.regionId));
}

/** Entries whose reviewBy date has passed (inclusive of the date itself). */
export function expiredZeroAllowlistEntries(now: Date): ZeroAllowlistEntry[] {
  return ZERO_ALLOWLIST.filter((e) => {
    const t = new Date(`${e.reviewBy}T00:00:00Z`).getTime();
    if (!Number.isFinite(t)) {
      throw new Error(
        `zero-allowlist: invalid reviewBy "${e.reviewBy}" on "${e.regionId}"`,
      );
    }
    return t <= now.getTime();
  });
}
