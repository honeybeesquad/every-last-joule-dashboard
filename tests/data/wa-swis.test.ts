import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const json = readFileSync(join(__dirname, "../fixtures/wem-scada-sample.json"), "utf8");

let parseWemScadaJson: any;

describe("wa-swis wem parser", () => {
  beforeAll(async () => {
    const module = await import("../../src/data/wa-swis.json.js");
    parseWemScadaJson = module.parseWemScadaJson;
  });

  it("filters wind and solar codes and applies the 8% calibration rate", () => {
    const { windMwhTotal, solarMwhTotal } = parseWemScadaJson(json);
    // Wind: (0.2 + 0.25) MWh * 0.08 = 0.036 MWh of curtailment-proxy energy.
    expect(windMwhTotal).toBeCloseTo(0.036, 5);
    // Solar: (1.7 + 1.8) MWh * 0.08 = 0.28 MWh.
    expect(solarMwhTotal).toBeCloseTo(0.28, 5);
  });

  it("sums curtailment-proxy MW across wind+solar facilities at each timestamp", () => {
    const { points } = parseWemScadaJson(json);
    // Two unique 5-min timestamps in the fixture.
    expect(points.length).toBe(2);

    // First point: ALBANY_WF1 0.2 MWh (wind) + GREENOUGH_RIVER_PV1 1.7 MWh
    // (solar) at 08:00 AWST = 00:00 UTC. MW = (0.2 + 1.7) * 12 * 0.08 = 1.824.
    expect(points[0].mw).toBeCloseTo(1.824, 5);
    // Second point: 0.25 + 1.8 = 2.05 MWh. MW = 2.05 * 12 * 0.08 = 1.968.
    expect(points[1].mw).toBeCloseTo(1.968, 5);
  });

  it("converts WEM AWST timestamps to UTC ISO strings", () => {
    const { points } = parseWemScadaJson(json);
    // 2026-04-24T08:00:00+08:00 is 2026-04-24T00:00:00.000Z.
    expect(points[0].utcTimestamp).toBe("2026-04-24T00:00:00.000Z");
    expect(points[1].utcTimestamp).toBe("2026-04-24T00:05:00.000Z");
  });

  it("ignores facilities outside the wind+solar code set", () => {
    // Add a coal/gas/storage entry; expect parser to skip it.
    const augmented = JSON.stringify({
      data: {
        facilityScadaDispatchIntervals: [
          ...JSON.parse(json).data.facilityScadaDispatchIntervals,
          { dispatchInterval: "2026-04-24T08:00:00+08:00", code: "COLLIE_G1", quantity: 26.0 },
          { dispatchInterval: "2026-04-24T08:00:00+08:00", code: "COLLIE_BESS2", quantity: 18.0 },
        ],
      },
    });
    const { points, windMwhTotal, solarMwhTotal } = parseWemScadaJson(augmented);
    // Totals identical to the unaugmented case.
    expect(windMwhTotal).toBeCloseTo(0.036, 5);
    expect(solarMwhTotal).toBeCloseTo(0.28, 5);
    expect(points.length).toBe(2);
  });
});
