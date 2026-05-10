import { describe, it, expect } from "vitest";

describe("afghanistan static region", () => {
  it("is registered in REGIONS", async () => {
    const { REGIONS } = await import("../../src/lib/regions.js");
    const r = REGIONS.find((r) => r.id === "afghanistan");
    expect(r).toBeDefined();
    expect(r!.country).toBe("AFG");
    expect(r!.tier).toBe("estimated");
    expect(r!.kind).toBe("solar");
  });
});
