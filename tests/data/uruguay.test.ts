import { describe, expect, it } from "vitest";
import {
  buildUruguayRegionData,
  parseAdmeConsignaPlantNames,
} from "../../src/data/uruguay.json";

describe("uruguay loader", () => {
  it("builds a valid RegionData shape from hourly ADME restriction points", () => {
    const data = buildUruguayRegionData(
      Array.from({ length: 48 }, (_, i) => ({
        utcTimestamp: new Date(Date.UTC(2026, 2, 1, i)).toISOString(),
        mw: i % 24 === 3 ? 12 : 0,
      })),
      "test source",
    );
    expect(data.regionId).toBe("uruguay");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toHaveLength(24);
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
  });

  it("extracts renewable plant names from the ADME consigna HTML table", () => {
    const names = parseAdmeConsignaPlantNames(`
      <table>
        <tr><td><b>Central</b></td><td>Potencia Autorizada</td></tr>
        <tr><td><span title="-">P. E. Sol&iacute;s de Mataojo</span></td><td>10</td></tr>
        <tr><td><span title="-">La Jacinta Solar</span></td><td>50</td></tr>
      </table>
    `);

    expect(names.has("solis de mataojo")).toBe(true);
    expect(names.has("la jacinta")).toBe(true);
  });
});
