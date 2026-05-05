import { describe, it, expect } from "vitest";

describe("belarus-wind static region", () => {
  it("is registered in REGIONS", async () => {
    const { REGIONS } = await import("../../src/lib/regions.js");
    const r = REGIONS.find((r) => r.id === "belarus-wind");
    expect(r).toBeDefined();
    expect(r!.country).toBe("BLR");
    expect(r!.tier).toBe("static");
    expect(r!.kind).toBe("wind");
  });
});

describe("belarus-solar static region", () => {
  it("is registered in REGIONS", async () => {
    const { REGIONS } = await import("../../src/lib/regions.js");
    const r = REGIONS.find((r) => r.id === "belarus-solar");
    expect(r).toBeDefined();
    expect(r!.country).toBe("BLR");
    expect(r!.tier).toBe("static");
    expect(r!.kind).toBe("solar");
  });
});
