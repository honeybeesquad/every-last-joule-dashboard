import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildPuertoRicoFromCsv, parsePrepaCsv } from "../../src/data/puerto-rico.json";
import { showsWastePillar } from "../../src/lib/waste-status";

const CSV_PATH = join(process.cwd(), "data/historical/puerto-rico-genera.csv");

function csvFromHours(n: number): string {
  const header = "utc_timestamp,solar_mw,wind_mw,system_mw,source_updated_local,fetched_at_utc";
  const rows = Array.from({ length: n }, (_, i) => {
    const hour = i % 24;
    const solar = hour >= 10 && hour <= 20 ? 20 + (hour - 10) : 0;
    const wind = 1.5 + (i % 5) * 0.2;
    const ts = `2026-09-${String(19 + Math.floor(i / 24)).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00Z`;
    return `${ts},${solar},${wind.toFixed(1)},2040,local,${ts}`;
  });
  return [header, ...rows].join("\n");
}

describe("puerto-rico PREPA relay", () => {
  it("parses the committed CSV without inventing a diurnal from a short lake", () => {
    expect(existsSync(CSV_PATH)).toBe(true);
    const text = readFileSync(CSV_PATH, "utf8");
    const rows = parsePrepaCsv(text);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.length).toBeLessThan(24);
    expect(rows[0].utcTimestamp).toBe("2026-09-20T11:22:21Z");
    expect(rows[0].solarMw).toBe(19.78);
    expect(rows[0].windMw).toBe(1.5);
    const data = buildPuertoRicoFromCsv(text);
    expect(data.solar.wasteStatus).toBe("unpublished");
    expect(data.wind.wasteStatus).toBe("unpublished");
    expect(data.solar.generationTotalTWh).toBe(0);
    expect(data.wind.generationTotalTWh).toBe(0);
    expect(data.solar.generationProfile).toEqual(Array(24).fill(0));
    expect(data.solar.profile.every((v) => v === 0)).toBe(true);
    expect(data.solar.totalTWh).toBe(0);
    expect(showsWastePillar(data.solar)).toBe(false);
    expect(data.solar.sourceNote).toMatch(/need 24/);
    expect(data.solar.confidenceTier).toBe("T3-modelled");
    expect(data.solar.sourceProvenance).toBe("official-lead");
  });

  it("will not emit a diurnal from 24 rows crammed into a few hours", () => {
    // PREPA republishes every ~6 minutes, so a sub-hourly cron or a handful
    // of manual runs during setup reaches 24 rows without covering 24 hours.
    // A row-count guard passes that, and every uncovered hour then reads as
    // 0 GW generated — a mostly-zero day, including overnight wind.
    const header =
      "utc_timestamp,solar_mw,wind_mw,system_mw,source_updated_local,fetched_at_utc";
    const rows = Array.from({ length: 24 }, (_, i) => {
      const hour = 11 + Math.floor(i / 6); // 24 rows, four UTC hours
      const minute = (i % 6) * 10;
      const ts = `2026-09-20T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`;
      return `${ts},20,2,2000,x,${ts}`;
    });
    const data = buildPuertoRicoFromCsv([header, ...rows].join("\n"));
    expect(data.solar.generationProfile).toEqual(Array(24).fill(0));
    expect(data.wind.generationProfile).toEqual(Array(24).fill(0));
    expect(data.solar.sourceNote).toMatch(/4\/24 UTC hours/);
  });

  it("emits unpublished generation once the lake has 24 snapshots", () => {
    const data = buildPuertoRicoFromCsv(csvFromHours(48));
    expect(data.solar.regionId).toBe("puerto-rico-solar");
    expect(data.wind.regionId).toBe("puerto-rico-wind");
    expect(data.solar.wasteStatus).toBe("unpublished");
    expect(data.wind.wasteStatus).toBe("unpublished");
    expect(data.solar.profile.every((v) => v === 0)).toBe(true);
    expect(data.solar.totalTWh).toBe(0);
    expect(data.solar.generationProfile).toHaveLength(24);
    expect(data.solar.generationTotalTWh).toBeGreaterThan(0);
    expect(data.wind.generationTotalTWh).toBeGreaterThan(0);
    expect(data.solar.confidenceTier).toBe("T3-modelled");
    expect(data.solar.sourceNote).toMatch(/Not T1a/);
    expect(data.solar.sourceNote).toMatch(/utility-scale PPOA/);
    expect(showsWastePillar(data.solar)).toBe(false);
  });
});
