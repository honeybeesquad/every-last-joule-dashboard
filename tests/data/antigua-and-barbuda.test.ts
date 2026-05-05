import { describe, expect, it } from "vitest";

describe("antigua-and-barbuda static region", () => {
  it("is registered in REGIONS with correct metadata", async () => {
    const { REGIONS } = await import("../../src/lib/regions.js");
    const r = REGIONS.find((r) => r.id === "antigua-and-barbuda");
    expect(r).toBeDefined();
    expect(r!.country).toBe("ATG");
    expect(r!.tier).toBe("static");
    expect(r!.kind).toBe("solar");
  });
});
