import { describe, it, expect } from "vitest";
import { pdfToText } from "../../src/lib/pdf-text";
import { parseDailySolarReductionText } from "../../src/data/atacama-chile.json";

/** A one-page PDF with each [x, y, text] run placed on its own, as table cells are in CEN's reports. */
function buildPdf(runs: [number, number, string][]): Uint8Array {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  const stream = runs.map(([x, y, t]) => `BT /F1 9 Tf ${x} ${y} Td (${esc(t)}) Tj ET`).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out, "latin1"));
}

describe("pdfToText", () => {
  // Cells in the order a PDF may draw them (not left to right), with small
  // baseline differences within a row, as in CEN's Resumen Ejecutivo.
  const table: [number, number, string][] = [
    [40, 500, "Reducción Energía Eólica y Solar"],
    [300, 470, "-10,35 %"], [40, 470, "Eólica"], [120, 470.6, "32,494.34"], [200, 470, "36,245.15"],
    [380, 470, "2,850.06"], [460, 469.5, "8,06 %"],
    [460, 450, "12,08 %"], [380, 450, "8,562.28"], [300, 450.4, "-7,10 %"], [200, 450, "67,053.87"],
    [120, 450, "62,290.22"], [40, 450, "Solar"],
    [40, 420, "Generación Real y Programada por Tecnología"],
  ];

  it("rebuilds table rows left to right, one per baseline", async () => {
    const text = await pdfToText(buildPdf(table));
    const lines = text.split("\n").map((l) => l.replace(/\s+/g, " ").trim());
    expect(lines).toContain("Eólica 32,494.34 36,245.15 -10,35 % 2,850.06 8,06 %");
    expect(lines).toContain("Solar 62,290.22 67,053.87 -7,10 % 8,562.28 12,08 %");
    expect(lines[0]).toBe("Reducción Energía Eólica y Solar");
  });

  it("feeds the Chile daily parser the same row pdftotext -layout would", async () => {
    const text = await pdfToText(buildPdf(table));
    expect(parseDailySolarReductionText(text, "2026-04-22").solarReductionMwh).toBe(8562.28);
  });

  it("does not detach the caller's buffer", async () => {
    const bytes = buildPdf(table);
    await pdfToText(bytes);
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it("rejects bytes that are not a PDF, so the caller's fallback runs", async () => {
    await expect(pdfToText(new Uint8Array(Buffer.from("<html>Cloudflare</html>")))).rejects.toThrow();
  });
});
