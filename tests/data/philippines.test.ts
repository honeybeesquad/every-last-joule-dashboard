import { describe, expect, it } from "vitest";
import {
  buildPhilippinesFromRtdCsv,
  iemopFuel,
  parseIemopLocalTimestamp,
  parseIemopRtdCsv,
} from "../../src/data/philippines.json";

function rtdFixture(): string {
  const header =
    "RUN_TIME,MKT_TYPE,TIME_INTERVAL,REGION_NAME,RESOURCE_NAME,RESOURCE_TYPE,SCHED_MW,PRICE";
  const rows = [header];
  for (let h = 0; h < 24; h++) {
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    const ampm = h < 12 ? "AM" : "PM";
    const ts = `9/19/2026 ${hour12}:00:00 ${ampm}`;
    const solarMw = Math.max(0, Math.cos(((h - 12) / 12) * Math.PI)) ** 1.8 * 800;
    const windMw = 30 + 10 * Math.sin((h / 24) * Math.PI * 2);
    rows.push(`x,RTD,${ts},CLUZ,01AGROSOL_G01,G,${solarMw.toFixed(2)},0`);
    rows.push(`x,RTD,${ts},CLUZ,01BALWIND_G01,G,${windMw.toFixed(2)},0`);
    rows.push(`x,RTD,${ts},CLUZ,01BTSOLEN_BAT,G,5,0`);
  }
  return rows.join("\n");
}

describe("philippines IEMOP RTD", () => {
  it("parses PH local 12-hour timestamps to UTC", () => {
    expect(parseIemopLocalTimestamp("9/19/2026 12:00:00 PM")).toBe("2026-09-19T04:00:00.000Z");
    expect(parseIemopLocalTimestamp("9/19/2026 12:00:00 AM")).toBe("2026-09-18T16:00:00.000Z");
  });

  it("classifies SOL/WIND and skips batteries", () => {
    expect(iemopFuel("01AGROSOL_G01")).toBe("solar");
    expect(iemopFuel("01BALWIND_G01")).toBe("wind");
    expect(iemopFuel("01BTSOLEN_BAT")).toBeNull();
  });

  it("emits unpublished waste and measured generation", () => {
    const data = buildPhilippinesFromRtdCsv(rtdFixture());
    const solar = data["philippines-solar"];
    const wind = data["philippines-wind"];
    expect(solar.wasteStatus).toBe("unpublished");
    expect(wind.wasteStatus).toBe("unpublished");
    expect(solar.profile.every((v) => v === 0)).toBe(true);
    expect(solar.totalTWh).toBe(0);
    expect(solar.generationTotalTWh).toBeGreaterThan(0);
    expect(wind.generationTotalTWh).toBeGreaterThan(0);
    expect(solar.confidenceTier).toBe("T3-modelled");
    const peakHour = solar.generationProfile!.indexOf(Math.max(...solar.generationProfile!));
    expect(peakHour).toBeGreaterThanOrEqual(3);
    expect(peakHour).toBeLessThanOrEqual(5);
  });

  it("sums plants at the same interval", () => {
    const { solar } = parseIemopRtdCsv(rtdFixture());
    expect(solar.length).toBe(24);
  });
});
