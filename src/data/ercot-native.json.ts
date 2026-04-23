import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { timeOfDayAverageGW, totalTWh30d, peakGW } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";
import { pathToFileURL } from "url";

type NativeRegionId = "ercot-native-west" | "ercot-native-east";

interface ErcotTokenResponse {
  access_token?: string;
  id_token?: string;
  expires_in?: number;
  token_type?: string;
}

interface DiagnosticPayload {
  generatedAt: string;
  status: "ok" | "error";
  tokenAcquired?: boolean;
  endpoint?: string;
  httpStatus?: number;
  httpStatusText?: string;
  responseSnippet?: string;
  recordCount?: number;
  details?: Record<string, unknown>;
  error?: string;
}

const TOKEN_URL =
  "https://ercotb2c.b2clogin.com/ercotb2c.onmicrosoft.com/B2C_1_PUBAPI-ROPC-FLOW/oauth2/v2.0/token";
const API_BASE = "https://api.ercot.com/api/public-reports";
const PRODUCT_PATH = "np6-915-cd/summary_of_hdl_ldl";

function writeDiagnostic(payload: DiagnosticPayload) {
  const dir = join(process.cwd(), "data", "snapshots", "diagnostics");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "ercot-native.json"), JSON.stringify(payload, null, 2));
}

function assertEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} not set`);
  return value;
}

async function fetchToken(): Promise<string> {
  const username = assertEnv("ERCOT_USERNAME");
  const password = assertEnv("ERCOT_PASSWORD");

  const body = new URLSearchParams({
    grant_type: "password",
    username,
    password,
    scope: "openid fec253ea-0d06-4272-a5e6-b478baeecd70 offline_access",
    client_id: "fec253ea-0d06-4272-a5e6-b478baeecd70",
    response_type: "id_token",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error(`token HTTP ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as ErcotTokenResponse;
  const token = data.access_token ?? data.id_token;
  if (!token) {
    throw new Error("token response missing access_token/id_token");
  }
  return token;
}

function coerceNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

function coerceTimestamp(record: Record<string, unknown>): string | null {
  for (const key of [
    "SCED_TIMESTAMP",
    "scedTimestamp",
    "timestamp",
    "deliveryDate",
    "DATETIME",
    "datetime",
    "POSTED_DATETIME",
  ]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString();
    }
  }
  return null;
}

function parseCurtailmentPoints(payload: unknown): CurtailmentPoint[] {
  const records = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: unknown[] })?.data)
      ? (payload as { data: unknown[] }).data
      : [];

  const points: CurtailmentPoint[] = [];
  for (const row of records) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const utcTimestamp = coerceTimestamp(record);
    const hdl = coerceNumber(record, ["HDL", "hdl", "sumHdl", "highDispatchLimit"]);
    const gen = coerceNumber(record, ["GEN", "gen", "generation", "currentGeneration"]);
    if (!utcTimestamp || hdl === null || gen === null) continue;
    points.push({ utcTimestamp, mw: Math.max(0, hdl - gen) });
  }
  return points;
}

function splitRegion(base: RegionData, regionId: NativeRegionId, share: number, sourceNote: string): RegionData {
  return {
    ...base,
    regionId,
    profile: base.profile.map((gw) => gw * share),
    totalTWh: base.totalTWh * share,
    peakGW: base.peakGW * share,
    sourceNote,
  };
}

function parseErcotNative(points: CurtailmentPoint[]): Record<NativeRegionId, RegionData> {
  const base: RegionData = {
    regionId: "ercot-native",
    profile: timeOfDayAverageGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: points.at(-1)?.utcTimestamp ?? new Date().toISOString(),
    sourceNote: "ERCOT native SCED availability attempt via NP6-915-CD HDL minus generation, split 66/34 west-east until zone-native disclosure is confirmed.",
  };

  return {
    "ercot-native-west": splitRegion(
      base,
      "ercot-native-west",
      0.66,
      "ERCOT native SCED availability attempt via NP6-915-CD HDL minus generation, split 66% west/panhandle.",
    ),
    "ercot-native-east": splitRegion(
      base,
      "ercot-native-east",
      0.34,
      "ERCOT native SCED availability attempt via NP6-915-CD HDL minus generation, split 34% east/central.",
    ),
  };
}

const run = async (): Promise<Record<NativeRegionId, RegionData>> => {
  let diagnosticWritten = false;
  try {
    process.stderr.write("[ercot-native] loader fetching\n");
    const subscriptionKey = assertEnv("ERCOT_API_KEY");
    const token = await fetchToken();
    process.stderr.write("[ercot-native] token acquired\n");

    const now = new Date();
    const start = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();
    const end = now.toISOString();
    const url = `${API_BASE}/${PRODUCT_PATH}?postDatetimeFrom=${encodeURIComponent(start)}&postDatetimeTo=${encodeURIComponent(end)}&size=5000`;

    const res = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        "Ocp-Apim-Subscription-Key": subscriptionKey,
        accept: "application/json",
      },
    });
    const text = await res.text();

    if (!res.ok) {
      writeDiagnostic({
        generatedAt: new Date().toISOString(),
        status: "error",
        tokenAcquired: true,
        endpoint: url,
        httpStatus: res.status,
        httpStatusText: res.statusText,
        responseSnippet: text.slice(0, 1000),
      });
      diagnosticWritten = true;
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    process.stderr.write(`[ercot-native] API call HTTP ${res.status}\n`);

    const parsed = JSON.parse(text) as unknown;
    const points = parseCurtailmentPoints(parsed);
    if (points.length === 0) {
      writeDiagnostic({
        generatedAt: new Date().toISOString(),
        status: "error",
        tokenAcquired: true,
        endpoint: url,
        httpStatus: res.status,
        httpStatusText: res.statusText,
        responseSnippet: text.slice(0, 1000),
        details: { parse: "no-curtailment-points" },
      });
      diagnosticWritten = true;
      throw new Error("native payload did not contain parseable HDL/GEN timestamps");
    }

    writeDiagnostic({
      generatedAt: new Date().toISOString(),
      status: "ok",
      tokenAcquired: true,
      endpoint: url,
      httpStatus: res.status,
      httpStatusText: res.statusText,
      recordCount: points.length,
    });
    return parseErcotNative(points);
  } catch (err) {
    if (!diagnosticWritten) {
      writeDiagnostic({
        generatedAt: new Date().toISOString(),
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
    throw err;
  }
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<Record<NativeRegionId, RegionData>>("ercot-native", run, {
    tagLive: (result) => ({
      "ercot-native-west": { ...result["ercot-native-west"], sourceStatus: "live" as const },
      "ercot-native-east": { ...result["ercot-native-east"], sourceStatus: "live" as const },
    }),
    tagCached: (cached) => ({
      "ercot-native-west": { ...cached["ercot-native-west"], sourceStatus: "cached" as const },
      "ercot-native-east": { ...cached["ercot-native-east"], sourceStatus: "cached" as const },
    }),
  })
    .then((data) => {
      process.stdout.write(JSON.stringify(data));
    })
    .catch((err) => {
      console.error("ercot-native loader failed", err);
      process.exit(1);
    });
}
