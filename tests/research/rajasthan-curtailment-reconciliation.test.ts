import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseManualExtractionsCsv,
  parseRajasthanCurtailmentListing,
  parseRajasthanCurtailmentPdfText,
} from "../../scripts/research/rajasthan-curtailment-reconciliation.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("Rajasthan SLDC curtailment reconciliation", () => {
  it("extracts report titles and PDF URLs from the RRVPNL listing table", () => {
    const html = [
      "<tr>",
      '<td width="80%">Curtailment_RE_Power_05 May - 2026</td>',
      '<td><a href="https://sldc.rajasthan.gov.in/rrvpnl/download/12/example.pdf" download="">Download</a></td>',
      "</tr>",
    ].join("");

    expect(parseRajasthanCurtailmentListing(html)).toEqual([
      {
        title: "Curtailment_RE_Power_05 May - 2026",
        url: "https://sldc.rajasthan.gov.in/rrvpnl/download/12/example.pdf",
      },
    ]);
  });

  it("integrates Relief MW over the stated curtailment periods", () => {
    const text = readFileSync(join(__dirname, "../fixtures/rajasthan-curtailment-2026-05-05.txt"), "utf8");
    const events = parseRajasthanCurtailmentPdfText(text, {
      title: "Curtailment_RE_Power_05 May - 2026",
      url: "https://sldc.rajasthan.gov.in/rrvpnl/download/12/69fac1e7f37a9_Curtailment_RE_Power_05May-2026.pdf",
    });

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      date: "2026-05-05",
      fuel: "solar",
      fromTime: "10:33",
      toTime: "15:01",
      actualGenerationMW: 6578,
      reliefMW: 50,
    });
    expect(events[0].durationHours).toBeCloseTo(4.4667, 4);
    expect(events[0].curtailedMWh).toBeCloseTo(223.333, 3);

    expect(events[1]).toMatchObject({
      date: "2026-05-05",
      fuel: "solar",
      fromTime: "10:48",
      toTime: "14:56",
      actualGenerationMW: 6796,
      reliefMW: 108,
    });
    expect(events[1].durationHours).toBeCloseTo(4.1333, 4);
    expect(events[1].curtailedMWh).toBeCloseTo(446.4, 3);
  });

  it("parses wrapped all-RE rows with separate solar and wind relief values", () => {
    const text = [
      "Date: 03/5/2026",
      "  1                                 ALL RE (SOLAR AND WIND)                                           Kindly Impose 30% curtailment on all solar     SOLAR-4112         SOLAR- 1250    FREQ:-50.14",
      "                                                                                                      and wind generation with immediate effect       WIND-328           & WIND-98       DEMAND :- 10767MW",
      "                                                                                        15:04hrs",
      "                                                              08.51 hrs LD/OP/05/78                         frequency and heavy underdrawl.",
    ].join("\n");

    const events = parseRajasthanCurtailmentPdfText(text, { title: "RE_Curtailment_03_May_2026" });
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      date: "2026-05-03",
      fuel: "solar",
      fromTime: "08:51",
      toTime: "15:04",
      actualGenerationMW: 4112,
      reliefMW: 1250,
    });
    expect(events[0].curtailedMWh).toBeCloseTo(7770.833, 3);
    expect(events[1]).toMatchObject({
      fuel: "wind",
      actualGenerationMW: 328,
      reliefMW: 98,
    });
    expect(events[1].curtailedMWh).toBeCloseTo(609.233, 3);
  });

  it("does not borrow times from the previous event when a lift row wraps its period", () => {
    const text = [
      "Date: 01/5/2026",
      "  1                                 ALL RE (SOLAR AND WIND)                                                    Kindly Impose 40% curtailment on all solar       SOLAR-4374         SOLAR- 1800",
      "                                                                                            14.31 hrs",
      "                                                              08.55 hrs LD/OP/05/06",
      "  2                                                                                                                Lift 20% curtailment (40%-20%=20%             SOLAR-3688         SOLAR- 900",
      "                                                                                             WIND-315          & WIND-45",
      "                                                                                            14.57 hr                            underdrawl.",
      "                                                               14.31 hrs LD/OP/05/10",
    ].join("\n");

    const events = parseRajasthanCurtailmentPdfText(text, { title: "Curtailment_RE_Power_01 & 02 May - 2026" });
    expect(events.find((event) => event.reliefMW === 900)).toMatchObject({
      fuel: "solar",
      fromTime: "14:31",
      toTime: "14:57",
    });
  });

  it("parses monthly summary rows with curtailment MW columns", () => {
    const text = [
      "CURTAILMENT OF RE POWER IN THE MONTH OF April.-2026",
      "Date : 05.04.2026",
      "Heavy underdrawl & high 28 132 KV GSS SRIVIJAYNAGAR 80.00 YES YES 09:03 Hrs 11:07 Hrs 02:03Hrs 35% 35%",
      "OP/04/149 frequency 4659.00 294.00 4953.00 495.00 95.00 590.00",
    ].join(" ");

    const events = parseRajasthanCurtailmentPdfText(text, { title: "Curtailment_RE_Power_05April_2026.pdf" });
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      date: "2026-04-05",
      fuel: "solar",
      fromTime: "09:03",
      toTime: "11:07",
      actualGenerationMW: 4659,
      reliefMW: 495,
    });
    expect(events[0].curtailedMWh).toBeCloseTo(1023, 3);
    expect(events[1]).toMatchObject({
      fuel: "wind",
      actualGenerationMW: 294,
      reliefMW: 95,
    });
  });

  it("integrates manual rows from scanned PDFs without treating them as machine text", () => {
    const csv = [
      "report_title,date,fuel,from_time,to_time,actual_generation_mw,relief_mw,reason,source_url,extraction_method,confidence,notes",
      "Curtailment_RE_Power_29 & 30 April 2026,2026-04-29,solar,10:41,14:50,6530,58,overloading,https://example.test/report.pdf,manual_from_scanned_pdf,medium,handwritten end time",
    ].join("\n");

    const events = parseManualExtractionsCsv(csv);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      date: "2026-04-29",
      fuel: "solar",
      fromTime: "10:41",
      toTime: "14:50",
      actualGenerationMW: 6530,
      reliefMW: 58,
      extractionMethod: "manual_from_scanned_pdf",
      confidence: "medium",
    });
    expect(events[0].durationHours).toBeCloseTo(4.15, 4);
    expect(events[0].curtailedMWh).toBeCloseTo(240.7, 3);
  });
});
