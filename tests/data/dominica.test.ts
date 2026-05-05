import { describe, expect, it } from "vitest";

describe("dominica static region", () => {
  it("is registered in REGIONS with correct metadata", async () => {
    const { REGIONS } = await import("../../src/lib/regions.js");
    const r = REGIONS.find((r) => r.id === "dominica");
    expect(r).toBeDefined();
    expect(r!.country).toBe("DMA");
    expect(r!.tier).toBe("static");
    expect(r!.kind).toBe("solar");
  });
});
