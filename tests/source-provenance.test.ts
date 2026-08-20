import { describe, expect, it } from "vitest";
import {
  stampRegionSourceProvenance,
  stampSourceProvenance,
} from "../src/lib/source-provenance";
import type { RegionData } from "../src/lib/types";

function region(regionId: string, sourceProvenance?: RegionData["sourceProvenance"]): RegionData {
  return {
    regionId,
    profile: new Array(24).fill(1),
    latestProfile: null,
    totalTWh: 1,
    peakGW: 1,
    lastUpdated: "2026-05-12T00:00:00.000Z",
    lastSuccessAt: "2026-05-12T00:00:00.000Z",
    ...(sourceProvenance ? { sourceProvenance } : {}),
  };
}

describe("source provenance stamping", () => {
  it("stamps canonical single-region records from REGIONS metadata", () => {
    expect(stampRegionSourceProvenance(region("caiso-wind")).sourceProvenance).toBe("verified");
    expect(stampRegionSourceProvenance(region("xinjiang-solar")).sourceProvenance).toBe("verified");
  });

  it("preserves explicit loader-set provenance values", () => {
    const stamped = stampRegionSourceProvenance(region("caiso-wind", "official-lead"));
    expect(stamped.sourceProvenance).toBe("official-lead");
  });

  it("stamps multi-region wrapper payloads without changing non-region children", () => {
    const payload = {
      "caiso-wind": region("caiso-wind"),
      "xinjiang-solar": region("xinjiang-solar"),
      metadata: { generatedAt: "2026-05-12T00:00:00.000Z" },
    };

    const stamped = stampSourceProvenance(payload);

    expect(stamped["caiso-wind"].sourceProvenance).toBe("verified");
    expect(stamped["xinjiang-solar"].sourceProvenance).toBe("verified");
    expect(stamped.metadata).toEqual(payload.metadata);
  });
});
