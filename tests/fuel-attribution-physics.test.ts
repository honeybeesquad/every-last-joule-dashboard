import { describe, it, expect } from "vitest";
import { REGIONS } from "../src/lib/regions";
import {
  FUEL_ORDER,
  fuelShare,
  fuelShareAtHour,
  dominantFuel,
  UNSPLIT_MIXED_FUEL,
} from "../src/lib/fuel";

/**
 * Three defects shipped together once, all of them producing a number that
 * cannot be true rather than a number that is merely uncertain. Each gets an
 * invariant here.
 */
describe("fuel attribution cannot state the impossible", () => {
  const localHour = (utc: number, lon: number) =>
    (((utc + lon / 15) % 24) + 24) % 24;
  const isDark = (utc: number, lon: number) =>
    localHour(utc, lon) < 6 || localHour(utc, lon) >= 19;

  it("never attributes solar curtailment while the sun is down", () => {
    const offenders: string[] = [];
    for (const region of REGIONS) {
      for (let utc = 0; utc < 24; utc += 1) {
        if (!isDark(utc, region.lon)) continue;
        if (fuelShareAtHour(region, "solar", utc) > 0) {
          offenders.push(`${region.id} @ ${utc}Z (local ${localHour(utc, region.lon).toFixed(1)})`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("leaves wind and hydro alone — they do run at night", () => {
    const night = REGIONS.find((r) => r.kind === "wind");
    expect(night).toBeDefined();
    const anyDark = [...Array(24).keys()].find((h) => isDark(h, night!.lon))!;
    expect(fuelShareAtHour(night!, "wind", anyDark)).toBe(
      fuelShare(night!, "wind"),
    );
  });

  it("never credits a single-fuel row to a different fuel", () => {
    // Split zones (Norway NO1-NO4, Belgium) carry the parent zone's combined
    // share on every child row. Applying it re-splits an already-split row
    // and double-counts the same volume across two fuel columns.
    const parentShare = { hydro: 0.75, wind: 0.25 };
    const offenders: string[] = [];
    for (const region of REGIONS) {
      if (region.kind === "mixed" || region.kind === "geo") continue;
      for (const fuel of FUEL_ORDER) {
        const share = fuelShare(region, fuel, { fuelShare: parentShare } as never);
        if (fuel !== region.kind && share > 0) {
          offenders.push(`${region.id} (${region.kind}) credited ${fuel} ${share}`);
        }
        if (fuel === region.kind && share !== 1) {
          offenders.push(`${region.id} (${region.kind}) own fuel only ${share}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("does not silently call an unsplit mixed region solar", () => {
    // FUEL_ORDER[0] is solar and dominantFuel used to seed bestShare at -1,
    // so a region with no split at all won on the first iteration. Georgia
    // is ~95% hydro by its own cited capacity and was drawn as solar.
    const unsplit = { id: "__no_split__", kind: "mixed", lon: 0 } as never;
    expect(dominantFuel(unsplit)).toBe(UNSPLIT_MIXED_FUEL);
    expect(UNSPLIT_MIXED_FUEL).not.toBe("solar");
  });

  it("gives every mixed region a split that sums to at most 1", () => {
    for (const region of REGIONS.filter((r) => r.kind === "mixed")) {
      const total = FUEL_ORDER.reduce((s, f) => s + fuelShare(region, f), 0);
      expect(total, `${region.id} split sums to ${total}`).toBeLessThanOrEqual(1.0001);
    }
  });
});
