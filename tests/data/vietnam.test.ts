import { describe, expect, it } from "vitest";
import { buildVietnamData } from "../../src/data/vietnam.json";

describe("vietnam loader", () => {
  it("emits unpublished waste instead of a literature pillar", async () => {
    const data = await buildVietnamData();
    expect(data.regionId).toBe("vietnam");
    expect(data.profile).toHaveLength(24);
    expect(data.profile.every((v) => v === 0)).toBe(true);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBe(0);
    expect(data.peakGW).toBe(0);
    expect(data.wasteStatus).toBe("unpublished");
    expect(data.sourceProvenance).toBe("modelled-fallback");
  });
});
