import { describe, it, expect } from "vitest";
import {
  ZERO_ALLOWLIST,
  zeroAllowlistIds,
  expiredZeroAllowlistEntries,
} from "../scripts/lib/zero-allowlist.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

describe("zero-allowlist structure", () => {
  it("every entry has well-formed ISO dates and a note", () => {
    for (const e of ZERO_ALLOWLIST) {
      expect(e.regionId, e.regionId).toMatch(/^[a-z0-9][a-z0-9-]*$/);
      expect(e.addedDate, e.regionId).toMatch(ISO_DATE);
      expect(e.reviewBy, e.regionId).toMatch(ISO_DATE);
      expect(e.note.length, e.regionId).toBeGreaterThan(10);
    }
  });

  it("reviewBy is strictly after addedDate", () => {
    for (const e of ZERO_ALLOWLIST) {
      expect(
        new Date(e.reviewBy).getTime(),
        e.regionId,
      ).toBeGreaterThan(new Date(e.addedDate).getTime());
    }
  });

  it("regionIds are unique", () => {
    const ids = ZERO_ALLOWLIST.map((e) => e.regionId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("zeroAllowlistIds returns a Set covering every entry", () => {
    const ids = zeroAllowlistIds();
    expect(ids.size).toBe(ZERO_ALLOWLIST.length);
    expect(ids.has("aemo-tas-solar")).toBe(true);
    expect(ids.has("japan-okinawa")).toBe(true);
  });
});

describe("expiry logic", () => {
  it("entries are not expired one day before reviewBy", () => {
    for (const e of ZERO_ALLOWLIST) {
      const dayBefore = new Date(`${e.reviewBy}T00:00:00Z`);
      dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
      expect(
        expiredZeroAllowlistEntries(dayBefore).map((x) => x.regionId),
        e.regionId,
      ).not.toContain(e.regionId);
    }
  });

  it("all entries expired far in the future", () => {
    expect(
      expiredZeroAllowlistEntries(new Date("2099-01-01T00:00:00Z")).length,
    ).toBe(ZERO_ALLOWLIST.length);
  });

  it("expiry boundary is inclusive of the reviewBy date", () => {
    const first = ZERO_ALLOWLIST[0];
    const onTheDay = new Date(`${first.reviewBy}T00:00:00Z`);
    expect(
      expiredZeroAllowlistEntries(onTheDay).map((e) => e.regionId),
    ).toContain(first.regionId);
  });
});
