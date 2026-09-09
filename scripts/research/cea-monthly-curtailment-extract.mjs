#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const OUT_DIR = path.join(process.cwd(), "docs/research");
const STAMP = "2026-05-07";

const VERIFIED_PDFS = [
  {
    reportMonth: "2019-12",
    url: "https://cea.nic.in/wp-content/uploads/2020/02/renewable-12.pdf",
    fallbackPath: "/private/tmp/cea-renewable-dec2019.pdf",
  },
  {
    reportMonth: "2021-12",
    url: "https://cea.nic.in/wp-content/uploads/resd/2022/01/Broad_overview_December_21.pdf",
    fallbackPath: "/private/tmp/cea-renewable-dec2021.pdf",
  },
  {
    reportMonth: "2025-01",
    url: "https://cea.nic.in/wp-content/uploads/resd/2025/02/Broad_Overview_of_RE_Generation_January_2025.pdf",
    fallbackPath: "/private/tmp/cea-renewable-jan2025.pdf",
  },
];

const STATES = [
  "Andhra Pradesh",
  "Telangana",
  "Tamil Nadu",
  "Karnataka",
  "Maharashtra",
  "Gujarat",
  "Rajasthan",
  "Madhya Pradesh",
];

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: options.encoding ?? "utf8",
    maxBuffer: 100 * 1024 * 1024,
    stdio: options.stdio,
  });
}

function download(url, pdfPath) {
  run("curl", ["-L", "--silent", "--show-error", "--connect-timeout", "30", "--max-time", "120", "-o", pdfPath, url], {
    stdio: "pipe",
  });
}

function pdfPages(pdfPath) {
  const info = run("pdfinfo", [pdfPath]);
  return info.match(/^Pages:\s+(\d+)$/m)?.[1] ?? "";
}

function tableBlock(text) {
  const starts = [...text.matchAll(/RE Curtailment Data as available from SLDCs/ig)].map((match) => match.index ?? -1);
  const start = starts.at(-1) ?? -1;
  if (start < 0) return "";
  const rest = text.slice(start);
  const end = rest.search(/\n\s*(?:Table\s+12|Deviation Data)/i);
  return end >= 0 ? rest.slice(0, end) : rest;
}

function normalizeBlock(block) {
  return block
    .replace(/Bac\s+kDownWind/g, "BackDownWind")
    .replace(/monthlyReDsm\s+Reports/g, "monthlyReDsmReports")
    .replace(/\s+/g, " ")
    .trim();
}

function statePattern(state) {
  if (state === "Andhra Pradesh") return "Andhra(?:\\s+Pradesh)?";
  if (state === "Madhya Pradesh") return "Madhya(?:\\s+Pradesh)?";
  return state.replaceAll(" ", "\\s+");
}

function cleanSourceText(sourceText, state) {
  let cleaned = sourceText;
  if (state === "Andhra Pradesh" || state === "Madhya Pradesh") {
    cleaned = cleaned.replace(/^Pradesh\s+/, "");
  }
  return cleaned
    .replace(/\bWebsite-\s+Pradesh\s+(?=https?:\/\/)/g, "Website- ")
    .replace(/\bCorporation\s+Pradesh\s+Ltd\./g, "Corporation Ltd.")
    .replace(/\bLtd\.-\s+Pradesh\s+(?=https?:\/\/)/g, "Ltd.-")
    .replace(/\s+CENTRAL ELECTRICITY AUTHORITY\s+PAGE\s+\d+\s*$/i, "")
    .replace(/\s+PAGE\s+\d+\s*$/i, "")
    .trim();
}

function parseStateRows(block) {
  const s = normalizeBlock(block);
  const rows = [];
  for (let index = 0; index < STATES.length; index++) {
    const state = STATES[index];
    const nextState = STATES[index + 1];
    const startPattern = new RegExp(`\\b${index + 1}\\.\\s+${statePattern(state)}\\b`, "i");
    const start = s.search(startPattern);
    if (start < 0) continue;
    const afterStart = s.slice(start).replace(startPattern, "").trim();
    let segment = afterStart;
    if (nextState) {
      const nextPattern = new RegExp(`\\b${index + 2}\\.\\s+${statePattern(nextState)}\\b`, "i");
      const next = afterStart.search(nextPattern);
      if (next >= 0) segment = afterStart.slice(0, next).trim();
    }

    const valueMatch = segment.match(/^([0-9]+(?:\.[0-9]+)?|-|_)\b\s*(.*)$/);
    const rawValue = valueMatch ? valueMatch[1] : "";
    const sourceText = cleanSourceText(valueMatch ? valueMatch[2] : segment, state);
    const numeric = /^[0-9]+(?:\.[0-9]+)?$/.test(rawValue) ? Number(rawValue) : null;
    rows.push({
      state,
      rawValue,
      curtailmentMu: numeric,
      curtailmentTwh: numeric == null ? null : numeric * 0.001,
      sourceText,
      confidence: sourceText || rawValue ? "medium" : "low",
    });
  }
  return rows;
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const inventory = [];
  const extracted = [];

  for (const pdf of VERIFIED_PDFS) {
    const pdfPath = path.join(os.tmpdir(), `cea-curtailment-${pdf.reportMonth}.pdf`);
    try {
      let accessStatus = "downloaded";
      try {
        download(pdf.url, pdfPath);
      } catch (err) {
        if (!pdf.fallbackPath || !fs.existsSync(pdf.fallbackPath)) throw err;
        fs.copyFileSync(pdf.fallbackPath, pdfPath);
        accessStatus = "local_fallback";
      }
      const pages = pdfPages(pdfPath);
      const text = run("pdftotext", ["-layout", pdfPath, "-"]);
      const block = tableBlock(text);
      const tableFound = block ? "yes" : "no";
      const tablePage = block.match(/\bPAGE\s+(\d+)\b/i)?.[1] ?? "";
      inventory.push({ ...pdf, accessStatus, pages, tableFound, notes: "" });
      if (!block) continue;
      const rows = parseStateRows(block);
      for (const row of rows) {
        extracted.push({
          reportMonth: pdf.reportMonth,
          officialPdfUrl: pdf.url,
          tablePage,
          extractionMethod: "pdftotext_layout",
          ...row,
        });
      }
    } catch (err) {
      inventory.push({ ...pdf, accessStatus: "failed", pages: "", tableFound: "unclear", notes: err.message });
    }
  }

  const csvPath = path.join(OUT_DIR, `${STAMP}-cea-monthly-curtailment.csv`);
  const mdPath = path.join(OUT_DIR, `${STAMP}-cea-monthly-curtailment.md`);
  const csv = [
    [
      "report_month",
      "state",
      "curtailment_mu",
      "curtailment_twh",
      "source_text",
      "official_pdf_url",
      "table_page",
      "extraction_method",
      "confidence",
      "notes",
    ].join(","),
    ...extracted.map((row) => [
      row.reportMonth,
      row.state,
      row.curtailmentMu == null ? "" : row.curtailmentMu.toFixed(2).replace(/\.00$/, ""),
      row.curtailmentTwh == null ? "" : row.curtailmentTwh.toFixed(6),
      row.sourceText,
      row.officialPdfUrl,
      row.tablePage,
      row.extractionMethod,
      row.confidence,
      row.rawValue && row.curtailmentMu == null ? `Non-numeric table value: ${row.rawValue}` : "",
    ].map(csvEscape).join(",")),
  ].join("\n");
  fs.writeFileSync(csvPath, `${csv}\n`);

  const md = [];
  md.push("# CEA Monthly RE Curtailment Extraction");
  md.push("");
  md.push(`Generated by \`node scripts/research/cea-monthly-curtailment-extract.mjs\`.`);
  md.push("");
  md.push("This is an official CEA monthly-anchor extraction. Numeric values are monthly curtailment in MU as published in CEA's `RE Curtailment Data as available from SLDCs` table. Blank, dash, and underscore values are treated as missing, not zero.");
  md.push("");
  md.push("## PDF Inventory");
  md.push("");
  md.push("| Report Month | Official PDF | Access | Pages | Table Found | Notes |");
  md.push("|---|---|---|---:|---|---|");
  for (const item of inventory) {
    md.push(`| ${item.reportMonth} | [PDF](${item.url}) | ${item.accessStatus} | ${item.pages} | ${item.tableFound} | ${item.notes || ""} |`);
  }
  md.push("");
  md.push("## Extracted Rows");
  md.push("");
  md.push("| Month | State | Curtailment MU | Curtailment TWh | Source Text | Confidence |");
  md.push("|---|---|---:|---:|---|---|");
  for (const row of extracted) {
    const mu = row.curtailmentMu == null ? "" : row.curtailmentMu.toFixed(2).replace(/\.00$/, "");
    const twh = row.curtailmentTwh == null ? "" : row.curtailmentTwh.toFixed(6);
    md.push(`| ${row.reportMonth} | ${row.state} | ${mu} | ${twh} | ${row.sourceText} | ${row.confidence} |`);
  }
  md.push("");
  md.push("## Method Notes");
  md.push("");
  md.push("- `1 MU = 0.001 TWh`.");
  md.push("- Non-numeric values (`-`, `_`, blank) are missing values, not zeros.");
  md.push("- This is monthly state-level CEA anchor data; it is not event-level SLDC data.");
  md.push("");
  fs.writeFileSync(mdPath, md.join("\n"));

  console.log(`${mdPath}\n${csvPath}`);
}

main();
