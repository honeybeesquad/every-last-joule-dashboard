#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const SOURCE_URL = "https://kptclsldc.in/recurtail.aspx";
const DIRECT_BASE_URL = "https://kptclsldc.in/RE%20Curtailment/";
const OUT_DIR = path.join(process.cwd(), "docs/research/karnataka-postback-probe");
const ARTIFACT_DIR = path.join(process.cwd(), "docs/research");
const STAMP = "2026-05-07";
const REPORTS = [
  "07sep2019.pdf",
  "08sep2019.pdf",
  "Re curtailment 25.08.2024.pdf",
  "recurtail_17june2021.pdf",
  "recurtail_20june2021.pdf",
  "RE_curtail_16May2021.pdf",
];

function curl(args, options = {}) {
  return execFileSync("curl", ["-L", "--silent", "--show-error", "--connect-timeout", "20", "--max-time", "60", ...args], {
    encoding: options.encoding ?? "utf8",
    maxBuffer: 100 * 1024 * 1024,
  });
}

function hidden(html, name) {
  const match = html.match(new RegExp(`name="${name}" id="${name}" value="([^"]*)"`));
  if (!match) throw new Error(`Missing ${name}`);
  return match[1];
}

function slug(name) {
  return name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function directUrl(report) {
  return `${DIRECT_BASE_URL}${encodeURIComponent(report)}`;
}

function postback(report, html, cookiePath) {
  const output = path.join(OUT_DIR, `${slug(report)}.bin`);
  const headers = path.join(OUT_DIR, `${slug(report)}.headers`);
  const data = [
    ["__EVENTTARGET", "MyTree"],
    ["__EVENTARGUMENT", `sRE Curtailment\\${report}`],
    ["__VIEWSTATE", hidden(html, "__VIEWSTATE")],
    ["__VIEWSTATEGENERATOR", hidden(html, "__VIEWSTATEGENERATOR")],
    ["__EVENTVALIDATION", hidden(html, "__EVENTVALIDATION")],
  ];
  const args = ["-b", cookiePath, "-c", cookiePath, "-D", headers, "-o", output, SOURCE_URL];
  for (const [key, value] of data) args.push("--data-urlencode", `${key}=${value}`);
  execFileSync("curl", ["-L", "--silent", "--show-error", "--connect-timeout", "20", "--max-time", "60", ...args], {
    stdio: "inherit",
  });
  return { output, headers };
}

function pdfInfo(pdfPath) {
  return execFileSync("pdfinfo", [pdfPath], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
}

function pdfText(pdfPath) {
  return execFileSync("pdftotext", ["-layout", pdfPath, "-"], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
}

function normalizeTime(value) {
  return String(value ?? "").replace(".", ":");
}

function parseInstructions(report, text) {
  const compact = text.replace(/\s+/g, " ").trim();
  const dateMatch = compact.match(/\b(\d{2})[./-](\d{2})[./-](\d{4})\b/);
  const date = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : "";
  const fuel = /wind\s*&\s*solar|both\s+wind\s+and\s+solar/i.test(compact) ? "mixed_wind_solar" : "unknown";
  const rows = [];
  const pattern = /(?:curtail\s+)?(\d+(?:\.\d+)?)(?:\s+to\s+(\d+(?:\.\d+)?))?%\s+of\s+present\s+RE(?:\s+Generation)?[\s\S]*?(?:(?:from\s+(\d{1,2}[:.]\d{2})\s*(?:hrs?)?\s+to\s+(\d{1,2}[:.]\d{2})\s*(?:hrs?)?)|(?:up to\s+(\d{1,2}[:.]\d{2})\s*(?:hrs?)?))/ig;
  for (const match of compact.matchAll(pattern)) {
    rows.push({
      report,
      date,
      fuel,
      fromTime: normalizeTime(match[3] ?? ""),
      toTime: normalizeTime(match[4] ?? match[5] ?? ""),
      curtailmentPercent: match[2] ? `${match[1]}-${match[2]}` : match[1],
      instructionText: compact,
    });
  }
  if (rows.length) return rows;
  return [{
    report,
    date,
    fuel,
    fromTime: "",
    toTime: "",
    curtailmentPercent: "",
    instructionText: compact,
  }];
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function inferredDate(report) {
  const lower = report.toLowerCase();
  const numeric = lower.match(/(\d{2})[.]?(\d{2})[.]?(\d{4})/);
  if (numeric) return `${numeric[3]}-${numeric[2]}-${numeric[1]}`;
  const compact = lower.match(/(\d{2})([a-z]{3,9})(\d{4})/);
  if (!compact) return "";
  const months = new Map([
    ["may", "05"],
    ["june", "06"],
    ["jun", "06"],
    ["sep", "09"],
  ]);
  return `${compact[3]}-${months.get(compact[2]) ?? ""}-${compact[1]}`;
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const cookiePath = path.join(OUT_DIR, "cookies.txt");
  const htmlPath = path.join(OUT_DIR, "recurtail.html");
  const html = curl(["-c", cookiePath, SOURCE_URL]);
  fs.writeFileSync(htmlPath, html);

  const rows = [];
  const artifactRows = [];
  for (const report of REPORTS) {
    const { output, headers } = postback(report, html, cookiePath);
    const firstBytes = fs.readFileSync(output).subarray(0, 16).toString("latin1");
    const headerText = fs.readFileSync(headers, "utf8");
    const contentType = headerText.match(/^content-type:\s*(.+)$/im)?.[1]?.trim() ?? "";
    const iframeSrc = fs.readFileSync(output, "utf8").match(/<iframe[^>]+src="([^"]+)"/i)?.[1] ?? "";
    const url = iframeSrc ? new URL(iframeSrc, SOURCE_URL).href.replace(/ /g, "%20") : directUrl(report);
    const pdfPath = path.join(OUT_DIR, `${slug(report)}.pdf`);
    execFileSync("curl", ["-L", "--silent", "--show-error", "--connect-timeout", "20", "--max-time", "60", "-o", pdfPath, url], {
      stdio: "inherit",
    });
    const info = pdfInfo(pdfPath);
    const text = pdfText(pdfPath);
    fs.writeFileSync(path.join(OUT_DIR, `${slug(report)}.txt`), text);
    const pages = info.match(/^Pages:\s+(\d+)$/m)?.[1] ?? "";
    const instructions = parseInstructions(report, text);
    rows.push({ report, output, headers, firstBytes, contentType, iframeSrc, url, pdfPath, pages });
    artifactRows.push(...instructions.map((instruction) => ({
      ...instruction,
      sourceUrl: url,
      pages,
      pdftotextStatus: text.trim() ? "text_extracted" : "no_text",
      containsCurtailmentInstruction: instruction.curtailmentPercent ? "yes" : "unclear",
    })));
  }

  const csvPath = path.join(ARTIFACT_DIR, `${STAMP}-karnataka-curtailment-instruction-inventory.csv`);
  const mdPath = path.join(ARTIFACT_DIR, `${STAMP}-karnataka-curtailment-instruction-inventory.md`);
  const csvHeader = [
    "report_name",
    "inferred_report_date",
    "source_url",
    "pages",
    "pdftotext_status",
    "fuel",
    "from_time",
    "to_time",
    "curtailment_percent",
    "contains_curtailment_instruction",
    "notes",
  ];
  const csv = [
    csvHeader.join(","),
    ...artifactRows.map((row) => [
      row.report,
      row.date || inferredDate(row.report),
      row.sourceUrl,
      row.pages,
      row.pdftotextStatus,
      row.fuel,
      row.fromTime,
      row.toTime,
      row.curtailmentPercent,
      row.containsCurtailmentInstruction,
      row.curtailmentPercent ? "Instruction percentage only; no source MW/MWh extracted." : "No structured curtailment percentage parsed.",
    ].map(csvEscape).join(",")),
  ].join("\n");
  fs.writeFileSync(csvPath, `${csv}\n`);

  const md = [];
  md.push("# Karnataka SLDC RE Curtailment Instruction Inventory");
  md.push("");
  md.push(`Generated by \`node scripts/research/karnataka-curtailment-postback-probe.mjs\`.`);
  md.push("");
  md.push("This is a source inventory and instruction-level extraction only. These PDFs contain curtailment instructions/percentages, not source-verified curtailed MWh. Do not annualize these rows or use them as production energy observations.");
  md.push("");
  md.push("## Source Inventory");
  md.push("");
  md.push("| Report | Inferred Date | Direct URL | Pages | Text Status |");
  md.push("|---|---|---|---:|---|");
  const inventoryRows = new Map();
  for (const row of artifactRows) {
    if (!inventoryRows.has(row.report)) inventoryRows.set(row.report, row);
  }
  for (const row of inventoryRows.values()) {
    md.push(`| ${row.report} | ${row.date || inferredDate(row.report)} | [PDF](${row.sourceUrl}) | ${row.pages} | ${row.pdftotextStatus} |`);
  }
  md.push("");
  md.push("## Parsed Instruction Fields");
  md.push("");
  md.push("| Report | Fuel | Period | Curtailment % | Status |");
  md.push("|---|---|---|---:|---|");
  for (const row of artifactRows) {
    md.push(`| ${row.report} | ${row.fuel} | ${row.fromTime || ""}-${row.toTime || ""} | ${row.curtailmentPercent || ""} | ${row.containsCurtailmentInstruction} |`);
  }
  md.push("");
  md.push("## Production Caveats");
  md.push("");
  md.push("- These PDFs currently support an official instruction-event inventory, not an energy-total series.");
  md.push("- `curtailment_percent` is not directly convertible to MWh without contemporaneous available RE generation by fuel and interval.");
  md.push("- Treat the direct URL pattern as source-verified only for the six reports listed on `https://kptclsldc.in/recurtail.aspx`.");
  md.push("");
  fs.writeFileSync(mdPath, md.join("\n"));

  console.log(`${mdPath}\n${csvPath}`);
  console.log(JSON.stringify(rows, null, 2));
}

main();
