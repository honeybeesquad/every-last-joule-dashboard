import { request as httpsRequest, type RequestOptions as HttpsRequestOptions } from "node:https";
import { pathToFileURL } from "node:url";
import { latestCompleteUtcDayProfileGW, peakGW, timeOfDayAverageGW, totalTWh30d } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

/**
 * Japan — Kyushu Electric area-demand CSV → live curtailment proxy.
 *
 * Endpoint: https://www.kyuden.co.jp/td_power_usages/csv/juyo-hourly-YYYYMMDD.csv
 *
 * The Kyushu Electric T&D portal publishes a per-day CSV containing several
 * stacked sections separated by blank lines. The section we care about is the
 * 5-minute-interval block whose header is `DATE,TIME,当日実績(５分間隔値）(万kW),太陽光発電実績(５分間隔値）(万kW)`
 * — i.e., DATE, TIME (JST), area demand (万kW), and solar generation (万kW).
 *
 * Encoding: the CSV is Shift-JIS (Japanese SJIS, not UTF-8). Node 20 ships a
 * Web-platform `TextDecoder('shift-jis')` that decodes correctly without any
 * external dependency, so we fetch as bytes and decode in-process.
 *
 * Units: 万kW (= 10,000 kW = 10 MW). All MW conversions multiply the published
 * 万kW value by 10.
 *
 * Calibration: RATE = 0.10. 2024 Kyushu solar curtailment ≈ 1.7 TWh against
 * ~16 TWh solar generation (10.6%); rounded to 10% per the Phase-2.6 brief.
 * Kyushu is the bulk of OCCTO-reported nationwide curtailment, so we treat
 * its number as Japan's number for now (per-area split is a follow-up brief).
 *
 * Loop: daily back 30 days for backfill.
 */
const REGION_ID = "japan";
const RATE = 0.10;
const BASE_URL = "https://www.kyuden.co.jp/td_power_usages/csv";
/** 万kW → MW */
const TENK_KW_TO_MW = 10;
/** Japan Standard Time offset from UTC, hours */
const JST_OFFSET_HOURS = 9;
/** 5-minute interval expressed as a fraction of an hour, for totalTWh30d */
const INTERVAL_HOURS = 5 / 60;

export interface KyushuParsed {
  points: CurtailmentPoint[];
  /** Total observed solar generation MW summed across all 5-min samples — diagnostic only. */
  solarMwSum: number;
  /** Number of 5-min samples found in the solar section. */
  sampleCount: number;
}

/**
 * Parse a Shift-JIS-decoded Kyushu Electric daily CSV string and return the
 * 5-minute-interval solar generation rows as CurtailmentPoint[] (after RATE
 * is applied). Tolerates the multi-section layout by locating the header
 * with exactly 4 columns starting `DATE,TIME` — the unique signature of
 * the solar 5-minute block.
 *
 * Each emitted point's `mw` is `solar_MW × RATE`. `intervalHours = 5/60`
 * so totalTWh30d sums the right energy.
 */
export function parseKyushuCsv(decoded: string): KyushuParsed {
  // CRLF in the upstream; tolerate either.
  const lines = decoded.split(/\r?\n/);

  // Locate the 5-min solar header row. Two DATE,TIME headers exist:
  //   - hourly aggregate (6 columns)
  //   - 5-min interval with solar (4 columns)
  // Identifying by column count avoids any reliance on the Japanese header text.
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("DATE,TIME")) continue;
    const cells = line.split(",");
    if (cells.length === 4) {
      startIdx = i + 1;
      break;
    }
  }
  if (startIdx < 0) {
    return { points: [], solarMwSum: 0, sampleCount: 0 };
  }

  const points: CurtailmentPoint[] = [];
  let solarMwSum = 0;
  let sampleCount = 0;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (!line) break; // blank line ends the section
    const cells = line.split(",");
    if (cells.length < 4) break;

    const dateRaw = cells[0]?.trim();
    const timeRaw = cells[1]?.trim();
    const solarTenkKwRaw = cells[3]?.trim();
    if (!dateRaw || !timeRaw || solarTenkKwRaw === undefined || solarTenkKwRaw === "") continue;

    const utcTimestamp = jstDateTimeToIsoUtc(dateRaw, timeRaw);
    if (!utcTimestamp) continue;

    const solarTenkKw = Number(solarTenkKwRaw);
    if (!Number.isFinite(solarTenkKw)) continue;
    const solarMw = Math.max(0, solarTenkKw) * TENK_KW_TO_MW;
    solarMwSum += solarMw;
    sampleCount += 1;

    points.push({
      utcTimestamp,
      mw: solarMw * RATE,
      intervalHours: INTERVAL_HOURS,
    });
  }

  return { points, solarMwSum, sampleCount };
}

/**
 * Convert Kyushu CSV's `YYYY/M/D` + `H:MM` (JST) to an ISO-8601 UTC string.
 * Returns undefined if the input does not parse cleanly.
 */
function jstDateTimeToIsoUtc(dateRaw: string, timeRaw: string): string | undefined {
  const dateMatch = dateRaw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  const timeMatch = timeRaw.match(/^(\d{1,2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) return undefined;
  const [, yyyy, mm, dd] = dateMatch;
  const [, hh, mn] = timeMatch;
  const utcMs = Date.UTC(
    Number(yyyy),
    Number(mm) - 1,
    Number(dd),
    Number(hh) - JST_OFFSET_HOURS,
    Number(mn),
    0,
    0,
  );
  if (!Number.isFinite(utcMs)) return undefined;
  return new Date(utcMs).toISOString();
}

/**
 * Build a Japan RegionData payload from the merged 30-day parsed pointset.
 * Extracted for fixture-test reuse (mirror of buildFranceData / parseOntarioXml
 * patterns).
 */
export function buildJapanRegionData(points: CurtailmentPoint[], nowIso: string): RegionData {
  const lastTs = points.at(-1)?.utcTimestamp ?? nowIso;
  return {
    regionId: REGION_ID,
    profile: timeOfDayAverageGW(points),
    latestProfile: latestCompleteUtcDayProfileGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: lastTs,
    lastSuccessAt: lastTs,
    sourceNote:
      "Kyushu Electric area-demand CSV hourly solar × 10% calibrated curtailment (Kyushu 2024 anchor: ~1.7 TWh/yr; bulk of OCCTO-reported Japan curtailment)",
  };
}

/**
 * Fetch a URL via the classic `node:https` module forcing HTTP/1.1 via ALPN.
 * The Kyushu Electric upstream is fronted by a Scutum WAF that fingerprints
 * the HTTP/2 ClientHello sent by Node's default fetch (undici) and 403s it,
 * but accepts HTTP/1.1 with a browser-style User-Agent. This helper bypasses
 * undici entirely for that single endpoint family. Returns the response body
 * as a `Uint8Array`; non-2xx is mapped to a thrown Error.
 */
function fetchHttp1Bytes(url: string, timeoutMs: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    // The Kyushu Electric upstream is fronted by a Scutum WAF that does
    // both HTTP/2 ClientHello fingerprinting AND JA3-style TLS-handshake
    // fingerprinting. Default Node fetch (undici) is rejected; raw Node
    // https with the right TLS options is accepted. Empirically the WAF
    // accepts TLS 1.2 + curl's CHACHA20-first cipher list + http/1.1
    // ALPN; anything else (TLS 1.3 default, http/2 ALPN, modern cipher
    // ordering) gets a 403. ALPNProtocols / minVersion / maxVersion /
    // ciphers / ecdhCurve are tls.SecureContextOptions that node:https
    // passes through; the RequestOptions TS type doesn't list them all
    // so we widen the shape locally.
    const opts: HttpsRequestOptions & {
      ALPNProtocols?: string[];
      minVersion?: string;
      maxVersion?: string;
      ciphers?: string;
      ecdhCurve?: string;
    } = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: "GET",
      ALPNProtocols: ["http/1.1"],
      minVersion: "TLSv1.2",
      maxVersion: "TLSv1.2",
      ciphers: [
        "ECDHE-ECDSA-CHACHA20-POLY1305",
        "ECDHE-RSA-CHACHA20-POLY1305",
        "ECDHE-ECDSA-AES128-GCM-SHA256",
        "ECDHE-RSA-AES128-GCM-SHA256",
        "ECDHE-ECDSA-AES256-GCM-SHA384",
        "ECDHE-RSA-AES256-GCM-SHA384",
      ].join(":"),
      ecdhCurve: "X25519:prime256v1:secp384r1",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "text/csv,*/*",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: timeoutMs,
    };
    const req = httpsRequest(
      opts,
      (res) => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode ?? "?"} for ${url}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          resolve(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
        });
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error(`timeout after ${timeoutMs}ms for ${url}`)));
    req.on("error", reject);
    req.end();
  });
}

/**
 * Fetch a single day's Kyushu CSV as bytes, decode as Shift-JIS, parse out
 * the 5-min solar section. Network errors propagate to the caller, which
 * logs and skips that day.
 */
async function fetchKyushuDay(
  yyyymmdd: string,
  timeoutMs = 30000,
  retries = 2,
  backoffMs = 750,
): Promise<KyushuParsed> {
  const url = `${BASE_URL}/juyo-hourly-${yyyymmdd}.csv`;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const buf = await fetchHttp1Bytes(url, timeoutMs);
      // Node 20 ships a built-in `TextDecoder('shift-jis')` per Web spec.
      const decoded = new TextDecoder("shift-jis").decode(buf);
      return parseKyushuCsv(decoded);
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function formatYyyymmdd(d: Date): string {
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, "0"),
    String(d.getUTCDate()).padStart(2, "0"),
  ].join("");
}

/**
 * Fetch and aggregate Kyushu Electric area-demand CSVs for the last 30 days
 * (today + 29 days back). One day's failure is logged and skipped — the
 * loader proceeds as long as at least one day's solar block parses.
 *
 * Fetches are issued sequentially with a small inter-request delay; the
 * upstream is fronted by a Scutum WAF that 403s aggressive concurrent
 * scrapes (observed empirically during initial Phase-2.6 wiring).
 */
const run = async (): Promise<RegionData> => {
  const now = new Date();
  const days: string[] = [];
  for (let daysAgo = 0; daysAgo < 30; daysAgo++) {
    const d = new Date(now.getTime() - daysAgo * 24 * 3600 * 1000);
    days.push(formatYyyymmdd(d));
  }

  const parsedDays: KyushuParsed[] = [];
  for (const yyyymmdd of days) {
    try {
      parsedDays.push(await fetchKyushuDay(yyyymmdd));
    } catch (err) {
      console.warn(`kyushu fetch skipped ${yyyymmdd}: ${(err as Error).message}`);
      parsedDays.push({ points: [], solarMwSum: 0, sampleCount: 0 });
    }
    // Polite gap between requests; upstream WAF rate-limits aggressive scrapes.
    await new Promise((r) => setTimeout(r, 200));
  }

  const allPoints = parsedDays.flatMap((p) => p.points);
  if (allPoints.length === 0) {
    throw new Error("Kyushu Electric returned no usable solar generation rows for the trailing 30 days");
  }
  // Sort ascending by timestamp so latestProfile sees the freshest day last.
  allPoints.sort((a, b) => a.utcTimestamp.localeCompare(b.utcTimestamp));

  return buildJapanRegionData(allPoints, now.toISOString());
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>(REGION_ID, run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("japan loader failed", err);
      process.exit(1);
    });
}

