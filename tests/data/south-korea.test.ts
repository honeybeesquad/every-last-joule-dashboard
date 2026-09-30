import { inspect } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSouthKoreaData, parseKpxPvItems } from "../../src/data/south-korea.json";

// Anchored constants (must stay in sync with src/data/south-korea.json.ts).
// Curtailed = Ember/OWID 2025 generation × published 2024 rate (MDPI/IEA).
const SOLAR_GEN_TWH = 37.80;
const SOLAR_RATE = 0.032;
const WIND_GEN_TWH = 3.64;
const WIND_RATE = 0.041;
const SOLAR_CURTAILED_TWH = Math.round(SOLAR_GEN_TWH * SOLAR_RATE * 1000) / 1000; // 1.210
const WIND_CURTAILED_TWH = Math.round(WIND_GEN_TWH * WIND_RATE * 1000) / 1000; // 0.149

describe("south-korea loader", () => {
  it("returns valid positive solar + wind RegionData (mainland anchor)", async () => {
    const { solar, wind } = await buildSouthKoreaData();

    expect(solar.regionId).toBe("south-korea-solar");
    expect(solar.profile).toHaveLength(24);
    expect(solar.latestProfile).toBeNull();
    expect(solar.totalTWh).toBeGreaterThan(0);
    expect(solar.peakGW).toBeGreaterThan(0);
    expect(solar.sourceNote).toContain("mainland");
    // Forensic honesty check: solar must read 0 at local night (KST midnight = 15 UTC).
    expect(solar.profile[15]).toBe(0);
    // Curtailed energy must equal generation × published rate (annualised from 30d window).
    expect(solar.totalTWh * 365 / 30).toBeCloseTo(SOLAR_CURTAILED_TWH, 3);

    expect(wind.regionId).toBe("south-korea-wind");
    expect(wind.profile).toHaveLength(24);
    expect(wind.totalTWh).toBeGreaterThan(0);
    expect(wind.peakGW).toBeGreaterThan(0);
    expect(wind.sourceNote).toContain("mainland");
    expect(wind.totalTWh * 365 / 30).toBeCloseTo(WIND_CURTAILED_TWH, 3);
  });

  it("parses PvAmountByLocHr items into KST→UTC points", () => {
    const points = parseKpxPvItems({
      response: {
        body: {
          items: {
            item: [
              { ymd: "20260919", hh: "12", pvAmount: 1500 },
              { ymd: "20260919", hh: "13", pvAmount: 1400 },
            ],
          },
        },
      },
    });
    expect(points[0].utcTimestamp).toBe("2026-09-19T03:00:00.000Z");
    expect(points[0].mw).toBe(1500);
  });
});

describe("south-korea loader: a KPX request that fails", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // data.go.kr takes the service key in the query string, fetchJSON quotes the
  // request URL in its error, and the loader publishes that error in both
  // regions' served sourceNote and logs it.
  it("neither publishes nor logs the service key", async () => {
    const key = "test-dummy-kpx-service-key";
    vi.stubEnv("DATA_GO_KR_SERVICE_KEY", key);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("denied", { status: 403, statusText: "Forbidden" })));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    // fetchJSON waits a second between its two tries.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    const pending = buildSouthKoreaData();
    await vi.runAllTimersAsync();
    const { solar, wind } = await pending;

    for (const region of [solar, wind]) {
      expect(region.sourceNote).toContain(
        "HTTP 403 Forbidden for https://apis.data.go.kr/B552115/PvAmountByLocHr/getPvAmountByLocHr?serviceKey=REDACTED&pageNo=1",
      );
      expect(region.sourceNote).not.toContain(key);
    }
    expect(logged).toHaveBeenCalled();
    expect(inspect(logged.mock.calls, { depth: 5 })).not.toContain(key);
  });
});
