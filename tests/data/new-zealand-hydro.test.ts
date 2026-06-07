import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import { parseEmiNodalCsv, buildNzHydroData } from "../../src/data/new-zealand-hydro.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
const csv = readFileSync(join(__dirname, "../fixtures/new-zealand-nodal-sample.csv"), "utf8");

describe("parseEmiNodalCsv", () => {
  it("returns one hourly point with mw=305 from the fixture (TP1+TP2 merge, XYZ excluded)", () => {
    const points = parseEmiNodalCsv(csv, "2026-01-01");
    // Included (hydro prefix + price ≤ 0):
    //   BEN2201 TP1 200 MW, BEN2201 TP2 180 MW, BEN2202 TP1 100 MW,
    //   TKU2201 TP1 80 MW, WAI2201 TP1 50 MW
    // TP1 UTC = 2025-12-31T12:00Z; TP2 UTC = 2025-12-31T12:30Z → same hour
    // Bucket: (200+100+80+50)×0.5 + 180×0.5 = 215+90 = 305
    expect(points).toHaveLength(1);
    expect(points[0].utcTimestamp).toBe("2025-12-31T12:00:00.000Z");
    expect(points[0].mw).toBe(305);
  });

  it("excludes non-hydro nodes (XYZ prefix) even at strongly negative price", () => {
    // XYZ9999 has -$5/MWh but is not a hydro corridor node
    const points = parseEmiNodalCsv(csv, "2026-01-01");
    // If XYZ was included: extra 999×0.5 = 499.5 → total would be >800
    expect(points.reduce((s, p) => s + p.mw, 0)).toBeLessThan(500);
  });

  it("excludes rows with positive price", () => {
    // BEN2201 TP3 (price=10.00) and TKU2201 TP2 (price=5.00) are excluded.
    // TP3 maps to a different UTC hour (13:00Z), so its inclusion would
    // add a second point.
    const points = parseEmiNodalCsv(csv, "2026-01-01");
    expect(points).toHaveLength(1);
  });

  it("returns empty array for header-only CSV", () => {
    const empty = "PointOfConnectionCode,TradingPeriodNumber,DollarsPerMegawattHour,GenerationMegawatts,LoadMegawatts\n";
    expect(parseEmiNodalCsv(empty, "2026-01-01")).toHaveLength(0);
  });
});

describe("buildNzHydroData", () => {
  it("returns a RegionData with correct regionId, 24-element profile, and positive peakGW", () => {
    const points = parseEmiNodalCsv(csv, "2026-01-01");
    const data = buildNzHydroData(points);
    expect(data.regionId).toBe("new-zealand-hydro");
    expect(data.profile).toHaveLength(24);
    expect(data.peakGW).toBeGreaterThan(0);
    expect(data.totalTWh).toBeGreaterThanOrEqual(0);
  });
});
