import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { buildAesoProxyProfile, buildAesoProxyRegions, parseAesoCurrentReport } from "../../src/data/alberta.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(__dirname, "../fixtures/alberta-sample.html"), "utf8");

describe("alberta parser (AESO snapshot)", () => {
  it("extracts the report update timestamp", () => {
    const result = parseAesoCurrentReport(fixture);
    expect(result.lastUpdated).toContain("2026");
  });

  it("extracts wind and solar MW rows", () => {
    const result = parseAesoCurrentReport(fixture);
    expect(result.windMw).toBeGreaterThan(0);
    expect(result.solarMw).toBeGreaterThanOrEqual(0);
  });

  it("keeps the solar proxy out of Alberta night hours", () => {
    const windCurtMw = 50;
    const solarCurtMw = 50;
    const profile = buildAesoProxyProfile(windCurtMw, solarCurtMw);
    const windOnlyGW = windCurtMw / 1000;

    expect(profile).toHaveLength(24);
    expect(profile[6]).toBeCloseTo(windOnlyGW, 6);
    expect(profile[18]).toBeGreaterThan(windOnlyGW);
    expect(Math.max(...profile)).toBeGreaterThan(Math.min(...profile) * 2);
  });

  it("emits separate wind and solar regions rather than a bundled mixed row", () => {
    const regions = buildAesoProxyRegions({
      lastUpdated: "Apr 29, 2026 12:00",
      windMw: 1000,
      solarMw: 500,
    }, "2026-04-29T18:00:00.000Z");

    expect(Object.keys(regions).sort()).toEqual(["alberta-solar", "alberta-wind"]);
    expect(regions["alberta-wind"].regionId).toBe("alberta-wind");
    expect(regions["alberta-solar"].regionId).toBe("alberta-solar");
    expect(regions["alberta-wind"].fuelShare).toBeUndefined();
    expect(regions["alberta-solar"].fuelShare).toBeUndefined();
    expect(regions["alberta-solar"].profile[6]).toBeCloseTo(0, 6);
    expect(regions["alberta-solar"].profile[18]).toBeGreaterThan(0);
  });
});
