import { describe, expect, it } from "vitest";

import { completeLocalDays } from "../src/lib/local-days";

describe("completeLocalDays", () => {
  it("ends yesterday in the local zone, oldest first", () => {
    // 04:00 UTC on the 18th is 22:00 on the 17th at UTC−6, so "yesterday" is the 16th.
    expect(completeLocalDays(new Date("2026-11-18T04:00:00Z"), -6, 3)).toEqual(["2026-11-14", "2026-11-15", "2026-11-16"]);
    // 06:00 UTC on the 18th is 00:00 on the 18th at UTC−6, so the 17th is complete.
    expect(completeLocalDays(new Date("2026-11-18T06:00:00Z"), -6, 1)).toEqual(["2026-11-17"]);
  });

  it("crosses month and year boundaries", () => {
    expect(completeLocalDays(new Date("2027-01-02T12:00:00Z"), -4, 3)).toEqual(["2026-12-30", "2026-12-31", "2027-01-01"]);
  });

  it("works east of Greenwich", () => {
    // 20:00 UTC on the 17th is 08:00 on the 18th at UTC+12.
    expect(completeLocalDays(new Date("2026-11-17T20:00:00Z"), 12, 1)).toEqual(["2026-11-17"]);
  });

  it("rejects a non-positive or fractional day count", () => {
    expect(() => completeLocalDays(new Date(), -6, 0)).toThrow(/positive integer/);
    expect(() => completeLocalDays(new Date(), -6, 1.5)).toThrow(/positive integer/);
  });
});
