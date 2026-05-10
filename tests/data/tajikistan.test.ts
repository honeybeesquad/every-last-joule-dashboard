import { describe, it, expect } from "vitest";

describe("tajikistan static region", () => {
  it("is registered in REGIONS", async () => {
    const { REGIONS } = await import("../../src/lib/regions.js");
    const r = REGIONS.find((r) => r.id === "tajikistan");
    expect(r).toBeDefined();
    expect(r!.country).toBe("TJK");
    expect(r!.tier).toBe("estimated");
    expect(r!.kind).toBe("hydro");
  });
});
