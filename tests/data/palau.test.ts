import { describe, expect, it } from "vitest";

describe("palau static region", () => {
  it("is registered in REGIONS with correct metadata", async () => {
    const { REGIONS } = await import("../../src/lib/regions.js");
    const r = REGIONS.find((r) => r.id === "palau");
    expect(r).toBeDefined();
    expect(r!.country).toBe("PLW");
    expect(r!.tier).toBe("static");
    expect(r!.kind).toBe("solar");
  });
});
