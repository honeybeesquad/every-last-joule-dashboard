import { describe, it, expect } from "vitest";

describe("syria static region", () => {
  it("is registered in REGIONS", async () => {
    const { REGIONS } = await import("../../src/lib/regions.js");
    const r = REGIONS.find((r) => r.id === "syria");
    expect(r).toBeDefined();
    expect(r!.country).toBe("SYR");
    expect(r!.tier).toBe("static");
    expect(r!.kind).toBe("solar");
  });
});
