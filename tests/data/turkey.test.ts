import { describe, it, expect, beforeAll } from "vitest";

let buildTurkeyData: any;
let parseEpiasDashboard: any;
let TURKEY_CURTAILMENT_RATE: number;

const fixture = {
  latestUpdateTime: "2026-04-24T05:35:05.082+03:00",
  items: [
    {
      date: "2026-04-24T00:00:00+03:00",
      hour: "00:00",
      wind: 2510.43,
      sun: 0.01,
    },
    {
      date: "2026-04-24T01:00:00+03:00",
      hour: "01:00",
      wind: 2381.62,
      sun: 0.01,
    },
    {
      date: "2026-04-24T02:00:00+03:00",
      hour: "02:00",
      wind: 2260.15,
      sun: 18.4,
    },
  ],
};

describe("turkey EPIAS dashboard loader", () => {
  beforeAll(async () => {
    const module = await import("../../src/data/turkey.json.js");
    buildTurkeyData = module.buildTurkeyData;
    parseEpiasDashboard = module.parseEpiasDashboard;
    TURKEY_CURTAILMENT_RATE = module.TURKEY_CURTAILMENT_RATE;
  });

  it("parses EPIAS wind + solar dashboard rows into calibrated curtailment points", () => {
    const { points, windMwTotal, solarMwTotal } = parseEpiasDashboard(fixture);
    expect(points).toHaveLength(3);
    expect(points[0].utcTimestamp).toBe("2026-04-23T21:00:00.000Z");
    expect(points[0].mw).toBeCloseTo((2510.43 + 0.01) * TURKEY_CURTAILMENT_RATE, 5);
    expect(windMwTotal).toBeCloseTo(7152.2, 1);
    expect(solarMwTotal).toBeCloseTo(18.42, 2);
  });

  it("builds RegionData with 24 profile buckets and null latestProfile for partial current day", () => {
    const data = buildTurkeyData(fixture);
    expect(data.regionId).toBe("turkey");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.peakGW).toBeGreaterThan(0);
    expect(data.sourceNote).toContain("0.8%");
  });

  it("emits observed wind-dominant fuel share", () => {
    const data = buildTurkeyData(fixture);
    expect(data.fuelShare.wind).toBeGreaterThan(0.99);
    expect(data.fuelShare.solar).toBeGreaterThan(0);
  });
});
