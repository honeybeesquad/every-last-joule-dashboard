import { inflateRawSync } from "zlib";
import { fetchText } from "../lib/fetch.js";
import {
  latestCompleteUtcDayProfileGW,
  peakGW,
  timeOfDayAverageGW,
  totalTWh30d,
} from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";
import { pathToFileURL } from "url";

const EIRGRID_PAGE_URL = "https://www.eirgrid.ie/grid/system-and-renewable-data-reports";
const FALLBACK_DD_HH_URL = "https://cms.eirgrid.ie/sites/default/files/publications/DD-HH-2026-V4.xlsx";
const REPUBLIC_SHARE = 0.58;
const NORTHERN_IRELAND_SHARE = 0.42;
const HALF_HOUR = 0.5;

export interface IrelandPageMeta {
  title: string;
  dispatchDownWorkbookUrl: string;
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function columnIndex(ref: string): number {
  const letters = ref.replace(/\d+/g, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

function excelSerialToUtc(serial: number, gmtOffsetHours: number): string {
  const ms = (serial - 25569 - gmtOffsetHours / 24) * 86400 * 1000;
  return new Date(Math.round(ms)).toISOString();
}

function unzipXml(buffer: ArrayBuffer, filename: string): string {
  const data = Buffer.from(buffer);
  const eocd = data.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("xlsx missing end-of-central-directory");
  const centralDirectoryOffset = data.readUInt32LE(eocd + 16);

  for (let pos = centralDirectoryOffset; pos < eocd;) {
    if (data.readUInt32LE(pos) !== 0x02014b50) break;
    const method = data.readUInt16LE(pos + 10);
    const compressedSize = data.readUInt32LE(pos + 20);
    const nameLength = data.readUInt16LE(pos + 28);
    const extraLength = data.readUInt16LE(pos + 30);
    const commentLength = data.readUInt16LE(pos + 32);
    const localHeaderOffset = data.readUInt32LE(pos + 42);
    const name = data.subarray(pos + 46, pos + 46 + nameLength).toString("utf8");

    if (name === filename) {
      const localNameLength = data.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = data.readUInt16LE(localHeaderOffset + 28);
      const start = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = data.subarray(start, start + compressedSize);
      if (method === 0) return compressed.toString("utf8");
      if (method === 8) return inflateRawSync(compressed).toString("utf8");
      throw new Error(`xlsx entry ${filename} uses unsupported compression method ${method}`);
    }

    pos += 46 + nameLength + extraLength + commentLength;
  }

  throw new Error(`xlsx missing ${filename}`);
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  for (const match of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    out.push(
      Array.from(match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g))
        .map((part) => decodeXml(part[1]))
        .join(""),
    );
  }
  return out;
}

export function parseEirgridRenewablesPage(html: string): IrelandPageMeta {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (!titleMatch) throw new Error("EirGrid renewables page missing <title>");
  const workbookMatch = html.match(/https:\/\/cms\.eirgrid\.ie\/sites\/default\/files\/publications\/DD-HH-[^"'\\< ]+\.xlsx/i);
  return {
    title: titleMatch[1].trim(),
    dispatchDownWorkbookUrl: workbookMatch ? workbookMatch[0] : FALLBACK_DD_HH_URL,
  };
}

export function parseEirgridDispatchDownSheet(sheetXml: string, sharedStrings: string[]): CurtailmentPoint[] {
  const rows: string[][] = [];

  for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const value = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      if (!ref || value == null) continue;
      const i = columnIndex(ref);
      row[i] = /\bt="s"/.test(attrs) ? (sharedStrings[Number(value)] ?? "") : value;
    }
    rows.push(row);
  }

  const headers = rows[0] ?? [];
  const timestampCol = headers.indexOf("HH_TIMESTAMP");
  const offsetCol = headers.indexOf("GMT_OFFSET");
  const ddCol = headers.indexOf("Sum of DD_MWH");
  if (timestampCol < 0 || offsetCol < 0 || ddCol < 0) {
    throw new Error("EirGrid DD workbook missing HH_TIMESTAMP/GMT_OFFSET/DD_MWH columns");
  }

  return rows.slice(1)
    .map((row): CurtailmentPoint | null => {
      const serial = Number(row[timestampCol]);
      const offset = Number(row[offsetCol] ?? 0);
      const ddMwh = Number(row[ddCol] ?? 0);
      if (!Number.isFinite(serial) || !Number.isFinite(ddMwh)) return null;
      return {
        utcTimestamp: excelSerialToUtc(serial, Number.isFinite(offset) ? offset : 0),
        mw: Math.max(0, ddMwh / HALF_HOUR),
        intervalHours: HALF_HOUR,
      };
    })
    .filter((point): point is CurtailmentPoint => point !== null);
}

export function parseEirgridDispatchDownWorkbook(buffer: ArrayBuffer): CurtailmentPoint[] {
  const sharedStrings = parseSharedStrings(unzipXml(buffer, "xl/sharedStrings.xml"));
  return parseEirgridDispatchDownSheet(unzipXml(buffer, "xl/worksheets/sheet1.xml"), sharedStrings);
}

function trailingPoints(points: CurtailmentPoint[], days = 30): CurtailmentPoint[] {
  const sorted = [...points].sort((a, b) => a.utcTimestamp.localeCompare(b.utcTimestamp));
  const latest = sorted.at(-1);
  if (!latest) return [];
  const cutoff = new Date(new Date(latest.utcTimestamp).getTime() - days * 24 * 3600 * 1000);
  return sorted.filter((point) => new Date(point.utcTimestamp) >= cutoff);
}

function buildRegion(
  regionId: "ireland-republic" | "northern-ireland",
  allIslandPoints: CurtailmentPoint[],
  share: number,
  lastUpdated: string,
  sourceNote: string,
): RegionData {
  const points = allIslandPoints.map((point) => ({ ...point, mw: point.mw * share }));
  const base: RegionData = {
    regionId,
    profile: timeOfDayAverageGW(points),
    latestProfile: latestCompleteUtcDayProfileGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated,
    lastSuccessAt: lastUpdated,
    sourceNote,
  };
  return applyUncertainty(base, { regionTier: "live" });
}

const run = async (): Promise<Record<string, RegionData>> => {
  const html = await fetchText(EIRGRID_PAGE_URL, { timeoutMs: 45000, retries: 1 });
  const meta = parseEirgridRenewablesPage(html);
  const response = await fetch(meta.dispatchDownWorkbookUrl);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${meta.dispatchDownWorkbookUrl}`);
  const points = trailingPoints(parseEirgridDispatchDownWorkbook(await response.arrayBuffer()));
  if (points.length === 0) throw new Error("EirGrid DD workbook contained no dispatch-down points");
  const lastUpdated = points.at(-1)!.utcTimestamp;
  const note =
    `EirGrid/SONI DD half-hourly workbook (${meta.dispatchDownWorkbookUrl}); all-island dispatch-down split ROI ${Math.round(REPUBLIC_SHARE * 100)}% / NI ${Math.round(NORTHERN_IRELAND_SHARE * 100)}% per SONI/EirGrid 2024 annual renewable constraint and curtailment anchor.`;

  return {
    "ireland-republic": buildRegion("ireland-republic", points, REPUBLIC_SHARE, lastUpdated, note),
    "northern-ireland": buildRegion("northern-ireland", points, NORTHERN_IRELAND_SHARE, lastUpdated, note),
  };
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<Record<string, RegionData>>("ireland", run, {
    tagLive: (regions) => Object.fromEntries(
      Object.entries(regions).map(([id, region]) => [id, { ...region, sourceStatus: "live" as const }]),
    ),
    tagCached: (regions) => Object.fromEntries(
      Object.entries(regions).map(([id, region]) => [id, { ...region, sourceStatus: "cached" as const }]),
    ),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("ireland loader failed", err);
      process.exit(1);
    });
}
