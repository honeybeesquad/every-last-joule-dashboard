import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  bengaliDateTimeToIso,
  bengaliToNumber,
  buildBangladeshDataFromFile,
  buildBangladeshRegion,
  parseSolarGenerationMW,
  resolveColumns,
} from "../../src/data/bangladesh.json";

const FIXTURE = join(__dirname, "fixtures", "pgcb-sample.html");
const FIXTURE_HTML = readFileSync(FIXTURE, "utf-8");

/** Fixed clock so `lastSuccessAt` does not make assertions time-dependent. */
const FIXED_NOW = () => new Date("2026-09-06T12:00:00.000Z");

describe("bangladesh: Bengali numerals", () => {
  it("transliterates Bengali digits", () => {
    expect(bengaliToNumber("০")).toBe(0);
    expect(bengaliToNumber("২৯৮")).toBe(298);
    expect(bengaliToNumber("১৩৯৯৮")).toBe(13998);
  });

  it("returns NaN for a cell with no digits, so blank is not coerced to zero", () => {
    expect(bengaliToNumber("")).toBeNaN();
    expect(bengaliToNumber("   ")).toBeNaN();
    expect(bengaliToNumber("-")).toBeNaN();
  });

  it("converts Bangladesh local time to UTC by subtracting six hours", () => {
    expect(bengaliDateTimeToIso("০৬-০৯-২০২৬", "১১:০০:০০")).toBe("2026-09-06T05:00:00.000Z");
    // Local 03:00 is the previous UTC day.
    expect(bengaliDateTimeToIso("০৬-০৯-২০২৬", "০৩:০০:০০")).toBe("2026-09-05T21:00:00.000Z");
  });

  it("rejects unparseable date/time cells", () => {
    expect(bengaliDateTimeToIso("not-a-date", "১১:০০:০০")).toBeNull();
    expect(bengaliDateTimeToIso("০৬-০৯-২০২৬", "")).toBeNull();
    expect(bengaliDateTimeToIso("৯৯-৯৯-২০২৬", "১১:০০:০০")).toBeNull();
  });
});

describe("bangladesh: column resolution", () => {
  it("reads the column indices out of the live header row", () => {
    const rows = [
      ["তারিখ", "সময়", "উৎপাদন(মেঃওঃ)", "ঘাটতি", "লোডশেড", "গ্যাস", "তরল জ্বালানী", "কয়লা", "হাইড্রো", "সৌর", "বায়ু", "ভারত", "নেপাল", "মন্তব্য"],
    ];
    expect(resolveColumns(rows)).toEqual({ date: 0, time: 1, solar: 9 });
  });

  it("throws when the solar heading disappears", () => {
    const rows = [["তারিখ", "সময়", "গ্যাস", "ভারত"]];
    expect(() => resolveColumns(rows)).toThrow(/missing expected column/);
  });

  it("throws when solar moves right of the India sub-column group", () => {
    // The India heading spans three sub-columns on data rows, so header
    // offsets to its right no longer map onto data-row offsets.
    const rows = [["তারিখ", "সময়", "ভারত", "সৌর"]];
    expect(() => resolveColumns(rows)).toThrow(/India sub-columns shift data-row indices/);
  });
});

describe("bangladesh: PGCB page parsing", () => {
  it("parses hourly solar generation out of the captured live page", () => {
    const points = parseSolarGenerationMW(FIXTURE_HTML);
    expect(points.length).toBe(51);
    expect(points[0].utcTimestamp).toBe("2026-09-03T18:00:00.000Z");
    expect(points[points.length - 1].utcTimestamp).toBe("2026-09-06T05:00:00.000Z");
    // Timestamps are unique and ascending.
    for (let i = 1; i < points.length; i++) {
      expect(points[i].utcTimestamp > points[i - 1].utcTimestamp).toBe(true);
    }
    // Generation MW, not curtailment: a real Bangladeshi solar midday peak.
    const peak = Math.max(...points.map((p) => p.mw));
    expect(peak).toBe(607);
    // Overnight readings are genuine zeros.
    expect(points.some((p) => p.mw === 0)).toBe(true);
  });

  it("throws when the anchor table is missing", () => {
    expect(() => parseSolarGenerationMW("<html><body><p>maintenance</p></body></html>")).toThrow(
      /no <table class="table-bordered">/,
    );
  });

  it("throws when the table is present but has too few hourly rows", () => {
    const oneRow = FIXTURE_HTML.replace(
      /(<tbody[\s\S]*?<\/tr>)[\s\S]*(<\/tbody>)/i,
      "$1$2",
    );
    expect(() => parseSolarGenerationMW(oneRow)).toThrow(/hourly rows, need at least/);
  });

  it("throws rather than emitting an all-zero solar profile", () => {
    // Blank the solar column on every data row by zeroing every Bengali digit
    // run in the ninth cell. Simpler: rebuild from a synthetic table.
    const rows = Array.from({ length: 30 }, (_, i) => {
      const hh = String(i % 24).padStart(2, "0").replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);
      return (
        `<tr><td>০৫-০৯-২০২৬</td><td>${hh}:০০:০০</td><td>০</td><td>০</td><td>০</td>` +
        `<td>০</td><td>০</td><td>০</td><td>০</td><td>০</td><td>০</td>` +
        `<td>০</td><td>০</td><td>০</td><td>০</td><td></td></tr>`
      );
    }).join("");
    const html =
      `<table class="table-bordered"><thead><tr>` +
      `<th>তারিখ</th><th>সময়</th><th>উৎপাদন(মেঃওঃ)</th><th>ঘাটতি</th><th>লোডশেড</th>` +
      `<th>গ্যাস</th><th>তরল জ্বালানী</th><th>কয়লা</th><th>হাইড্রো</th><th>সৌর</th>` +
      `<th>বায়ু</th><th>ভারত</th><th>নেপাল</th><th>মন্তব্য</th></tr></thead>` +
      `<tbody>${rows}</tbody></table>`;
    expect(() => parseSolarGenerationMW(html)).toThrow(/all-zero/);
  });

  it("throws when a reading exceeds the plausibility ceiling for the solar fleet", () => {
    // Move the solar heading onto the system-total column (~14,000 MW). This
    // is the failure a hardcoded column index would hide: the shape would
    // still look like a plausible curve, just of the wrong quantity.
    const shifted = FIXTURE_HTML
      // Rename the genuine solar heading out of the way first...
      .replace(/(<th[^>]*>)সৌর(<\/th>)/, "$1PV$2")
      // ...then label the system-total column as solar.
      .replace(/(<th[^>]*>)উৎপাদন\(মেঃওঃ\)(<\/th>)/, "$1সৌর$2");
    expect(shifted).not.toBe(FIXTURE_HTML);
    expect(() => parseSolarGenerationMW(shifted)).toThrow(/plausibility ceiling/);
  });
});

describe("bangladesh: region assembly", () => {
  const data = buildBangladeshDataFromFile(FIXTURE, { now: FIXED_NOW });

  it("emits unpublished waste and measured PGCB generation", () => {
    expect(data.regionId).toBe("bangladesh");
    expect(data.profile).toHaveLength(24);
    expect(data.profile.every((v) => v === 0)).toBe(true);
    expect(data.totalTWh).toBe(0);
    expect(data.peakGW).toBe(0);
    expect(data.wasteStatus).toBe("unpublished");
    expect(data.generationProfile).toHaveLength(24);
    expect(data.generationTotalTWh).toBeGreaterThan(0);
    expect(data.lastUpdated).toBe("2026-09-06T05:00:00.000Z");
  });

  it("stays on the estimated tier — waste is unpublished", () => {
    expect(data.confidenceTier).toBe("T3-modelled");
  });

  it("does not scale generation to the old 0.1 TWh invented anchor", () => {
    expect(data.sourceNote).toMatch(/Waste unpublished/);
    expect(data.sourceNote).toMatch(/0\.1 TWh\/yr repo estimate is dropped/);
    expect(data.sourceNote).not.toMatch(/\blive\b/i);
    expect(data.totalTWh).toBe(0);
  });

  it("carries the real diurnal shape on generationProfile — solar noon, dark nights", () => {
    const gen = data.generationProfile!;
    const peakHour = gen.indexOf(Math.max(...gen));
    expect(peakHour).toBe(6);
    for (let hour = 18; hour <= 23; hour++) {
      expect(gen[hour]).toBe(0);
    }
  });

  it("scales generation linearly — doubling MW doubles generationTotalTWh", () => {
    const points = parseSolarGenerationMW(FIXTURE_HTML);
    const doubled = buildBangladeshRegion(
      points.map((p) => ({ ...p, mw: p.mw * 2 })),
      { now: FIXED_NOW },
    );
    expect(doubled.generationTotalTWh).toBeCloseTo(data.generationTotalTWh! * 2, 8);
    expect(doubled.totalTWh).toBe(0);
  });
});
