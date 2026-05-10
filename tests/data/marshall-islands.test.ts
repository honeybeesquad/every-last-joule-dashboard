import { describe, expect, it } from "vitest";

describe("marshall-islands static region", () => {
  it("is registered in REGIONS with correct metadata", async () => {
    const { REGIONS } = await import("../../src/lib/regions.js");
    const r = REGIONS.find((r) => r.id === "marshall-islands");
    expect(r).toBeDefined();
    expect(r!.country).toBe("MHL");
    expect(r!.tier).toBe("estimated");
    expect(r!.kind).toBe("solar");
  });
});
