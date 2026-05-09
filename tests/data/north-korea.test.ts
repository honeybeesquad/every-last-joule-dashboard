import { describe, it, expect } from "vitest";

describe("north-korea static region", () => {
  it("is registered in REGIONS", async () => {
    const { REGIONS } = await import("../../src/lib/regions.js");
    const r = REGIONS.find((r) => r.id === "north-korea");
    expect(r).toBeDefined();
    expect(r!.country).toBe("PRK");
    expect(r!.tier).toBe("estimated");
    expect(r!.kind).toBe("solar");
  });
});
