import { describe, it, expect } from "vitest";
import { ehsFromGW, aggregateAtHour, perHourAggregate } from "../src/lib/calc";
import type { RegionData, CBECIData } from "../src/lib/types";

const cbeci: CBECIData = {
  hashrateEHps: 1000,
  annualisedConsumptionTWh: 138,
  lastUpdated: "2026-04-22T00:00:00Z"
};

function makeRegionData(id: string, profile: number[]): RegionData {
  return {
    regionId: id,
    profile,
    totalTWh: 0,
    peakGW: Math.max(...profile, 0),
    lastUpdated: "2026-04-22T00:00:00Z"
  };
}

describe("ehsFromGW", () => {
  it("1 GW at 16 J/TH = 62.5 EH/s", () => {
    expect(ehsFromGW(1, 16)).toBeCloseTo(62.5, 3);
  });

  it("at 15 J/TH (2028 projection) 1 GW = 66.67 EH/s", () => {
    expect(ehsFromGW(1, 15)).toBeCloseTo(66.667, 2);
  });

  it("0 GW yields 0", () => {
    expect(ehsFromGW(0, 16)).toBe(0);
  });
});

describe("aggregateAtHour", () => {
  it("sums per-region GW for the given UTC hour", () => {
    const data: Record<string, RegionData> = {
      a: makeRegionData("a", Array(24).fill(2)),
      b: makeRegionData("b", Array(24).fill(3))
    };
    const result = aggregateAtHour(data, cbeci, 0);
    expect(result.totalGW).toBe(5);
    expect(result.utcHour).toBe(0);
  });

  it("computes hashrate in EH/s at 16 J/TH", () => {
    const data: Record<string, RegionData> = {
      a: makeRegionData("a", Array(24).fill(4))
    };
    const result = aggregateAtHour(data, cbeci, 12);
    expect(result.totalGW).toBe(4);
    expect(result.hashrateEHps).toBeCloseTo(250, 1); // 4 GW * 62.5 = 250 EH/s
  });

  it("computes pctOfNetwork from CBECI hashrate", () => {
    const data: Record<string, RegionData> = {
      a: makeRegionData("a", Array(24).fill(4))
    };
    const result = aggregateAtHour(data, cbeci, 12);
    expect(result.pctOfNetwork).toBeCloseTo(25.0, 1); // 250 EH/s / 1000 EH/s = 25%
  });

  it("exposes per-region GW at that hour", () => {
    const profileA = Array(24).fill(0);
    profileA[10] = 5;
    const data: Record<string, RegionData> = {
      a: makeRegionData("a", profileA),
      b: makeRegionData("b", Array(24).fill(1))
    };
    const result = aggregateAtHour(data, cbeci, 10);
    expect(result.perRegionGW.a).toBe(5);
    expect(result.perRegionGW.b).toBe(1);
  });
});

describe("perHourAggregate", () => {
  it("returns 24 AggregateResults, one per UTC hour", () => {
    const data: Record<string, RegionData> = {
      a: makeRegionData("a", Array(24).fill(2))
    };
    const results = perHourAggregate(data, cbeci);
    expect(results.length).toBe(24);
    expect(results[0].utcHour).toBe(0);
    expect(results[23].utcHour).toBe(23);
  });
});
