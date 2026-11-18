import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ammDateParam,
  buildGuatemalaRegion,
  normaliseTipo,
  parseAmmDay,
  windowDays,
} from "../../src/data/guatemala.json";

/** AMM graficaCombustible response for 2026-11-16, saved on 2026-11-18. */
const FIXTURE = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "amm-graficaCombustible-2026-11-16.json"), "utf-8"),
);

describe("guatemala: helpers", () => {
  it("matches IRRADIACIÓN with or without the accent", () => {
    expect(normaliseTipo("IRRADIACIÓN")).toBe("IRRADIACION");
    expect(normaliseTipo("IRRADIACIÓN")).toBe("IRRADIACION");
    expect(normaliseTipo(null)).toBe("");
  });

  it("formats the dt parameter as DD/MM/YYYY", () => {
    expect(ammDateParam("2026-11-16")).toBe("16/11/2026");
  });

  it("windows the 14 complete local days before today, oldest first", () => {
    // 04:00 UTC on the 18th is 22:00 on the 17th in Guatemala.
    const days = windowDays(new Date("2026-11-18T04:00:00Z"));
    expect(days).toHaveLength(14);
    expect(days.at(-1)).toBe("2026-11-16");
    expect(days[0]).toBe("2026-11-03");
  });
});

describe("guatemala: parseAmmDay", () => {
  const points = parseAmmDay("2026-11-16", FIXTURE);

  it("reads 24 hourly solar points", () => {
    expect(points).toHaveLength(24);
  });

  it("maps hour-ending 1 to 00:00–01:00 local, which is 06:00 UTC", () => {
    expect(points[0].utcTimestamp).toBe("2026-11-16T06:00:00.000Z");
    expect(points.at(-1)!.utcTimestamp).toBe("2026-11-17T05:00:00.000Z");
  });

  it("takes the solar series, not demand or another fuel", () => {
    const peak = Math.max(...points.map((p) => p.mw));
    expect(peak).toBeCloseTo(433.45, 2);
    expect(points[0].mw).toBe(0); // night
  });

  it("returns [] for an empty day outside AMM's window", () => {
    expect(parseAmmDay("2024-11-16", [])).toEqual([]);
  });

  it("returns [] when the day lacks some solar hours", () => {
    const partial = (FIXTURE as Array<{ hora: string }>).filter((r) => Number(r.hora) <= 12);
    expect(parseAmmDay("2026-11-16", partial)).toEqual([]);
  });

  it("throws on an implausible solar value", () => {
    const bad = (FIXTURE as Array<Record<string, unknown>>).map((r) =>
      normaliseTipo(r.tipo as string) === "IRRADIACION" && r.hora === "12" ? { ...r, potencia: 9000 } : r,
    );
    expect(() => parseAmmDay("2026-11-16", bad)).toThrow(/ceiling/);
  });

  it("treats a null solar value as missing, not zero", () => {
    const withNull = (FIXTURE as Array<Record<string, unknown>>).map((r) =>
      normaliseTipo(r.tipo as string) === "IRRADIACION" && r.hora === "12" ? { ...r, potencia: null } : r,
    );
    expect(parseAmmDay("2026-11-16", withNull)).toEqual([]);
  });

  it("clamps a small negative night reading to zero instead of dropping the day", () => {
    const withNeg = (FIXTURE as Array<Record<string, unknown>>).map((r) =>
      normaliseTipo(r.tipo as string) === "IRRADIACION" && r.hora === "2" ? { ...r, potencia: -0.3 } : r,
    );
    const pts = parseAmmDay("2026-11-16", withNeg);
    expect(pts).toHaveLength(24);
    expect(pts[1].mw).toBe(0);
  });

  it("throws on a non-array payload", () => {
    expect(() => parseAmmDay("2026-11-16", { error: "x" })).toThrow(/not an array/);
  });
});

describe("guatemala: buildGuatemalaRegion", () => {
  const day = parseAmmDay("2026-11-16", FIXTURE);

  it("emits generation with waste unpublished and zero", () => {
    const shifted = (n: number) =>
      day.map((p) => ({ ...p, utcTimestamp: new Date(Date.parse(p.utcTimestamp) + n * 86_400_000).toISOString() }));
    const daily = Array.from({ length: 7 }, (_, i) => shifted(i - 6));
    const localDays = Array.from({ length: 7 }, (_, i) => `2026-11-${String(10 + i).padStart(2, "0")}`);
    const r = buildGuatemalaRegion(daily, localDays);
    expect(r.wasteStatus).toBe("unpublished");
    expect(r.totalTWh).toBe(0);
    expect(r.profile.every((v) => v === 0)).toBe(true);
    expect(r.generationTotalTWh).toBeGreaterThan(0);
    expect(Math.max(...(r.generationProfile ?? []))).toBeCloseTo(0.43345, 4);
    expect(r.sourceNote).toContain("2026-11-10 → 2026-11-16");
  });

  it("does not count skipped days as zero when the window spans 25+ days", () => {
    const shifted = (n: number) =>
      day.map((p) => ({ ...p, utcTimestamp: new Date(Date.parse(p.utcTimestamp) + n * 86_400_000).toISOString() }));
    // 30-day span with 10 days missing: 20 complete days.
    const daily = Array.from({ length: 30 }, (_, i) => (i % 3 === 1 ? [] : shifted(i - 29)));
    const r = buildGuatemalaRegion(daily);
    const dayMWh = day.reduce((s, p) => s + p.mw, 0);
    expect(r.generationTotalTWh).toBeCloseTo((dayMWh * 30) / 1_000_000, 9);
  });

  it("throws with fewer than 7 complete days", () => {
    expect(() => buildGuatemalaRegion([day, day, [], []])).toThrow(/complete AMM days/);
  });
});
