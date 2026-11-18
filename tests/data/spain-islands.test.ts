import { describe, expect, it } from "vitest";
import {
  ISLAND_SYSTEMS,
  MIN_WINDOW_DAYS,
  REDATA_SOLAR_PV_ID,
  REDATA_TOTAL_ID,
  REDATA_WIND_ID,
  buildSpainIslandsFromRedata,
  dailyMWh,
  lastSettledDay,
  redataUrl,
  selectWindow,
  type RedataResponse,
} from "../../src/data/spain-islands.json";

const NOW = new Date("2026-11-18T10:30:00Z");

/** Days ending on `lastDay`, oldest first, stamped the way REData stamps them. */
function days(lastDay: string, n: number): string[] {
  const end = Date.parse(`${lastDay}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(end - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    return `${d}T00:00:00.000+01:00`;
  });
}

function series(id: string, type: string, stamps: string[], mwh: number) {
  return { id, type, attributes: { values: stamps.map((datetime) => ({ value: mwh, datetime })) } };
}

/**
 * A REData body shaped like the live one: every series runs through the fetch
 * date, including the day in progress.
 */
function body(opts: { wind?: number; solar: number; n?: number } = { solar: 1000 }): RedataResponse {
  const stamps = days("2026-11-18", opts.n ?? 41);
  const included = [
    series(REDATA_SOLAR_PV_ID, "Solar photovoltaic", stamps, opts.solar),
    series(REDATA_TOTAL_ID, "Total generation", stamps, 25_000),
  ];
  if (opts.wind != null) included.unshift(series(REDATA_WIND_ID, "Wind", stamps, opts.wind));
  return { included };
}

const bodies = () => ({
  canarias: body({ wind: 2000, solar: 1000 }),
  baleares: body({ solar: 1300 }),
});

describe("spain-islands REData daily generation", () => {
  it("requests day resolution for each electric system", () => {
    const urls = ISLAND_SYSTEMS.map((s) => redataUrl(s, NOW));
    expect(urls[0]).toContain("time_trunc=day");
    expect(urls[0]).toContain("geo_limit=canarias");
    expect(urls[0]).toContain("geo_ids=8742");
    expect(urls[1]).toContain("geo_limit=baleares");
    expect(urls[1]).toContain("geo_ids=8743");
    expect(urls[0]).toContain("end_date=2026-11-18T23%3A59");
  });

  it("keys daily values by REE's local date and drops bad values", () => {
    const b: RedataResponse = {
      included: [
        {
          id: REDATA_WIND_ID,
          attributes: {
            values: [
              { value: 10, datetime: "2026-10-25T00:00:00.000+02:00" },
              { value: 20, datetime: "2026-10-26T00:00:00.000+01:00" },
              { value: -1, datetime: "2026-10-27T00:00:00.000+01:00" },
              { value: null, datetime: "2026-10-28T00:00:00.000+01:00" },
              { value: 5, datetime: "garbage" },
            ],
          },
        },
      ],
    };
    expect(Array.from(dailyMWh(b, REDATA_WIND_ID))).toEqual([
      ["2026-10-25", 10],
      ["2026-10-26", 20],
    ]);
  });

  it("leaves out the day in progress and the day before it", () => {
    expect(lastSettledDay(NOW)).toBe("2026-11-16");
    const w = selectWindow(body({ wind: 2000, solar: 1000 }), REDATA_WIND_ID, "test", NOW);
    expect(w.days.length).toBe(30);
    expect(w.days[0]).toBe("2026-10-18");
    expect(w.days.at(-1)).toBe("2026-11-16");
    expect(w.sumMWh).toBe(60_000);
    expect(w.totalTWh30d).toBeCloseTo(0.06, 10);
  });

  it("counts only days the Total generation row carries", () => {
    const b = body({ wind: 2000, solar: 1000 });
    const total = b.included!.find((s) => s.id === REDATA_TOTAL_ID)!;
    total.attributes!.values = total.attributes!.values!.filter(
      (v) => v.datetime!.slice(0, 10) <= "2026-11-14",
    );
    const w = selectWindow(b, REDATA_WIND_ID, "test", NOW);
    expect(w.days.at(-1)).toBe("2026-11-14");
    expect(w.days.length).toBe(30);
  });

  it("scales a short window to 30 days and says so", () => {
    // 29 days in the body, 27 of them settled.
    const data = buildSpainIslandsFromRedata(
      { canarias: body({ wind: 2000, solar: 1000, n: 29 }), baleares: body({ solar: 1300 }) },
      NOW,
    );
    const wind = data["canary-islands-wind"];
    expect(wind.generationTotalTWh).toBeCloseTo(0.06, 10);
    expect(wind.sourceNote).toContain("over 27 settled days");
    expect(wind.sourceNote).toContain("scaled to 30 days");
  });

  it("throws below the minimum window, so withFallback serves the snapshot", () => {
    const short = body({ wind: 2000, solar: 1000, n: MIN_WINDOW_DAYS + 1 });
    expect(() => selectWindow(short, REDATA_WIND_ID, "test", NOW)).toThrow(/settled days/);
  });

  it("throws when a system's technology or total row is missing", () => {
    expect(() => buildSpainIslandsFromRedata({ canarias: body({ solar: 1000 }), baleares: body({ solar: 1300 }) }, NOW))
      .toThrow(/10291/);
    expect(() => selectWindow({ included: [] }, REDATA_WIND_ID, "test", NOW)).toThrow(/Total generation/);
    expect(() => buildSpainIslandsFromRedata({ canarias: body({ wind: 1, solar: 1 }) }, NOW)).toThrow(/Balearic/);
  });

  it("emits the three regions as generation with unpublished waste", () => {
    const data = buildSpainIslandsFromRedata(bodies(), NOW);
    expect(Object.keys(data).sort()).toEqual([
      "balearic-islands-solar",
      "canary-islands-solar",
      "canary-islands-wind",
    ]);
    for (const r of Object.values(data)) {
      expect(r.wasteStatus).toBe("unpublished");
      expect(r.profile).toEqual(Array(24).fill(0));
      expect(r.totalTWh).toBe(0);
      expect(r.peakGW).toBe(0);
      expect(r.confidenceTier).toBe("T3-modelled");
      expect(r.sourceProvenance).toBe("official-lead");
      expect(r.sourceStatus).toBe("cached");
      expect(r.lastUpdated).toBe("2026-11-16T00:00:00.000Z");
      expect(r.generationProfile).toHaveLength(24);
      // sum(GW) × 30 / 1000 is the repo's 30-day TWh convention.
      const fromProfile = (r.generationProfile!.reduce((a, b) => a + b, 0) * 30) / 1000;
      expect(fromProfile).toBeCloseTo(r.generationTotalTWh!, 10);
      expect(r.sourceNote).toContain("Waste unpublished");
      expect(r.sourceNote).toContain("not measured");
    }
    expect(data["canary-islands-wind"].generationTotalTWh).toBeCloseTo(0.06, 10);
    expect(data["canary-islands-solar"].generationTotalTWh).toBeCloseTo(0.03, 10);
    expect(data["balearic-islands-solar"].generationTotalTWh).toBeCloseTo(0.039, 10);
  });

  it("claims no intraday shape for wind and a local-noon curve for solar", () => {
    const data = buildSpainIslandsFromRedata(bodies(), NOW);
    const wind = data["canary-islands-wind"].generationProfile!;
    expect(new Set(wind).size).toBe(1);
    const peak = (p: number[]) => p.indexOf(Math.max(...p));
    const canary = data["canary-islands-solar"].generationProfile!;
    const balearic = data["balearic-islands-solar"].generationProfile!;
    expect([12, 13]).toContain(peak(canary));
    expect([11, 12]).toContain(peak(balearic));
    expect(canary[1]).toBe(0);
    expect(balearic[0]).toBe(0);
  });

  it("reads degraded when the newest settled day is over a week old", () => {
    const stale = buildSpainIslandsFromRedata(bodies(), new Date("2026-11-27T10:30:00Z"));
    expect(stale["canary-islands-wind"].lastUpdated).toBe("2026-11-18T00:00:00.000Z");
    expect(stale["canary-islands-wind"].sourceStatus).toBe("degraded");
  });
});
