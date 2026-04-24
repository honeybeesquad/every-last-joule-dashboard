import { describe, expect, it } from "vitest";
import {
  dailySummariesToHourlyPoints,
  parseDailySolarReductionText,
} from "../../src/data/atacama-chile.json";

describe("atacama chile parser", () => {
  it("extracts the daily solar reduction MWh from CEN summary text", () => {
    const text = `
      Variación de generación Real vs Programada (%), Reducción Energía
      Eólica y Solar durante la Operación en Tiempo Real (OTR)
      tech_type______        Real       Programado       var%       Reducción       %
      Eólica             32,494.34        36,245.15        -10,35 %           2,850.06       8,06 %
      Solar              62,290.22        67,053.87         -7,10 %           8,562.28       12,08 %
      Total              94,784.56       103,299.02         -8,24 %          11,412.34       13,69 %
      Generación Real y Programada por Tecnología
    `;

    expect(parseDailySolarReductionText(text, "2026-04-22").solarReductionMwh).toBe(8562.28);
  });

  it("apportions daily summary MWh over the measured monthly hourly shape", () => {
    const monthlyShape = [
      { utcTimestamp: "2026-02-01T10:00:00.000Z", mw: 25 },
      { utcTimestamp: "2026-02-01T11:00:00.000Z", mw: 75 },
    ];
    const points = dailySummariesToHourlyPoints(
      [{ date: "2026-04-22", solarReductionMwh: 1000, url: "https://example.test/report.pdf" }],
      monthlyShape,
    );

    expect(points).toHaveLength(24);
    expect(points[10]).toEqual({ utcTimestamp: "2026-04-22T10:00:00.000Z", mw: 250 });
    expect(points[11]).toEqual({ utcTimestamp: "2026-04-22T11:00:00.000Z", mw: 750 });
    expect(points.reduce((sum, point) => sum + point.mw, 0)).toBe(1000);
  });
});
