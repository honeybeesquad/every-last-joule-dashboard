import { describe, expect, it } from "vitest";
import {
  DEPLOY_STALE_AFTER_HOURS,
  deployFreshness,
  formatAge,
  formatUtcStamp,
  relayFreshness,
  RELAY_STALENESS_THRESHOLD_DAYS,
} from "../src/lib/freshness.js";

// Fixed "now" for deterministic tests: 2026-06-07T12:00:00Z
const NOW = new Date("2026-06-07T12:00:00Z");

describe("RELAY_STALENESS_THRESHOLD_DAYS", () => {
  it("is exported as 4", () => {
    expect(RELAY_STALENESS_THRESHOLD_DAYS).toBe(4);
  });
});

describe("relayFreshness", () => {
  it("returns 'live' when the date is within the threshold", () => {
    // 1 day ago — well within 4-day threshold
    const fresh = "2026-06-06";
    expect(relayFreshness(fresh, NOW, RELAY_STALENESS_THRESHOLD_DAYS)).toBe("live");
  });

  it("returns 'live' when the date is same day as now", () => {
    const today = "2026-06-07";
    expect(relayFreshness(today, NOW, RELAY_STALENESS_THRESHOLD_DAYS)).toBe("live");
  });

  it("returns 'live' when the date is exactly at the threshold boundary", () => {
    // Exactly 4 days ago in full ISO timestamp form: ageMs === thresholdDays * ms exactly.
    // The condition is ageMs > threshold * ms, which is false at exact equality → returns "live".
    const boundaryDate = new Date(NOW.getTime() - RELAY_STALENESS_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
    const iso = boundaryDate.toISOString(); // full ISO timestamp, not date-only
    expect(relayFreshness(iso, NOW, RELAY_STALENESS_THRESHOLD_DAYS)).toBe("live");
  });

  it("returns 'degraded' when the date is older than the threshold", () => {
    // 5 days ago — older than 4-day threshold
    const stale = "2026-06-02";
    expect(relayFreshness(stale, NOW, RELAY_STALENESS_THRESHOLD_DAYS)).toBe("degraded");
  });

  it("returns 'degraded' when the date is much older than the threshold", () => {
    // 30 days ago
    const veryStale = "2026-05-08";
    expect(relayFreshness(veryStale, NOW, RELAY_STALENESS_THRESHOLD_DAYS)).toBe("degraded");
  });

  it("returns 'degraded' when the date is null", () => {
    expect(relayFreshness(null, NOW, RELAY_STALENESS_THRESHOLD_DAYS)).toBe("degraded");
  });

  it("returns 'degraded' when the date is undefined", () => {
    expect(relayFreshness(undefined, NOW, RELAY_STALENESS_THRESHOLD_DAYS)).toBe("degraded");
  });

  it("returns 'degraded' when the date is an empty string", () => {
    expect(relayFreshness("", NOW, RELAY_STALENESS_THRESHOLD_DAYS)).toBe("degraded");
  });

  it("returns 'degraded' when the date is a garbage string", () => {
    expect(relayFreshness("not-a-date", NOW, RELAY_STALENESS_THRESHOLD_DAYS)).toBe("degraded");
  });

  it("returns 'degraded' when the date is 'unknown'", () => {
    expect(relayFreshness("unknown", NOW, RELAY_STALENESS_THRESHOLD_DAYS)).toBe("degraded");
  });

  it("respects a custom threshold", () => {
    // 3 days ago
    const threeDaysAgo = "2026-06-04";
    // With threshold=2, 3 days ago is stale
    expect(relayFreshness(threeDaysAgo, NOW, 2)).toBe("degraded");
    // With threshold=5, 3 days ago is fresh
    expect(relayFreshness(threeDaysAgo, NOW, 5)).toBe("live");
  });
});

describe("deployFreshness", () => {
  // The frozen deployment: built 24 Sep 04:42 UTC, still served on 27 Sep.
  const BUILT = "2026-09-24T04:42:46.349Z";

  it("is 26 hours", () => {
    expect(DEPLOY_STALE_AFTER_HOURS).toBe(26);
  });

  it("is fresh a few hours after a build", () => {
    const f = deployFreshness(BUILT, new Date("2026-09-24T09:42:46.349Z"));
    expect(f.ageHours).toBeCloseTo(5, 6);
    expect(f.stale).toBe(false);
  });

  it("is stale past the threshold, not at it", () => {
    expect(deployFreshness(BUILT, new Date("2026-09-25T06:42:46.349Z")).stale).toBe(false); // exactly 26 h
    expect(deployFreshness(BUILT, new Date("2026-09-25T06:43:46.349Z")).stale).toBe(true);
  });

  it("flags the 24–27 Sep freeze", () => {
    const f = deployFreshness(BUILT, new Date("2026-09-27T16:55:36Z"));
    expect(f.stale).toBe(true);
    expect(Math.round(f.ageHours ?? 0)).toBe(84);
  });

  it("treats a missing or unparseable build time as stale", () => {
    expect(deployFreshness(undefined, NOW)).toEqual({ ageHours: null, stale: true });
    expect(deployFreshness("not a date", NOW)).toEqual({ ageHours: null, stale: true });
  });

  it("clamps a build stamp slightly ahead of the viewer's clock to zero", () => {
    expect(deployFreshness("2026-06-07T12:05:00Z", NOW)).toEqual({ ageHours: 0, stale: false });
  });
});

describe("formatAge", () => {
  it("rounds down in minutes, hours, then days", () => {
    expect(formatAge(0)).toBe("1 min ago");
    expect(formatAge(0.5)).toBe("30 min ago");
    expect(formatAge(5.9)).toBe("5 h ago");
    expect(formatAge(47.9)).toBe("47 h ago");
    expect(formatAge(84.2)).toBe("3 days ago");
  });
});

describe("formatUtcStamp", () => {
  it("formats in UTC whatever the zone", () => {
    expect(formatUtcStamp("2026-09-24T04:42:46.349Z")).toBe("24 Sep 2026, 04:42 UTC");
    expect(formatUtcStamp("2026-09-27T20:05:00+13:00")).toBe("27 Sep 2026, 07:05 UTC");
  });

  it("returns null for an unparseable time", () => {
    expect(formatUtcStamp("nope")).toBeNull();
  });
});
