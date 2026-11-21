import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildUruguayRegionData,
  FALLBACK_RENEWABLE_PLANTS,
  isEmptyAdmeWorkbook,
  isUnpublishedAdmeMonth,
  normalizePlantName,
  parseAdmeConsignaPlantNames,
  parseAdmeRestrictionsXlsx,
  splitAdmeWorkbookResponse,
} from "../../src/data/uruguay.json";

// ADME's 2026-09 Restricciones Operativas workbook, fetched 2026-11-21 with the PHP warning prefix removed.
const SEPT_XLSX = new Uint8Array(readFileSync(join(__dirname, "../fixtures/adme/ro_2026-09.xlsx")));
const warnings = (variant: string, n: number) =>
  Array.from({ length: n }, () =>
    `<br />\n<b>Warning</b>:  ${variant} in <b>/home/uadme/public_html/panelControl/ro_excel.php</b> on line <b>80</b><br />\n`,
  ).join("");
const withPrefix = (prefix: string, body: Uint8Array) => {
  const head = new TextEncoder().encode(prefix);
  const out = new Uint8Array(head.length + body.length);
  out.set(head);
  out.set(body, head.length);
  return out;
};

describe("uruguay loader", () => {
  it("builds a valid RegionData shape from hourly ADME restriction points", () => {
    const data = buildUruguayRegionData(
      Array.from({ length: 48 }, (_, i) => ({
        utcTimestamp: new Date(Date.UTC(2026, 2, 1, i)).toISOString(),
        mw: i % 24 === 3 ? 12 : 0,
      })),
      "test source",
    );
    expect(data.regionId).toBe("uruguay");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toHaveLength(24);
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
  });

  it("extracts renewable plant names from the ADME consigna HTML table", () => {
    const names = parseAdmeConsignaPlantNames(`
      <table>
        <tr><td><b>Central</b></td><td>Potencia Autorizada</td></tr>
        <tr><td><span title="-">P. E. Sol&iacute;s de Mataojo</span></td><td>10</td></tr>
        <tr><td><span title="-">La Jacinta Solar</span></td><td>50</td></tr>
      </table>
    `);

    expect(names.has("solis de mataojo")).toBe(true);
    expect(names.has("la jacinta")).toBe(true);
  });

  it("finds the xlsx behind ADME's PHP warning prefix", () => {
    const response = withPrefix(warnings("Undefined array key 7", 500), SEPT_XLSX);
    const { xlsx, prefix } = splitAdmeWorkbookResponse(response);
    expect(xlsx).toEqual(SEPT_XLSX);
    expect(isUnpublishedAdmeMonth(prefix)).toBe(false);
  });

  it("reads the $valores warning as a month ADME has not published", () => {
    // As on 2026-10: megabytes of other warnings can come first.
    const prefix0 = warnings("Undefined array key 3", 40_000) + warnings("Undefined variable $valores", 5);
    expect(prefix0.length).toBeGreaterThan(5_000_000);
    const { prefix } = splitAdmeWorkbookResponse(withPrefix(prefix0, SEPT_XLSX));
    expect(isUnpublishedAdmeMonth(prefix)).toBe(true);
  });

  it("fails clearly when the response holds no workbook at all", () => {
    expect(() => splitAdmeWorkbookResponse(new TextEncoder().encode(warnings("pg_exec()", 3)))).toThrow(/no xlsx/);
  });

  it("keeps the Pe of Peralta and Petilcoran while dropping a P.E. prefix", () => {
    expect(normalizePlantName("Peralta I GCEE")).toBe("peralta i gcee");
    expect(normalizePlantName("PETILCORAN")).toBe("petilcoran");
    expect(normalizePlantName("P. E. Solís de Mataojo")).toBe("solis de mataojo");
    expect(normalizePlantName("PE Valentines")).toBe("valentines");
    expect(normalizePlantName("P.F. Menafra Solar")).toBe("menafra");
    expect(normalizePlantName("P.E.Valentines")).toBe("valentines");
  });

  it("tells an unpublished month's all-zero workbook from a published one", () => {
    // 2026-10 as served on 2026-11-21: all 127 plants zero for all 744 hours.
    const oct = new Uint8Array(readFileSync(join(__dirname, "../fixtures/adme/ro_2026-10_unpublished.xlsx")));
    expect(isEmptyAdmeWorkbook(oct)).toBe(true);
    expect(isEmptyAdmeWorkbook(SEPT_XLSX)).toBe(false);
  });

  it("matches every restricted plant in the 2026-09 workbook from the fallback list alone", () => {
    const plants = new Set([...FALLBACK_RENEWABLE_PLANTS].map(normalizePlantName));
    const data = buildUruguayRegionData(parseAdmeRestrictionsXlsx(SEPT_XLSX, plants), "test");
    // Every positive cell in the workbook sums to 13,176 MWh (the -11000 sentinel cells are dropped).
    expect(data.totalTWh * 1e6).toBeCloseTo(13_176, 0);
    expect(data.lastUpdated.startsWith("2026-10-01")).toBe(true); // hour ending 01-10 00:00 local
  });
});
