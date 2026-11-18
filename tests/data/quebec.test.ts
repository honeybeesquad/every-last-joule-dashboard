import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildQuebecDataFromFile,
  parseProduction,
  quebecLocalToUtcIso,
} from "../../src/data/quebec.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Hydro-Québec production.json as served 2026-11-18 09:46 UTC: 27 published
// hours (17 Nov 00:30 to 18 Nov 02:30 local) plus `{ total: 0 }` placeholders.
const FIXTURE = join(__dirname, "fixtures", "hydroquebec-production-sample.json");

function hours(n: number, valeurs: Record<string, number>) {
  return Array.from({ length: n }, (_, i) => ({
    date: `2026-07-0${1 + Math.floor(i / 24)}T${String(i % 24).padStart(2, "0")}:30:00`,
    valeurs,
  }));
}

describe("quebec loader (Hydro-Québec open data)", () => {
  it("converts Quebec local time to UTC across standard and daylight time", () => {
    expect(quebecLocalToUtcIso("2026-11-17T00:30:00")).toBe("2026-11-17T05:30:00.000Z");
    expect(quebecLocalToUtcIso("2026-07-01T00:30:00")).toBe("2026-07-01T04:30:00.000Z");
    expect(quebecLocalToUtcIso("not a date")).toBeNull();
  });

  it("emits measured hydro and wind generation with waste unpublished", () => {
    const data = buildQuebecDataFromFile(FIXTURE);
    for (const [fuel, id] of [
      ["hydro", "quebec"],
      ["wind", "quebec-wind"],
    ] as const) {
      const r = data[fuel];
      expect(r.regionId).toBe(id);
      expect(r.profile).toEqual(Array(24).fill(0));
      expect(r.totalTWh).toBe(0);
      expect(r.peakGW).toBe(0);
      expect(r.wasteStatus).toBe("unpublished");
      expect(r.generationProfile).toHaveLength(24);
      expect(r.generationTotalTWh).toBeGreaterThan(0);
      expect(r.confidenceTier).toBe("T3-modelled");
      expect(r.sourceProvenance).toBe("official-lead");
      expect(r.sourceNote).toMatch(/Hydro-Québec open data/);
      expect(r.sourceNote).toMatch(/Waste unpublished/);
    }
    // 17 Nov 00:30 EST → 05:30 UTC; last published hour 18 Nov 02:30 EST → 07:30 UTC.
    expect(data.hydro.lastUpdated).toBe("2026-11-18T07:30:00.000Z");
    // Hydro runs 12.8–22.7 GW in this window; wind 1.9–3.1 GW.
    const maxHydro = Math.max(...data.hydro.generationProfile!);
    const maxWind = Math.max(...data.wind.generationProfile!);
    expect(maxHydro).toBeGreaterThan(10);
    expect(maxHydro).toBeLessThan(25);
    expect(maxWind).toBeGreaterThan(1);
    expect(maxWind).toBeLessThan(5);
    // The dropped fallback anchor must not survive in the note as a live figure.
    expect(data.hydro.sourceNote).toMatch(/Replaces the former ~0\.3 TWh\/yr modelled surplus anchor/);
  });

  it("skips the unpublished placeholder hours instead of reading them as zero", () => {
    const gen = buildQuebecDataFromFile(FIXTURE);
    // 27 published hours span parts of two days, so every UTC hour is covered
    // and none of the 21 `{ total: 0 }` placeholders pulled the mean to zero.
    expect(gen.hydro.generationProfile!.every((gw) => gw > 10)).toBe(true);
  });

  it("keeps both 01:30 readings on the November fall-back night", () => {
    const details = Array.from({ length: 30 }, (_, i) => ({
      date: `2026-10-31T${String(i % 24).padStart(2, "0")}:30:00`.replace(
        "2026-10-31",
        i < 24 ? "2026-10-31" : "2026-11-01",
      ),
      valeurs: { hydraulique: 15000 + i, eolien: 2000 },
    }));
    // Hydro-Québec lists the repeated local hour twice: 01:30 EDT, then 01:30 EST.
    details.splice(26, 0, { date: "2026-11-01T01:30:00", valeurs: { hydraulique: 99, eolien: 2000 } });
    const { hydro } = parseProduction({ details });
    const at = (iso: string) => hydro.find((p) => p.utcTimestamp === iso)?.mw;
    expect(at("2026-11-01T05:30:00.000Z")).toBe(15025); // 01:30 EDT
    expect(at("2026-11-01T06:30:00.000Z")).toBe(99); // 01:30 EST
    expect(at("2026-11-01T07:30:00.000Z")).toBe(15026); // 02:30 EST
  });

  it("does not invent an hour from a plain duplicate row", () => {
    const details = hours(30, { hydraulique: 15000, eolien: 2000 });
    details.push({ date: details[29].date, valeurs: { hydraulique: 16000, eolien: 2000 } });
    const { hydro } = parseProduction({ details });
    expect(hydro).toHaveLength(30);
    expect(hydro.at(-1)?.mw).toBe(16000);
  });

  it("throws on a malformed or truncated file so withFallback serves last-good", () => {
    expect(() => parseProduction({} as never)).toThrow(/no details array/);
    expect(() => parseProduction({ details: hours(10, { hydraulique: 15000, eolien: 2000 }) })).toThrow(/need 24/);
    expect(() => parseProduction({ details: hours(30, { hydraulique: 0, eolien: 2000 }) })).toThrow(/zero across/);
  });

  it("rejects implausible readings rather than publishing them", () => {
    expect(() => parseProduction({ details: hours(30, { hydraulique: 90000, eolien: 2000 }) })).toThrow(/plausibility/);
    expect(() => parseProduction({ details: hours(30, { hydraulique: 15000, eolien: -5 }) })).toThrow(/negative/);
  });
});
