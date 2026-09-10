#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "docs/research");
const STAMP = "2026-05-07";
const LISTING_URL = "https://sldc.rajasthan.gov.in/rrvpnl/re-curtailment";
const MANUAL_EXTRACTIONS = path.join(OUT_DIR, "rajasthan-curtailment-manual-extractions.csv");
const REPORT_REVIEW = path.join(OUT_DIR, "rajasthan-curtailment-report-review.csv");

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function fmt(value, digits = 6) {
  return Number.isFinite(value) ? value.toFixed(digits) : "";
}

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && quoted && line[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells;
}

function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseRajasthanCurtailmentListing(html) {
  const reports = [];
  const rowRe = /<tr>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td>\s*<a\s+href="([^"]+?\.pdf)"/gi;
  for (const match of html.matchAll(rowRe)) {
    const title = decodeHtml(match[1]);
    const url = decodeHtml(match[2]);
    if (!title || !url) continue;
    reports.push({ title, url });
  }
  return reports;
}

function listingUrlForMonth(spec) {
  const match = String(spec).match(/^(20\d{2})-(\d{1,2})$/);
  if (!match) throw new Error(`Invalid month spec ${spec}; expected YYYY-MM`);
  return `${LISTING_URL}?year=${match[1]}&month=${Number(match[2])}`;
}

function dedupeReports(reports) {
  const seen = new Set();
  const out = [];
  for (const report of reports) {
    if (seen.has(report.url)) continue;
    seen.add(report.url);
    out.push(report);
  }
  return out;
}

function parsePdfDate(text, endIndex = text.length) {
  const prior = text.slice(0, endIndex);
  const matches = [...prior.matchAll(/\bDate\s*:\s*(\d{1,2})\s*[/.:-]\s*(\d{1,2})\s*[/.:-]\s*(20\d{2})\b/gi)];
  const match = matches.at(-1);
  if (!match) return "";
  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  return `${match[3]}-${month}-${day}`;
}

function parseTimeMatch(match) {
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return { hour, minute };
}

function parseTimeText(text) {
  const match = String(text).match(/^(\d{1,2}):(\d{2})$/);
  return match ? parseTimeMatch(match) : null;
}

function formatTime(t) {
  return `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`;
}

function orderedPeriod(times) {
  if (times.length < 2) return null;
  const sorted = [...times].sort((a, b) => (a.hour + a.minute / 60) - (b.hour + b.minute / 60));
  return { from: sorted[0], to: sorted[sorted.length - 1] };
}

function durationHours(from, to) {
  let start = from.hour + from.minute / 60;
  let end = to.hour + to.minute / 60;
  if (end < start) end += 24;
  return end - start;
}

function extractTimes(text) {
  const times = [];
  const withHours = /\b(\d{1,2})[.:](\d{2})\s*hrs?\b/gi;
  const withSeconds = /\b(\d{1,2}):(\d{2}):\d{2}\b/g;
  for (const match of text.matchAll(withHours)) {
    const time = parseTimeMatch(match);
    if (time) times.push(time);
  }
  for (const match of text.matchAll(withSeconds)) {
    const time = parseTimeMatch(match);
    if (time) times.push(time);
  }
  const seen = new Set();
  return times.filter((time) => {
    const key = formatTime(time);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractTimeCandidates(lines, centerLine, radius = 6) {
  const candidates = [];
  const start = Math.max(0, centerLine - radius);
  const end = Math.min(lines.length, centerLine + radius + 1);
  for (let lineIndex = start; lineIndex < end; lineIndex++) {
    for (const time of extractTimes(lines[lineIndex])) {
      candidates.push({ time, lineIndex, distance: Math.abs(lineIndex - centerLine) });
    }
  }
  return candidates;
}

function periodNearLine(lines, lineIndex) {
  const sameLine = extractTimes(lines[lineIndex]);
  if (sameLine.length >= 2) return orderedPeriod(sameLine);

  const candidates = extractTimeCandidates(lines, lineIndex);
  const laterCandidates = candidates.filter((candidate) => candidate.lineIndex > lineIndex).sort((a, b) => a.distance - b.distance);
  const earlierCandidates = candidates.filter((candidate) => candidate.lineIndex < lineIndex).sort((a, b) => a.distance - b.distance);
  if (sameLine.length === 1) {
    const other = laterCandidates[0] ?? earlierCandidates[0];
    return other ? orderedPeriod([sameLine[0], other.time]) : null;
  }

  if (laterCandidates.length >= 2) return orderedPeriod(laterCandidates.slice(0, 2).map((candidate) => candidate.time));

  const nearest = candidates
    .sort((a, b) => a.distance - b.distance || a.lineIndex - b.lineIndex)
    .slice(0, 2)
    .map((candidate) => candidate.time);
  return orderedPeriod(nearest);
}

function fuelValues(text) {
  const byFuel = new Map();
  for (const match of text.matchAll(/\b(SOLAR|WIND)\s*-\s*([0-9]+(?:\.[0-9]+)?)\b/gi)) {
    const fuel = match[1].toLowerCase();
    const values = byFuel.get(fuel) ?? [];
    values.push(Number(match[2]));
    byFuel.set(fuel, values);
  }
  for (const [fuel, values] of byFuel.entries()) {
    if (values.length < 2) byFuel.delete(fuel);
  }
  return byFuel;
}

function compactReason(text) {
  return text
    .replace(/\bDate\s*:\s*\d{1,2}\s*[/.:-]\s*\d{1,2}\s*[/.:-]\s*20\d{2}\b/gi, " ")
    .replace(/\b\d{1,2}[.:]\d{2}\s*hrs\b/gi, " ")
    .replace(/\b(?:SOLAR|WIND)\s*-\s*\d+(?:\.\d+)?\b/gi, " ")
    .replace(/\bFREQ\s*:-?[0-9.]+[\s\S]*$/i, " ")
    .replace(/\bRUVNL\s*:\s*NIL\b/gi, " ")
    .replace(/\bLD\s*:\s*(?:LD\/OP\/\d+\/\d+)?/gi, " ")
    .replace(/\b\d+\s*kV\s+GSS\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMonthlyCurtailmentSummaryText(text, source = {}) {
  const events = [];
  const date = parsePdfDate(text);
  const normalized = text.replace(/\s+/g, " ");
  const rowRe = /Heavy underdrawl & high\s+.*?\b(\d{1,2}:\d{2})\s*Hrs\s+(\d{1,2}:\d{2})\s*Hrs\s+\d{1,2}:\d{2}Hrs\s+[^O]*?(OP\/\d+\/\d+)\s+frequency\s+([0-9]+(?:\.[0-9]+)?)\s+([0-9]+(?:\.[0-9]+)?)\s+([0-9]+(?:\.[0-9]+)?)\s+([0-9]+(?:\.[0-9]+)?)\s+([0-9]+(?:\.[0-9]+)?)\s+([0-9]+(?:\.[0-9]+)?)/gi;

  for (const match of normalized.matchAll(rowRe)) {
    const from = parseTimeText(match[1]);
    const to = parseTimeText(match[2]);
    if (!from || !to) continue;
    const hours = durationHours(from, to);
    const actualSolarMW = Number(match[4]);
    const actualWindMW = Number(match[5]);
    const reliefSolarMW = Number(match[7]);
    const reliefWindMW = Number(match[8]);
    const base = {
      reportTitle: source.title ?? "",
      sourceUrl: source.url ?? "",
      date,
      fromTime: formatTime(from),
      toTime: formatTime(to),
      durationHours: hours,
      reason: `Heavy underdrawl & high frequency (${match[3]})`,
    };
    if (Number.isFinite(reliefSolarMW) && reliefSolarMW > 0) {
      events.push({
        ...base,
        fuel: "solar",
        actualGenerationMW: Number.isFinite(actualSolarMW) ? actualSolarMW : null,
        reliefMW: reliefSolarMW,
        curtailedMWh: reliefSolarMW * hours,
        curtailedTWh: reliefSolarMW * hours / 1_000_000,
        extractionMethod: "pdf_text_monthly_summary",
        confidence: "high",
      });
    }
    if (Number.isFinite(reliefWindMW) && reliefWindMW > 0) {
      events.push({
        ...base,
        fuel: "wind",
        actualGenerationMW: Number.isFinite(actualWindMW) ? actualWindMW : null,
        reliefMW: reliefWindMW,
        curtailedMWh: reliefWindMW * hours,
        curtailedTWh: reliefWindMW * hours / 1_000_000,
        extractionMethod: "pdf_text_monthly_summary",
        confidence: "high",
      });
    }
  }

  return events;
}

export function parseRajasthanCurtailmentPdfText(text, source = {}) {
  const events = [];
  const lines = text.split(/\r?\n/);
  const offsets = [];
  let offset = 0;
  for (const line of lines) {
    offsets.push(offset);
    offset += line.length + 1;
  }

  const consumed = new Set();
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    if (consumed.has(lineIndex)) continue;
    const byFuel = fuelValues(lines[lineIndex]);
    if (!byFuel.size) continue;

    const groupLines = [lines[lineIndex]];
    for (let nextLine = lineIndex + 1; nextLine <= Math.min(lines.length - 1, lineIndex + 2); nextLine++) {
      const nextValues = fuelValues(lines[nextLine]);
      if (!nextValues.size) continue;
      for (const [fuel, values] of nextValues.entries()) {
        if (!byFuel.has(fuel)) byFuel.set(fuel, values);
      }
      groupLines.push(lines[nextLine]);
      consumed.add(nextLine);
    }

    const normalized = groupLines.join(" ").replace(/\s+/g, " ");
    const period = periodNearLine(lines, lineIndex);
    if (!period) continue;
    const hours = durationHours(period.from, period.to);
    if (!Number.isFinite(hours) || hours <= 0) continue;

    for (const [fuel, values] of byFuel.entries()) {
      const actualMW = values[0];
      const reliefMW = values[1];
      if (!Number.isFinite(reliefMW) || reliefMW < 0) continue;
      events.push({
        reportTitle: source.title ?? "",
        sourceUrl: source.url ?? "",
        date: parsePdfDate(text, offsets[lineIndex]),
        fuel,
        fromTime: formatTime(period.from),
        toTime: formatTime(period.to),
        durationHours: hours,
        actualGenerationMW: Number.isFinite(actualMW) ? actualMW : null,
        reliefMW,
        curtailedMWh: reliefMW * hours,
        curtailedTWh: reliefMW * hours / 1_000_000,
        reason: compactReason(normalized),
        extractionMethod: "pdf_text_event_row",
        confidence: "high",
      });
    }
  }

  return [...events, ...parseMonthlyCurtailmentSummaryText(text, source)];
}

function fetchBuffer(url) {
  return execFileSync("curl", ["-L", "--silent", "--show-error", "--connect-timeout", "20", "--max-time", "60", url], { maxBuffer: 100 * 1024 * 1024 });
}

function pdfTextFromUrl(url, index) {
  const pdfPath = path.join(os.tmpdir(), `rajasthan-curtailment-${process.pid}-${index}.pdf`);
  fs.writeFileSync(pdfPath, fetchBuffer(url));
  return execFileSync("pdftotext", ["-layout", pdfPath, "-"], { encoding: "utf8", maxBuffer: 100 * 1024 * 1024 });
}

export function parseManualExtractionsCsv(csv) {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim());
  const headers = parseCsvLine(lines.shift() ?? "");
  const rows = [];
  for (const line of lines) {
    const cells = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
    const from = parseTimeText(row.from_time);
    const to = parseTimeText(row.to_time);
    if (!from || !to) continue;
    const duration = durationHours(from, to);
    const reliefMW = Number(row.relief_mw);
    const actualGenerationMW = Number(row.actual_generation_mw);
    rows.push({
      reportTitle: row.report_title,
      sourceUrl: row.source_url,
      date: row.date,
      fuel: row.fuel,
      fromTime: row.from_time,
      toTime: row.to_time,
      durationHours: duration,
      actualGenerationMW: Number.isFinite(actualGenerationMW) ? actualGenerationMW : null,
      reliefMW,
      curtailedMWh: reliefMW * duration,
      curtailedTWh: reliefMW * duration / 1_000_000,
      reason: row.reason,
      extractionMethod: row.extraction_method,
      confidence: row.confidence,
      sourcePage: row.source_page || sourcePageFromNotes(row.notes),
      notes: row.notes,
    });
  }
  return rows;
}

function sourcePageFromNotes(notes) {
  const match = String(notes ?? "").match(/\bpage\s+(\d+)\b/i);
  return match ? match[1] : "";
}

function manualExtractions() {
  if (!fs.existsSync(MANUAL_EXTRACTIONS)) return [];
  return parseManualExtractionsCsv(fs.readFileSync(MANUAL_EXTRACTIONS, "utf8"));
}

function reportReviews() {
  if (!fs.existsSync(REPORT_REVIEW)) return new Map();
  const lines = fs.readFileSync(REPORT_REVIEW, "utf8").split(/\r?\n/).filter((line) => line.trim());
  const headers = parseCsvLine(lines.shift() ?? "");
  const rows = new Map();
  for (const line of lines) {
    const cells = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
    if (row.source_url) rows.set(row.source_url, row);
  }
  return rows;
}

function monthKey(date) {
  return String(date ?? "").slice(0, 7) || "unknown";
}

function eventMonthlyRows(events) {
  const totals = new Map();
  for (const event of events) {
    const key = [
      monthKey(event.date),
      event.fuel,
      event.extractionMethod ?? "unknown",
      event.confidence ?? "unknown",
    ].join("|");
    const row = totals.get(key) ?? {
      month: monthKey(event.date),
      fuel: event.fuel,
      extractionMethod: event.extractionMethod ?? "unknown",
      confidence: event.confidence ?? "unknown",
      eventRows: 0,
      curtailedMWh: 0,
      curtailedTWh: 0,
    };
    row.eventRows += 1;
    row.curtailedMWh += event.curtailedMWh;
    row.curtailedTWh += event.curtailedTWh;
    totals.set(key, row);
  }
  return [...totals.values()].sort((a, b) =>
    a.month.localeCompare(b.month) ||
    a.fuel.localeCompare(b.fuel) ||
    a.extractionMethod.localeCompare(b.extractionMethod) ||
    a.confidence.localeCompare(b.confidence)
  );
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const args = process.argv.slice(2);
  const monthSpecs = args.filter((arg) => /^20\d{2}-\d{1,2}$/.test(arg));
  const numericArg = args.find((arg) => /^\d+$/.test(arg));
  const limit = monthSpecs.length ? Infinity : Number(numericArg ?? "5");
  const listingUrls = monthSpecs.length ? monthSpecs.map(listingUrlForMonth) : [LISTING_URL];
  const reports = dedupeReports(listingUrls.flatMap((url) => parseRajasthanCurtailmentListing(fetchBuffer(url).toString("utf8"))))
    .slice(0, limit);
  const failures = [];
  const reportStatus = [];
  const events = [];
  const manualEvents = manualExtractions();
  const reviewsByUrl = reportReviews();
  const manualByUrl = new Map();
  for (const event of manualEvents) {
    const rows = manualByUrl.get(event.sourceUrl) ?? [];
    rows.push(event);
    manualByUrl.set(event.sourceUrl, rows);
  }

  for (const [index, report] of reports.entries()) {
    try {
      const text = pdfTextFromUrl(report.url, index + 1);
      const reportEvents = parseRajasthanCurtailmentPdfText(text, report);
      const reportManualEvents = manualByUrl.get(report.url) ?? [];
      const reportReview = reviewsByUrl.get(report.url);
      const textChars = text.replace(/\f/g, "").trim().length;
      const status = reportEvents.length && reportManualEvents.length
        ? "parsed_with_manual_additions"
        : reportEvents.length
          ? "parsed"
          : reportManualEvents.length
            ? "manual_extraction_from_scanned_pdf"
            : reportReview?.status
              ? reportReview.status
            : textChars < 50
              ? "scanned_pdf_no_extractable_text"
              : "text_extracted_no_matching_event_rows";
      events.push(...reportEvents, ...reportManualEvents);
      reportStatus.push({ ...report, events: reportEvents.length + reportManualEvents.length, textChars, status });
    } catch (err) {
      const message = `${report.title}: ${(err).message}`;
      failures.push(message);
      reportStatus.push({ ...report, events: 0, textChars: 0, status: `failed: ${(err).message}` });
    }
  }

  const totalTWh = events.reduce((sum, event) => sum + event.curtailedTWh, 0);
  const scope = monthSpecs.length ? monthSpecs.join("-") : "latest-sample";
  const csvPath = path.join(OUT_DIR, `${STAMP}-rajasthan-curtailment-${scope}.csv`);
  const mdPath = path.join(OUT_DIR, `${STAMP}-rajasthan-curtailment-${scope}.md`);
  const monthlyPath = path.join(OUT_DIR, `${STAMP}-rajasthan-curtailment-${scope}-monthly.csv`);
  const reportStatusPath = path.join(OUT_DIR, `${STAMP}-rajasthan-curtailment-${scope}-report-status.csv`);

  const header = [
    "report_title",
    "date",
    "fuel",
    "from_time",
    "to_time",
    "duration_hours",
    "actual_generation_mw",
    "relief_mw",
    "curtailed_mwh",
    "curtailed_twh",
    "reason",
    "extraction_method",
    "confidence",
    "source_page",
    "notes",
    "source_url",
  ];
  const csvRows = [
    header.join(","),
    ...events.map((event) => [
      event.reportTitle,
      event.date,
      event.fuel,
      event.fromTime,
      event.toTime,
      fmt(event.durationHours, 4),
      fmt(event.actualGenerationMW, 3),
      fmt(event.reliefMW, 3),
      fmt(event.curtailedMWh, 3),
      fmt(event.curtailedTWh, 9),
      event.reason,
      event.extractionMethod,
      event.confidence,
      event.sourcePage ?? "",
      event.notes ?? "",
      event.sourceUrl,
    ].map(csvEscape).join(",")),
  ];
  fs.writeFileSync(csvPath, csvRows.join("\n") + "\n");

  const monthlyRows = eventMonthlyRows(events);
  const monthlyCsv = [
    ["month", "fuel", "extraction_method", "confidence", "event_rows", "curtailed_mwh", "curtailed_twh"].join(","),
    ...monthlyRows.map((row) => [
      row.month,
      row.fuel,
      row.extractionMethod,
      row.confidence,
      row.eventRows,
      fmt(row.curtailedMWh, 3),
      fmt(row.curtailedTWh, 9),
    ].map(csvEscape).join(",")),
  ].join("\n") + "\n";
  fs.writeFileSync(monthlyPath, monthlyCsv);

  const statusCsv = [
    ["report_title", "events", "text_chars", "status", "source_url"].join(","),
    ...reportStatus.map((report) => [
      report.title,
      report.events,
      report.textChars,
      report.status,
      report.url,
    ].map(csvEscape).join(",")),
  ].join("\n") + "\n";
  fs.writeFileSync(reportStatusPath, statusCsv);

  const byFuel = events.reduce((acc, event) => {
    acc[event.fuel] = (acc[event.fuel] ?? 0) + event.curtailedTWh;
    return acc;
  }, {});
  const md = [];
  md.push("# Rajasthan SLDC RE curtailment sample extraction");
  md.push("");
  md.push(`Generated by \`node scripts/research/rajasthan-curtailment-reconciliation.mjs ${args.join(" ") || "5"}\`.`);
  if (monthSpecs.length) md.push(`Month filters: ${monthSpecs.join(", ")}.`);
  md.push("");
  md.push("## Status");
  md.push("");
  md.push("RRVPNL/Rajasthan SLDC publishes RE curtailment PDFs at the public `re-curtailment` listing. This extractor treats each listed event as `Relief (MW) * curtailment-period hours`. That is a source-verified event-energy floor for the parsed reports, not a calendar-year estimate.");
  md.push("");
  md.push("This is intentionally a research reconciliation lane. The production dashboard should stay on its T3 fallback until we complete parser QA across a representative monthly/yearly archive, add OCR/manual extraction for scanned PDFs, and decide whether `Relief (MW)` is the correct annual-energy measure for all report layouts.");
  md.push("");
  md.push("## Parsed Sample");
  md.push("");
  md.push(`- Reports requested: ${reports.length}`);
  md.push(`- Events parsed: ${events.length}`);
  md.push(`- Manual/OCR-assisted rows: ${events.filter((event) => String(event.extractionMethod).includes("manual")).length}`);
  md.push(`- Sample total: ${fmt(totalTWh, 6)} TWh (${fmt(totalTWh * 1_000_000, 1)} MWh)`);
  for (const fuel of Object.keys(byFuel).sort()) {
    md.push(`- ${fuel}: ${fmt(byFuel[fuel], 6)} TWh`);
  }
  md.push("");
  md.push("## Monthly Totals");
  md.push("");
  md.push("| Month | Fuel | Method | Confidence | Rows | MWh | TWh |");
  md.push("|---|---|---|---|---:|---:|---:|");
  for (const row of monthlyRows) {
    md.push(`| ${row.month} | ${row.fuel} | ${row.extractionMethod} | ${row.confidence} | ${row.eventRows} | ${fmt(row.curtailedMWh, 1)} | ${fmt(row.curtailedTWh, 6)} |`);
  }
  md.push("");
  md.push("## Event Rows");
  md.push("");
  md.push("| Date | Fuel | Period | Relief MW | MWh | Method | Page | Report |");
  md.push("|---|---|---|---:|---:|---|---|---|");
  for (const event of events.slice(0, 40)) {
    md.push(`| ${event.date || ""} | ${event.fuel} | ${event.fromTime}-${event.toTime} | ${fmt(event.reliefMW, 1)} | ${fmt(event.curtailedMWh, 1)} | ${event.extractionMethod ?? ""} | ${event.sourcePage ?? ""} | ${event.reportTitle} |`);
  }
  md.push("");
  md.push("## Source Reports");
  md.push("");
  md.push("| Report | Event rows | Text chars | Status |");
  md.push("|---|---:|---:|---|");
  for (const report of reportStatus) md.push(`| [${report.title}](${report.url}) | ${report.events} | ${report.textChars} | ${report.status} |`);
  md.push("");
  if (failures.length) {
    md.push("## Parse Failures");
    md.push("");
    for (const failure of failures) md.push(`- ${failure}`);
    md.push("");
  }
  md.push("## Next QA Checks");
  md.push("");
  md.push("- Use `docs/research/rajasthan-curtailment-report-review.csv` for OCR-reviewed no-row reports, and keep these separate from machine-confirmed zero-curtailment observations.");
  md.push("- Parse every 2025 and 2026 report and compare monthly totals against any RRVPNL/POSOCO/CEA annual or monthly summary that can be independently sourced.");
  md.push("- Manually inspect multi-day and month-bundle PDFs because their tables may repeat dates, scan handwritten end times, or change layout mid-file.");
  md.push("- Confirm whether `Relief (MW)` should be treated as the actual curtailed power, a requested curtailment instruction, or a conservative floor.");
  md.push("");
  fs.writeFileSync(mdPath, md.join("\n"));

  console.log(`${mdPath}\n${csvPath}\n${monthlyPath}\n${reportStatusPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
