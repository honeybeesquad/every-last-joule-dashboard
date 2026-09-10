#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { parseRajasthanCurtailmentListing } from "./rajasthan-curtailment-reconciliation.mjs";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "docs/research");
const STAMP = "2026-05-07";
const LISTING_URL = "https://sldc.rajasthan.gov.in/rrvpnl/re-curtailment";
const DOWNLOADS_URL = "https://sldc.rajasthan.gov.in/rrvpnl/downloads";
const MONTH_NAME_TO_NUM = new Map([
  ["jan", "01"],
  ["january", "01"],
  ["feb", "02"],
  ["february", "02"],
  ["mar", "03"],
  ["march", "03"],
  ["apr", "04"],
  ["april", "04"],
  ["may", "05"],
  ["jun", "06"],
  ["june", "06"],
  ["jul", "07"],
  ["july", "07"],
  ["aug", "08"],
  ["august", "08"],
  ["sep", "09"],
  ["sept", "09"],
  ["september", "09"],
  ["oct", "10"],
  ["october", "10"],
  ["nov", "11"],
  ["november", "11"],
  ["dec", "12"],
  ["december", "12"],
]);

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function listingUrlForMonth(spec) {
  const match = String(spec).match(/^(20\d{2})-(\d{1,2})$/);
  if (!match) throw new Error(`Invalid month spec ${spec}; expected YYYY-MM`);
  return `${LISTING_URL}?year=${match[1]}&month=${Number(match[2])}`;
}

function fetchText(url) {
  return execFileSync("curl", ["-L", "--silent", "--show-error", "--connect-timeout", "20", "--max-time", "60", url], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
}

function monthRange(start, end) {
  const out = [];
  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  for (let year = startYear, month = startMonth; year < endYear || (year === endYear && month <= endMonth); month++) {
    if (month === 13) {
      year += 1;
      month = 1;
    }
    out.push(`${year}-${String(month).padStart(2, "0")}`);
  }
  return out;
}

function inferReportMonth(title, url = "") {
  const text = `${title} ${url}`.toLowerCase();
  const numericDateMatch = text.match(/(?:^|[^0-9])\d{1,2}[._-](\d{1,2})[._-](20\d{2})(?:[^0-9]|$)/);
  if (numericDateMatch) return `${numericDateMatch[2]}-${numericDateMatch[1].padStart(2, "0")}`;

  const yearMatch = text.match(/(?:^|[^0-9])(20\d{2})(?:[^0-9]|$)/);
  if (!yearMatch) return "";
  for (const [name, month] of MONTH_NAME_TO_NUM.entries()) {
    if (new RegExp(`(^|[^a-z])${name}\\.?([^a-z]|$)`, "i").test(text)) return `${yearMatch[1]}-${month}`;
  }
  return "";
}

function isCurtailmentReport(report) {
  const text = `${report.title} ${report.url}`.toLowerCase();
  return text.includes("curtailment_re_power") || text.includes("re_curtailment") || text.includes("curtailment-re-power");
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const args = process.argv.slice(2);
  const includeDefaultViews = !args.includes("--month-filters-only");
  const months = args.filter((arg) => !arg.startsWith("--"));
  if (!months.length) months.push(...monthRange("2025-01", "2026-05"));
  const rows = [];
  const seen = new Set();
  const listingViews = months.map((month) => ({
    sourceView: "month_filter",
    filterMonth: month,
    listingUrl: listingUrlForMonth(month),
  }));
  if (includeDefaultViews) {
    listingViews.push(
      { sourceView: "re_curtailment_default", filterMonth: "", listingUrl: LISTING_URL },
      { sourceView: "downloads_default", filterMonth: "", listingUrl: DOWNLOADS_URL },
    );
  }

  for (const { sourceView, filterMonth, listingUrl } of listingViews) {
    const reports = parseRajasthanCurtailmentListing(fetchText(listingUrl));
    for (const report of reports.filter(isCurtailmentReport)) {
      const key = report.url;
      const reportMonth = inferReportMonth(report.title, report.url);
      rows.push({
        sourceView,
        filterMonth,
        reportMonth,
        title: report.title,
        url: report.url,
        monthMismatch: filterMonth && reportMonth && reportMonth !== filterMonth ? "yes" : "no",
        duplicateUrl: seen.has(key) ? "yes" : "no",
      });
      seen.add(key);
    }
  }

  const scope = `${months[0]}-${months.at(-1)}`;
  const csvPath = path.join(OUT_DIR, `${STAMP}-rajasthan-curtailment-listing-inventory-${scope}.csv`);
  const mdPath = path.join(OUT_DIR, `${STAMP}-rajasthan-curtailment-listing-inventory-${scope}.md`);

  const csv = [
    ["source_view", "filter_month", "inferred_report_month", "report_title", "source_url", "month_mismatch", "duplicate_url"].join(","),
    ...rows.map((row) => [row.sourceView, row.filterMonth, row.reportMonth, row.title, row.url, row.monthMismatch, row.duplicateUrl].map(csvEscape).join(",")),
  ].join("\n");
  fs.writeFileSync(csvPath, csv);

  const counts = new Map();
  for (const row of rows) {
    if (row.sourceView === "month_filter") counts.set(row.filterMonth, (counts.get(row.filterMonth) ?? 0) + 1);
  }
  const extraViewCounts = new Map();
  for (const row of rows) {
    if (row.sourceView !== "month_filter") extraViewCounts.set(row.sourceView, (extraViewCounts.get(row.sourceView) ?? 0) + 1);
  }
  const uniqueReportMonthCounts = new Map();
  const uniqueSeen = new Set();
  for (const row of rows) {
    if (uniqueSeen.has(row.url)) continue;
    uniqueSeen.add(row.url);
    const month = row.reportMonth || "unknown";
    uniqueReportMonthCounts.set(month, (uniqueReportMonthCounts.get(month) ?? 0) + 1);
  }

  const md = [];
  md.push("# Rajasthan SLDC Listing Inventory");
  md.push("");
  md.push(`Generated by \`node scripts/research/rajasthan-curtailment-listing-inventory.mjs ${months.join(" ")}\`.`);
  md.push("");
  md.push("This is a listing inventory only. It does not parse PDF contents or imply non-listed months are zero-curtailment months. Default listing/download views are included to detect report URLs that month filters may miss.");
  md.push("");
  md.push("## Monthly Report Counts");
  md.push("");
  md.push("| Month | Reports |");
  md.push("|---|---:|");
  for (const month of months) md.push(`| ${month} | ${counts.get(month) ?? 0} |`);
  md.push("");
  if (extraViewCounts.size) {
    md.push("## Additional Listing View Counts");
    md.push("");
    md.push("| Source View | Reports |");
    md.push("|---|---:|");
    for (const [sourceView, count] of [...extraViewCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      md.push(`| ${sourceView} | ${count} |`);
    }
    md.push("");
  }
  md.push("## Unique Inferred Report-Month Counts");
  md.push("");
  md.push("| Inferred Report Month | Unique Reports |");
  md.push("|---|---:|");
  for (const [month, count] of [...uniqueReportMonthCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    md.push(`| ${month} | ${count} |`);
  }
  md.push("");
  md.push("## Reports");
  md.push("");
  md.push("| Source View | Filter Month | Inferred Report Month | Report | Month Mismatch | Duplicate URL |");
  md.push("|---|---|---|---|---|---|");
  for (const row of rows) md.push(`| ${row.sourceView} | ${row.filterMonth} | ${row.reportMonth || ""} | [${row.title}](${row.url}) | ${row.monthMismatch} | ${row.duplicateUrl} |`);
  md.push("");
  fs.writeFileSync(mdPath, md.join("\n"));

  console.log(`${mdPath}\n${csvPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
