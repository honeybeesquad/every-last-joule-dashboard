import { describe, expect, it } from "vitest";
import { deflateRawSync } from "node:zlib";
import { unpublishedGenerationRegion } from "../../src/lib/waste-status.js";
import { unzipFirstText } from "../../src/lib/unzip.js";
import type { CurtailmentPoint } from "../../src/lib/types.js";

function hourPoints(n = 24, mw = 100): CurtailmentPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    utcTimestamp: `2026-09-19T${String(i).padStart(2, "0")}:00:00.000Z`,
    mw,
  }));
}

describe("unpublishedGenerationRegion", () => {
  it("zeros waste and keeps generation", () => {
    const row = unpublishedGenerationRegion("test-solar", "solar", hourPoints(), "note");
    expect(row.profile.every((v) => v === 0)).toBe(true);
    expect(row.totalTWh).toBe(0);
    expect(row.wasteStatus).toBe("unpublished");
    expect(row.generationProfile).toHaveLength(24);
    expect(row.generationTotalTWh).toBeGreaterThan(0);
    expect(row.confidenceTier).toBe("T3-modelled");
    expect(row.sourceProvenance).toBe("official-lead");
  });

  it("throws on a short window", () => {
    expect(() => unpublishedGenerationRegion("x", "solar", hourPoints(3), "n")).toThrow(/fewer than/);
  });
});

describe("unzipFirstText", () => {
  it("inflates a deflate-method ZIP local file", () => {
    const name = Buffer.from("a.csv");
    const raw = Buffer.from("hello,zip\n");
    const compressed = deflateRawSync(raw);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(raw.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28);
    const zip = Buffer.concat([header, name, compressed]);
    expect(unzipFirstText(zip)).toBe("hello,zip\n");
  });
});
