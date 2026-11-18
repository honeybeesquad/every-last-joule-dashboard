import { describe, expect, it } from "vitest";
import { buildJordanData } from "../../src/data/jordan.json";
import { buildAllStatics } from "../../src/data/statics.json";

describe("jordan loader", () => {
  it("emits unpublished waste and is not also a statics anchor", async () => {
    const data = await buildJordanData();
    expect(data.regionId).toBe("jordan");
    expect(data.profile).toHaveLength(24);
    expect(data.profile.every((v) => v === 0)).toBe(true);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBe(0);
    expect(data.peakGW).toBe(0);
    expect(data.wasteStatus).toBe("unpublished");
    expect(data.sourceProvenance).toBe("modelled-fallback");
    expect(buildAllStatics().jordan).toBeUndefined();
  });
});
