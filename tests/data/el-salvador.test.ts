import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildElSalvadorRegion,
  callbackBody,
  NotCallbackError,
  extractHiddenFields,
  parseCallback,
  windowDays,
} from "../../src/data/el-salvador.json";

/** UT OperacionDiaria pivot callback answer for 2026-11-16, saved on 2026-11-18. */
const BODY = readFileSync(join(__dirname, "fixtures", "ut-operacion-diaria-2026-11-16.txt"), "utf-8");

const FIELDS = { __VIEWSTATE: "vs", __VIEWSTATEGENERATOR: "009BF757", __EVENTVALIDATION: "ev" };

/** Rewrite one solar cell (technology index 5 = Solar, day 0, hour h) in the fixture. */
function withSolarCell(h: number, value: number | null): string {
  const key = `"[5,0,${h}]":{"0":`;
  const i = BODY.indexOf(key);
  if (i < 0) throw new Error(`fixture has no solar cell for hour ${h}`);
  const end = BODY.indexOf("}", i + key.length);
  if (value === null) {
    // Remove the cell and the comma that follows it.
    return BODY.slice(0, i) + BODY.slice(end + 2);
  }
  return BODY.slice(0, i + key.length) + String(value) + BODY.slice(end);
}

describe("el-salvador: request helpers", () => {
  it("reads the ASP.NET hidden fields", () => {
    const html =
      '<input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="abc" />' +
      '<input type="hidden" name="__VIEWSTATEGENERATOR" id="__VIEWSTATEGENERATOR" value="009BF757" />' +
      '<input type="hidden" name="__EVENTVALIDATION" id="__EVENTVALIDATION" value="xyz" />';
    expect(extractHiddenFields(html)).toEqual({ __VIEWSTATE: "abc", __VIEWSTATEGENERATOR: "009BF757", __EVENTVALIDATION: "xyz" });
  });

  it("throws when a hidden field is missing", () => {
    expect(() => extractHiddenFields("<html></html>")).toThrow(/__VIEWSTATE not found/);
  });

  it("builds the callback for the requested day", () => {
    const form = new URLSearchParams(callbackBody(FIELDS, "2026-11-16"));
    expect(form.get("__CALLBACKID")).toBe("ASPxDashboardViewer1");
    expect(form.get("__VIEWSTATE")).toBe("vs");
    const param = form.get("__CALLBACKPARAM")!;
    expect(param.startsWith("c1:")).toBe(true);
    expect(decodeURIComponent(JSON.parse(param.slice(3)).url)).toContain('"value":"2026-11-16T00:00:00.000"');
  });

  it("windows the 14 complete local days before today", () => {
    // 04:00 UTC on the 18th is 22:00 on the 17th in El Salvador.
    const days = windowDays(new Date("2026-11-18T04:00:00Z"));
    expect(days).toHaveLength(14);
    expect(days[0]).toBe("2026-11-03");
    expect(days.at(-1)).toBe("2026-11-16");
  });
});

describe("el-salvador: parseCallback", () => {
  const points = parseCallback("2026-11-16", BODY);

  it("reads 24 hourly solar points, filling the omitted night hour with zero", () => {
    expect(points).toHaveLength(24);
    expect(points[5].mw).toBe(0); // hour 5 is absent from the pivot
  });

  it("maps local hour 0 to 06:00 UTC", () => {
    expect(points[0].utcTimestamp).toBe("2026-11-16T06:00:00.000Z");
    expect(points[23].utcTimestamp).toBe("2026-11-17T05:00:00.000Z");
  });

  it("takes the Solar technology", () => {
    expect(Math.max(...points.map((p) => p.mw))).toBeCloseTo(299.52, 2);
    expect(points[10].mw).toBeCloseTo(299.52, 2);
  });

  it("returns [] when a daylight hour is missing", () => {
    expect(parseCallback("2026-11-16", withSolarCell(12, null))).toEqual([]);
  });

  it("treats a missing early-morning hour (06:00) as lost data, not night", () => {
    expect(parseCallback("2026-11-16", withSolarCell(6, null))).toEqual([]);
  });

  it("treats a null value as missing, not zero", () => {
    const nulled = BODY.replace(/"\[5,0,12\]":\{"0":[0-9.]+\}/, '"[5,0,12]":{"0":null}');
    expect(nulled).not.toBe(BODY);
    expect(parseCallback("2026-11-16", nulled)).toEqual([]);
  });

  it("throws on an implausible solar value", () => {
    expect(() => parseCallback("2026-11-16", withSolarCell(12, 9000))).toThrow(/ceiling/);
  });

  it("throws on a corrupt negative value and clamps noise near zero", () => {
    expect(() => parseCallback("2026-11-16", withSolarCell(12, -50))).toThrow(/bad solar value/);
    expect(parseCallback("2026-11-16", withSolarCell(2, -0.4))[2].mw).toBe(0);
  });

  it("throws when the pivot is for another day", () => {
    expect(() => parseCallback("2026-11-15", BODY)).toThrow(/pivot is for/);
  });

  it("marks a non-callback body with NotCallbackError so the run can skip one", () => {
    expect(() => parseCallback("2026-11-16", "<html>Session expired</html>")).toThrow(NotCallbackError);
  });

  it("throws on a callback error or non-pivot answer", () => {
    expect(() => parseCallback("2026-11-16", "0|/*DX*/({'error':{'message':'x'},'result':null,'id':1})")).toThrow(
      /no result/,
    );
    expect(() => parseCallback("2026-11-16", "0|/*DX*/({'id':1,'result':'{}'})")).toThrow(/encode maps/);
  });
});

describe("el-salvador: buildElSalvadorRegion", () => {
  const day = parseCallback("2026-11-16", BODY);
  const shifted = (n: number) =>
    day.map((p) => ({ ...p, utcTimestamp: new Date(Date.parse(p.utcTimestamp) + n * 86_400_000).toISOString() }));

  it("emits generation with waste unpublished and zero", () => {
    const daily = Array.from({ length: 7 }, (_, i) => shifted(i - 6));
    const days = Array.from({ length: 7 }, (_, i) => `2026-11-${String(10 + i).padStart(2, "0")}`);
    const r = buildElSalvadorRegion(daily, days);
    expect(r.wasteStatus).toBe("unpublished");
    expect(r.totalTWh).toBe(0);
    expect(r.profile.every((v) => v === 0)).toBe(true);
    const dayMWh = day.reduce((s, p) => s + p.mw, 0);
    expect(r.generationTotalTWh).toBeCloseTo((dayMWh * 30) / 1_000_000, 9);
    expect(r.sourceNote).toContain("2026-11-10 → 2026-11-16");
  });

  it("does not count a skipped day as zero", () => {
    const daily = Array.from({ length: 14 }, (_, i) => (i % 4 === 1 ? [] : shifted(i - 13)));
    const days = Array.from({ length: 14 }, (_, i) => `2026-11-${String(3 + i).padStart(2, "0")}`);
    const dayMWh = day.reduce((s, p) => s + p.mw, 0);
    expect(buildElSalvadorRegion(daily, days).generationTotalTWh).toBeCloseTo((dayMWh * 30) / 1_000_000, 9);
  });

  it("throws with fewer than 7 complete days", () => {
    expect(() => buildElSalvadorRegion([day, day, [], []], ["a", "b", "c", "d"])).toThrow(/complete UT days/);
  });
});
