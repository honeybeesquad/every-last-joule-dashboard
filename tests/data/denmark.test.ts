import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { buildDenmarkData, parseEnerginetPayload } from "../../src/data/denmark.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
const payload = readFileSync(join(__dirname, "../fixtures/denmark-sample.json"), "utf8");

describe("denmark parser", () => {
  it("combines DK1 and DK2 wind+solar rows and applies 4%", () => {
    const { points } = parseEnerginetPayload(payload);
    expect(points[0].utcTimestamp).toBe("2026-04-01T00:00:00.000Z");
    expect(points[0].mw).toBeCloseTo(1.84, 6);
    expect(points[1].mw).toBe(4);
  });

  it("builds national RegionData", () => {
    expect(buildDenmarkData(parseEnerginetPayload(payload)).regionId).toBe("denmark");
  });
});
