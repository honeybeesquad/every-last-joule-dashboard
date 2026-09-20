import { describe, expect, it } from "vitest";
import { buildDominicanFromOcJson, parseOcGeneration } from "../../src/data/dominican.json";

function ocDay(date: string) {
  return {
    GetGeneracionReprogramada: Array.from({ length: 24 }, (_, i) => ({
      FECHA: `${date}T${String(i).padStart(2, "0")}:00:00`,
      PERIODO: i + 1,
      PROGRAMADO: 3500,
      GENERACION: 3600 + i * 10,
      DESVIACION: 100,
    })),
  };
}

describe("dominican OC SENI", () => {
  it("treats naive FECHA as Atlantic time (UTC−4)", () => {
    const points = parseOcGeneration(ocDay("2026-09-19"));
    expect(points[0].utcTimestamp).toBe("2026-09-19T04:00:00.000Z");
    expect(points[0].mw).toBe(3600);
  });

  it("puts total generation on dominican-republic and empties the wind row", () => {
    const data = buildDominicanFromOcJson([ocDay("2026-09-18"), ocDay("2026-09-19")]);
    const sen = data["dominican-republic"];
    const wind = data["dominican-republic-wind"];
    expect(sen.wasteStatus).toBe("unpublished");
    expect(sen.profile.every((v) => v === 0)).toBe(true);
    expect(sen.generationTotalTWh).toBeGreaterThan(0);
    expect(wind.wasteStatus).toBe("unpublished");
    expect(wind.generationTotalTWh).toBe(0);
    expect(sen.sourceNote).toMatch(/not VRE/);
  });
});
