import { describe, expect, it } from "vitest";

describe("st-kitts-and-nevis static region", () => {
  it("is registered in REGIONS with correct metadata", async () => {
    const { REGIONS } = await import("../../src/lib/regions.js");
    const r = REGIONS.find((r) => r.id === "st-kitts-and-nevis");
    expect(r).toBeDefined();
    expect(r!.country).toBe("KNA");
    expect(r!.tier).toBe("static");
    expect(r!.kind).toBe("solar");
  });
});
