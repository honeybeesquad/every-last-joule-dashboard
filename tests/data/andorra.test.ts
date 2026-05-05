import { describe, expect, it } from "vitest";

describe("andorra static region", () => {
  it("is registered in REGIONS with correct metadata", async () => {
    const { REGIONS } = await import("../../src/lib/regions.js");
    const r = REGIONS.find((r) => r.id === "andorra");
    expect(r).toBeDefined();
    expect(r!.country).toBe("AND");
    expect(r!.tier).toBe("static");
    expect(r!.kind).toBe("hydro");
  });
});
