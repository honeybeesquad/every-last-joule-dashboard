import { describe, expect, it } from "vitest";
import {
  buildSpainEsiosData,
  esiosHasPerFuel,
  parseEsiosIndicator,
} from "../../src/data/spain-esios.json";

describe("spain ESIOS", () => {
  it("returns {} without ESIOS_API_TOKEN so ENTSO Spain is not overwritten", async () => {
    delete process.env.ESIOS_API_TOKEN;
    expect(await buildSpainEsiosData()).toEqual({});
  });

  it("parses indicator values", () => {
    const values = parseEsiosIndicator({
      indicator: {
        values: [
          { datetime: "2026-09-19T00:00:00.000+02:00", value: 12, geo_name: "Eólica" },
          { datetime: "2026-09-19T01:00:00.000+02:00", value: 8, geo_name: "Solar fotovoltaica" },
        ],
      },
    });
    expect(values).toHaveLength(2);
    expect(values[0].value).toBe(12);
  });

  it("refuses a mixed-fuel 704 payload", () => {
    const values = Array.from({ length: 24 }, (_, i) => ({
      datetime: `2026-09-19T${String(i).padStart(2, "0")}:00:00Z`,
      value: 10,
      geo_name: "Península",
    }));
    expect(esiosHasPerFuel(values)).toBe(false);
  });
});
