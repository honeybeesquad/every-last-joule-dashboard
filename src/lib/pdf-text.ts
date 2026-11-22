import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * Plain text from a PDF, one line per visual row, in pure JavaScript (Mozilla
 * pdf.js), so a loader does not need poppler's `pdftotext` binary, which
 * Vercel's build image does not have.
 *
 * pdf.js returns positioned text runs rather than lines. Runs whose baselines
 * sit within `rowTolerance` points are one row; within a row they are ordered
 * left to right, and a horizontal gap wider than one point becomes two spaces,
 * which is enough for column-splitting regexes written against
 * `pdftotext -layout` output (they split on `\s+`). Pages are separated by a
 * form feed, as pdftotext does.
 *
 * Checked on 2026-11-22 against `pdftotext -layout` on 33 CEN Chile daily
 * operation summaries (18 Oct to 20 Nov 2026): the solar reduction parsed by
 * atacama-chile.json.ts was identical on every one.
 */
export async function pdfToText(bytes: Uint8Array, rowTolerance = 2): Promise<string> {
  // pdf.js may transfer (detach) the buffer it is given, so hand it a copy.
  const doc = await getDocument({
    data: bytes.slice(),
    disableFontFace: true,
    isEvalSupported: false,
    verbosity: 0,
  }).promise;
  try {
    const pages: string[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const runs = content.items
        .filter((it): it is typeof it & { str: string; transform: number[]; width: number } =>
          "str" in it && it.str.trim() !== "")
        .map((it) => ({ s: it.str, x: it.transform[4], y: it.transform[5], w: it.width }))
        .sort((a, b) => b.y - a.y || a.x - b.x);
      const rows: { y: number; runs: typeof runs }[] = [];
      for (const run of runs) {
        const row = rows.at(-1);
        if (row && Math.abs(row.y - run.y) <= rowTolerance) row.runs.push(run);
        else rows.push({ y: run.y, runs: [run] });
      }
      pages.push(
        rows
          .map((row) => {
            row.runs.sort((a, b) => a.x - b.x);
            let line = "";
            let end = -Infinity;
            for (const run of row.runs) {
              line += (line && run.x - end > 1 ? "  " : "") + run.s;
              end = run.x + run.w;
            }
            return line;
          })
          .join("\n"),
      );
      page.cleanup();
    }
    return pages.join("\n\f");
  } finally {
    await doc.destroy();
  }
}
