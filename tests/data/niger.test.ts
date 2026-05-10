import { describe, it, expect } from "vitest";

describe("niger static region", () => {
  it("is registered in REGIONS", async () => {
    const { REGIONS } = await import("../../src/lib/regions.js");
    const r = REGIONS.find((r) => r.id === "niger");
    expect(r).toBeDefined();
    expect(r!.country).toBe("NER");
    expect(r!.tier).toBe("estimated");
    expect(r!.kind).toBe("solar");
  });
});
