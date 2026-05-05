import { describe, expect, it } from "vitest";

describe("belize static region", () => {
  it("is registered in REGIONS with correct metadata", async () => {
    const { REGIONS } = await import("../../src/lib/regions.js");
    const r = REGIONS.find((r) => r.id === "belize");
    expect(r).toBeDefined();
    expect(r!.country).toBe("BLZ");
    expect(r!.tier).toBe("static");
    expect(r!.kind).toBe("hydro");
  });
});
