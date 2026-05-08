import { describe, it, expect } from "vitest";
import {
  usdValueAtHour,
  usdValuePerYear,
  aggregateUsdAtHour,
  countNoPriceRegions,
  formatUsdPerHour,
  formatUsdPerYear,
  formatRegionUsdPerHour,
} from "../src/lib/price";
import type { RegionData, PriceData } from "../src/lib/types";

function makeRegionData(id: string, profile: number[]): RegionData {
  return {
    regionId: id,
    profile,
    latestProfile: null,
    totalTWh: 0,
    peakGW: Math.max(...profile, 0),
    lastUpdated: "2026-01-01T00:00:00Z",
    lastSuccessAt: "2026-01-01T00:00:00Z",
  };
}

function makeLivePriceData(regionId: string, priceProfileUSD: number[]): PriceData {
  return { regionId, priceTier: "live", priceProfileUSD };
}

function makeStaticPriceData(regionId: string, priceUSD: number): PriceData {
  return { regionId, priceTier: "static", priceUSD };
}

describe("usdValueAtHour — live tier", () => {
  it("multiplies price[h] × profile[h] × 1000 for the given UTC hour", () => {
    const profile = Array(24).fill(0);
    profile[10] = 2.0; // 2 GW = 2000 MW
    const rd = makeRegionData("a", profile);
    const priceProfile = Array(24).fill(0);
    priceProfile[10] = 50; // $50/MWh
    const pd = makeLivePriceData("a", priceProfile);
    // 50 USD/MWh × 2000 MW = 100,000 USD/h
    expect(usdValueAtHour(rd, pd, 10)).toBeCloseTo(100_000, 0);
  });

  it("returns 0 for hours with zero curtailment", () => {
    const rd = makeRegionData("a", Array(24).fill(0));
    const pd = makeLivePriceData("a", Array(24).fill(100));
    expect(usdValueAtHour(rd, pd, 12)).toBe(0);
  });

  it("returns 0 when priceProfileUSD is missing", () => {
    const rd = makeRegionData("a", Array(24).fill(2));
    const pd: PriceData = { regionId: "a", priceTier: "live" };
    expect(usdValueAtHour(rd, pd, 0)).toBe(0);
  });
});

describe("usdValueAtHour — static tier", () => {
  it("multiplies priceUSD × profile[h] × 1000 for a given hour", () => {
    const profile = Array(24).fill(0);
    profile[6] = 3.0; // 3 GW = 3000 MW
    const rd = makeRegionData("a", profile);
    const pd = makeStaticPriceData("a", 60); // $60/MWh
    // 60 USD/MWh × 3000 MW = 180,000 USD/h
    expect(usdValueAtHour(rd, pd, 6)).toBeCloseTo(180_000, 0);
  });

  it("returns 0 when priceUSD is missing", () => {
    const rd = makeRegionData("a", Array(24).fill(2));
    const pd: PriceData = { regionId: "a", priceTier: "static" };
    expect(usdValueAtHour(rd, pd, 0)).toBe(0);
  });
});

describe("usdValueAtHour — none tier", () => {
  it("returns 0 regardless of curtailment", () => {
    const rd = makeRegionData("a", Array(24).fill(5));
    const pd: PriceData = { regionId: "a", priceTier: "none" };
    expect(usdValueAtHour(rd, pd, 12)).toBe(0);
  });
});

describe("usdValuePerYear", () => {
  it("annualises the per-hour value by 8760", () => {
    const rd = makeRegionData("a", Array(24).fill(1)); // 1 GW = 1000 MW flat
    const pd = makeStaticPriceData("a", 50);
    // 50 USD/MWh × 1000 MW = 50,000 USD/h × 8760 = 438,000,000 USD/year
    expect(usdValuePerYear(rd, pd, 0)).toBeCloseTo(438_000_000, -3);
  });
});

describe("aggregateUsdAtHour", () => {
  it("sums USD values across all priced regions", () => {
    const regionData: Record<string, RegionData> = {
      a: makeRegionData("a", Array(24).fill(1)),  // 1 GW
      b: makeRegionData("b", Array(24).fill(2)),  // 2 GW
    };
    const priceData: Record<string, PriceData> = {
      a: makeStaticPriceData("a", 50),  // 50 × 1000 = 50,000 USD/h
      b: makeStaticPriceData("b", 80),  // 80 × 2000 = 160,000 USD/h
    };
    expect(aggregateUsdAtHour(regionData, priceData, 0)).toBeCloseTo(210_000, 0);
  });

  it("excludes regions with priceTier none from total", () => {
    const regionData: Record<string, RegionData> = {
      a: makeRegionData("a", Array(24).fill(1)),
      b: makeRegionData("b", Array(24).fill(5)),
    };
    const priceData: Record<string, PriceData> = {
      a: makeStaticPriceData("a", 50),
      b: { regionId: "b", priceTier: "none" },
    };
    expect(aggregateUsdAtHour(regionData, priceData, 0)).toBeCloseTo(50_000, 0);
  });

  it("returns 0 when no price data provided", () => {
    const regionData: Record<string, RegionData> = {
      a: makeRegionData("a", Array(24).fill(2)),
    };
    expect(aggregateUsdAtHour(regionData, {}, 0)).toBe(0);
  });
});

describe("countNoPriceRegions", () => {
  it("counts regions absent from priceData", () => {
    const regionData: Record<string, RegionData> = {
      a: makeRegionData("a", Array(24).fill(1)),
      b: makeRegionData("b", Array(24).fill(1)),
    };
    const priceData: Record<string, PriceData> = {
      a: makeStaticPriceData("a", 50),
    };
    expect(countNoPriceRegions(regionData, priceData)).toBe(1);
  });

  it("counts regions with priceTier none", () => {
    const regionData: Record<string, RegionData> = {
      a: makeRegionData("a", Array(24).fill(1)),
      b: makeRegionData("b", Array(24).fill(1)),
    };
    const priceData: Record<string, PriceData> = {
      a: makeStaticPriceData("a", 50),
      b: { regionId: "b", priceTier: "none" },
    };
    expect(countNoPriceRegions(regionData, priceData)).toBe(1);
  });
});

describe("formatUsdPerHour", () => {
  it("formats billions", () => expect(formatUsdPerHour(2_500_000_000)).toBe("$2.5B/h"));
  it("formats millions", () => expect(formatUsdPerHour(427_000_000)).toBe("$427M/h"));
  it("formats thousands", () => expect(formatUsdPerHour(85_000)).toBe("$85K/h"));
  it("formats sub-thousand", () => expect(formatUsdPerHour(500)).toBe("$500/h"));
});

describe("formatUsdPerYear", () => {
  it("formats trillions", () => expect(formatUsdPerYear(3_700_000_000_000)).toBe("$3.7T/year"));
  it("formats billions", () => expect(formatUsdPerYear(427_000_000_000)).toBe("$427B/year"));
  it("formats millions", () => expect(formatUsdPerYear(85_000_000)).toBe("$85M/year"));
});

describe("formatRegionUsdPerHour", () => {
  it("formats millions with one decimal", () => expect(formatRegionUsdPerHour(48_000_000)).toBe("$48.0M/h"));
  it("formats thousands", () => expect(formatRegionUsdPerHour(3_200)).toBe("$3K/h"));
  it("formats sub-thousand", () => expect(formatRegionUsdPerHour(500)).toBe("$500/h"));
});
