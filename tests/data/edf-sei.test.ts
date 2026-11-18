import { describe, expect, it } from "vitest";
import {
  SEI_TERRITORIES,
  buildSeiRegion,
  parseSeiRows,
  seiLinesUrl,
  type SeiRow,
  type SeiTerritory,
} from "../../src/data/edf-sei.json";
import { dominantFuel } from "../../src/lib/fuel";
import { REGIONS } from "../../src/lib/regions";
import { TSO_GRID_MARKER_IDS } from "../../src/lib/tso-grid-markers";
import { buildAllStatics } from "../../src/data/statics.json";

const corsica = SEI_TERRITORIES.find((t) => t.regionId === "corsica") as SeiTerritory;
const guiana = SEI_TERRITORIES.find((t) => t.regionId === "french-guiana") as SeiTerritory;

/** One local day at `stepMin` cadence, `offset` like "+01:00". */
function day(date: string, offset: string, stepMin: number, row: (hour: number) => SeiRow): SeiRow[] {
  const out: SeiRow[] = [];
  for (let m = 0; m < 24 * 60; m += stepMin) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    out.push({ date: `${date}T${hh}:${mm}:00${offset}`, ...row(Math.floor(m / 60)) });
  }
  return out;
}

const corsicaRow = () => ({ photovoltaique: 10, eolien: 2, hydraulique: 50, micro_hydro: 5, moteur_diesel: 80 });

describe("EDF SEI island grids", () => {
  it("covers the five territories, each a canonical estimated region off markers and statics", () => {
    expect(SEI_TERRITORIES.map((t) => t.regionId)).toEqual([
      "corsica",
      "reunion",
      "guadeloupe",
      "martinique",
      "french-guiana",
    ]);
    const statics = buildAllStatics();
    for (const t of SEI_TERRITORIES) {
      const region = REGIONS.find((r) => r.id === t.regionId);
      expect(region?.tier, t.regionId).toBe("estimated");
      expect(region?.sourceProvenance, t.regionId).toBe("official-lead");
      expect(region?.source, t.regionId).toMatch(/waste unpublished, no rate applied/);
      expect(region?.sourceUrl, t.regionId).toContain(t.host);
      expect(TSO_GRID_MARKER_IDS.has(t.regionId), `${t.regionId} still a marker`).toBe(false);
      expect(statics[t.regionId], `${t.regionId} still in statics`).toBeUndefined();
    }
  });

  it("reads only the fuels each territory has", () => {
    expect(seiLinesUrl(corsica)).toContain("select=date%2Cphotovoltaique%2Ceolien%2Chydraulique%2Cmicro_hydro");
    expect(seiLinesUrl(guiana)).toContain("select=date%2Cphotovoltaique%2Chydraulique");
    expect(SEI_TERRITORIES.find((t) => t.regionId === "martinique")?.fuels.hydro).toBeUndefined();
    expect(guiana.fuels.wind).toBeUndefined();
  });

  it("sums solar + wind + hydro, converts the local offset to UTC and ignores thermal", () => {
    const series = parseSeiRows(corsica, day("2026-11-17", "+01:00", 15, corsicaRow));
    expect(series.points).toHaveLength(96);
    expect(series.points[0].utcTimestamp).toBe("2026-11-16T23:00:00.000Z");
    expect(series.points[0].mw).toBe(67);
    expect(series.points[0].intervalHours).toBe(0.25);
    expect(series.meanMwByFuel.solar).toBeCloseTo(10, 9);
    expect(series.meanMwByFuel.wind).toBeCloseTo(2, 9);
    expect(series.meanMwByFuel.hydro).toBeCloseTo(55, 9);
  });

  it("emits generation with unpublished, zero waste and a mean × 30 days total", () => {
    const data = buildSeiRegion(corsica, day("2026-11-17", "+01:00", 15, corsicaRow));
    expect(data.regionId).toBe("corsica");
    expect(data.wasteStatus).toBe("unpublished");
    expect(data.profile.every((v) => v === 0)).toBe(true);
    expect(data.totalTWh).toBe(0);
    expect(data.confidenceTier).toBe("T3-modelled");
    expect(data.generationProfile?.every((gw) => Math.abs(gw - 0.067) < 1e-12)).toBe(true);
    // 67 MW × 720 h = 48,240 MWh.
    expect(data.generationTotalTWh).toBeCloseTo(0.04824, 10);
    expect(data.sourceNote).toMatch(/estimated/);
    expect(data.sourceNote).toMatch(/GWh: solar 7\.2, wind 1\.4, hydro 39\.6/);
    expect(data.sourceNote).toMatch(/waste unpublished, no rate applied/);
  });

  it("emits the observed generation split so a mixed island is not bucketed as unsplit hydro", () => {
    const now = new Date("2026-11-18T01:00:00Z");
    const data = buildSeiRegion(corsica, day("2026-11-17", "+01:00", 15, corsicaRow), now);
    expect(data.fuelShare?.solar).toBeCloseTo(10 / 67, 10);
    expect(data.fuelShare?.wind).toBeCloseTo(2 / 67, 10);
    expect(data.fuelShare?.hydro).toBeCloseTo(55 / 67, 10);
    const region = REGIONS.find((r) => r.id === "corsica")!;
    expect(dominantFuel(region, data)).toBe("hydro");

    const solarIsland = buildSeiRegion(
      SEI_TERRITORIES.find((t) => t.regionId === "martinique") as SeiTerritory,
      day("2026-11-17", "-04:00", 5, () => ({ photovoltaique: 8, eolien: 0 })),
      now,
    );
    expect(solarIsland.fuelShare?.solar).toBeCloseTo(1, 9);
    expect(solarIsland.fuelShare?.wind).toBe(0);
    expect(dominantFuel(REGIONS.find((r) => r.id === "martinique")!, solarIsland)).toBe("solar");
  });

  it("marks a feed whose newest row is over 24 hours old as degraded", () => {
    const rows = day("2026-11-17", "+01:00", 15, corsicaRow);
    expect(buildSeiRegion(corsica, rows, new Date("2026-11-18T10:00:00Z")).sourceStatus).toBe("cached");
    expect(buildSeiRegion(corsica, rows, new Date("2026-11-20T10:00:00Z")).sourceStatus).toBe("degraded");
  });

  it("drops an orphan row from weeks earlier and counts a repeated timestamp once", () => {
    const rows = [
      ...day("2026-11-17", "-03:00", 5, () => ({ photovoltaique: 4, hydraulique: 30 })),
      { date: "2026-11-17T12:00:00-03:00", photovoltaique: 4, hydraulique: 30 },
      { date: "2026-10-06T12:00:00-03:00", photovoltaique: 900, hydraulique: 900 },
      // A recent orphan too: three days before the window, past the 6-hour gap.
      { date: "2026-11-14T12:00:00-03:00", photovoltaique: 900, hydraulique: 900 },
    ];
    const series = parseSeiRows(guiana, rows);
    expect(series.points).toHaveLength(288);
    expect(Math.max(...series.points.map((p) => p.mw))).toBe(34);
    expect(series.spanHours).toBeLessThan(24);
  });

  it("clamps negative telemetry to zero and skips a row missing a fuel", () => {
    const rows = day("2026-11-17", "-03:00", 60, (h) =>
      h === 3 ? { photovoltaique: -1.2, hydraulique: 30 } : { photovoltaique: 4, hydraulique: 30 },
    );
    rows.push({ date: "2026-11-17T12:30:00-03:00", photovoltaique: 4, hydraulique: null });
    const series = parseSeiRows(guiana, rows);
    expect(series.points).toHaveLength(24);
    expect(Math.min(...series.points.map((p) => p.mw))).toBe(30);
  });

  it("refuses a window that does not cover every UTC hour", () => {
    const rows = day("2026-11-17", "-03:00", 5, () => ({ photovoltaique: 4, hydraulique: 30 })).slice(0, 200);
    expect(() => parseSeiRows(guiana, rows)).toThrow(/of 24 UTC hours/);
    expect(() => parseSeiRows(guiana, [])).toThrow(/no usable rows/);
  });
});
