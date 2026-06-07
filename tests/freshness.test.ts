import { describe, expect, it } from "vitest";
import { relayFreshness, RELAY_STALENESS_THRESHOLD_DAYS } from "../src/lib/freshness.js";

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
