import { describe, expect, it } from "vitest";
import { parseEiaIsoRegionPerFuel, type EIAResponse, type EiaIsoConfig } from "../../src/lib/eia-iso";
import { EIA_VRE_BA_CONFIGS } from "../../src/data/eia-vre-bas.json";
import { generationGWAtHour } from "../../src/lib/calc";
import { isTsoCollected, showsWastePillar, unpublishedEmptyRegion } from "../../src/lib/waste-status";

function makeEia(value: number): EIAResponse {
  return {
    response: {
      total: 1,
      data: [{ period: "2026-09-01T12", respondent: "TVA", fueltype: "WND", value: String(value) }],
    },
  };
}

describe("unpublished EIA-930 VRE BAs", () => {
  const config: EiaIsoConfig = {
    regionId: "tva",
    respondent: "TVA",
    displayName: "TVA",
    windRate: 0,
    solarRate: 0,
    wasteMode: "unpublished",
  };

  it("collects generation and leaves waste unpublished", () => {
    const { wind, solar } = parseEiaIsoRegionPerFuel(config, makeEia(1000), makeEia(500));
    expect(wind.wasteStatus).toBe("unpublished");
    expect(solar.wasteStatus).toBe("unpublished");
    expect(wind.profile.every((v) => v === 0)).toBe(true);
    expect(wind.generationTotalTWh).toBeGreaterThan(0);
    expect(solar.generationTotalTWh).toBeGreaterThan(0);
    expect(showsWastePillar(wind)).toBe(false);
    expect(isTsoCollected(wind)).toBe(true);
  });

  it("lists the Wave-1 BAs including TVA and Florida FRCC", () => {
    const ids = EIA_VRE_BA_CONFIGS.map((c) => c.regionId);
    expect(ids).toEqual(expect.arrayContaining(["tva", "fpl", "fpc", "tec", "swpw", "nevp"]));
    expect(ids).not.toContain("puerto-rico");
    expect(EIA_VRE_BA_CONFIGS.every((c) => c.wasteMode === "unpublished")).toBe(true);
  });
});

describe("wasteStatus helpers", () => {
  it("unpublished empty regions still carry a generation profile", () => {
    const data = unpublishedEmptyRegion("kauai", "grid marker");
    expect(data.wasteStatus).toBe("unpublished");
    expect(isTsoCollected(data)).toBe(true);
    expect(generationGWAtHour(data, 12)).toBe(0);
  });
});
