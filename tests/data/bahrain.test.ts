import { describe, it, expect } from "vitest";

describe("bahrain static region", () => {
  it("is registered in REGIONS", async () => {
    const { REGIONS } = await import("../../src/lib/regions.js");
    const r = REGIONS.find((r) => r.id === "bahrain");
    expect(r).toBeDefined();
    expect(r!.country).toBe("BHR");
    expect(r!.tier).toBe("static");
    expect(r!.kind).toBe("solar");
  });
});
