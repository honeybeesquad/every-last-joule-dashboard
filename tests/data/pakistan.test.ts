import { describe, expect, it } from "vitest";
import { buildPakistanData } from "../../src/data/pakistan.json";

describe("pakistan loader", () => {
  it("returns mixed fallback data", async () => {
    const data = await buildPakistanData();
    expect(data.regionId).toBe("pakistan");
    expect(data.profile).toHaveLength(24);
    expect(data.totalTWh).toBeGreaterThan(0);
    // Updated 2026-04-30 (Gemini wave 2): NEPRA SOI 2024 anchor is wind-specific
    // (1,337 GWh NPMV for wind, solar not separately quantified by NEPRA).
    // Wind share bumped to 0.9 to reflect the wind-dominated source citation.
    expect(data.fuelShare?.solar).toBeCloseTo(0.1, 2);
    expect(data.fuelShare?.wind).toBeCloseTo(0.9, 2);
  });
});
