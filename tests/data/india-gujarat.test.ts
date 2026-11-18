import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { buildIndiaGujaratData } from "../../src/data/india-gujarat.json";

describe("india-gujarat loader", () => {
  it("returns a valid positive RegionData shape with T2-annual-calibrated tier", async () => {
    const data = await buildIndiaGujaratData();
    expect(data.regionId).toBe("india-gujarat");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
    expect(data.confidenceTier).toBe("T2-annual-calibrated");
    expect(data.sourceProvenance).toBe("verified");
  });

  it("uncertainty bounds reflect ±20% T2 envelope", async () => {
    const data = await buildIndiaGujaratData();
    expect(data.uncertaintyLowGW).toBeGreaterThan(0);
    expect(data.uncertaintyHighGW).toBeGreaterThan(data.peakGW);
    expect(data.uncertaintyHighGW).toBeCloseTo(data.peakGW * 1.20, 4);
    expect(data.uncertaintyLowGW).toBeCloseTo(data.peakGW * 0.80, 4);
  });

  it("emits a flat 24/7 profile — the source gives daily energy, no intraday shape", async () => {
    const data = await buildIndiaGujaratData();
    const distinct = new Set(data.profile.map((v) => v.toFixed(9)));
    expect(distinct.size).toBe(1);
    expect(data.profile.every((v) => v > 0)).toBe(true);
  });

  it("magnitude matches the measured NLDC record, not the old Ember-rate estimate", async () => {
    const data = await buildIndiaGujaratData();
    // Measured: 1291 GWh across 602 published days -> ~783 GWh/yr.
    // The superseded CEA×Ember 3% path emitted ~1.41 TWh/yr (~1.8× high).
    const annualisedGwh = data.totalTWh * (365 / 30) * 1000;
    expect(annualisedGwh).toBeGreaterThan(600);
    expect(annualisedGwh).toBeLessThan(1000);
  });

  it("fuel split is measured and solar-dominated", async () => {
    const data = await buildIndiaGujaratData();
    expect(data.fuelShare?.solar).toBeGreaterThan(0.6);
    expect((data.fuelShare?.solar ?? 0) + (data.fuelShare?.wind ?? 0)).toBeCloseTo(1, 6);
  });
});

describe("india-gujarat NLDC CSV", () => {
  const csv = readFileSync(
    join(process.cwd(), "data/historical/india-gujarat-nldc-curtailed-daily.csv"),
    "utf-8",
  );
  const rows = csv.trim().split("\n").slice(1).map((line) => {
    const [date, wind, solar] = line.split(",");
    return { date, wind: Number(wind), solar: Number(solar) };
  });

  it("covers the published NLDC window including zeros", () => {
    expect(rows.length).toBeGreaterThanOrEqual(600);
    expect(rows[0].date).toBe("2025-01-01");
    // The Bangalore droplet regenerates this file daily from the published PDFs
    // (docs/ops/bangalore-nldc-relay.md), so the series grows by a day each run.
    // Pin a floor and a ceiling, not the end: an exact end date failed every relay
    // pull from 2026-10-21 and held Colombia, Gujarat and the abed heartbeat off main.
    const last = rows[rows.length - 1].date;
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    expect(last >= "2026-10-18", `last date ${last} rewound before 2026-10-18`).toBe(true);
    expect(last <= tomorrow, `last date ${last} is in the future`).toBe(true);
    const badDates = rows
      .filter((r, i) => !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || (i > 0 && r.date <= rows[i - 1].date))
      .map((r) => r.date);
    expect(badDates).toEqual([]);
    expect(rows.some((r) => r.wind + r.solar === 0)).toBe(true);
    expect(rows.some((r) => r.wind + r.solar > 0)).toBe(true);
  });

  it("does not treat the 2025 MU/MW column swap as energy", () => {
    const day = rows.find((r) => r.date === "2025-05-28");
    expect(day).toBeTruthy();
    expect(day!.wind).toBeCloseTo(0.251, 3);
    expect(day!.solar).toBeCloseTo(0.324, 3);
  });

  it("keeps daily energy physically below 24 h at a few GW", () => {
    for (const r of rows) {
      expect(r.wind + r.solar).toBeLessThan(40);
      expect(r.wind).toBeGreaterThanOrEqual(0);
      expect(r.solar).toBeGreaterThanOrEqual(0);
    }
  });
});
