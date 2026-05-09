import { describe, it, expect } from "vitest";

describe("yemen static region", () => {
  it("is registered in REGIONS", async () => {
    const { REGIONS } = await import("../../src/lib/regions.js");
    const r = REGIONS.find((r) => r.id === "yemen");
    expect(r).toBeDefined();
    expect(r!.country).toBe("YEM");
    expect(r!.tier).toBe("estimated");
    expect(r!.kind).toBe("solar");
  });
});
