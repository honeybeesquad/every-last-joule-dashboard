import { pathToFileURL } from "url";
import { fetchJSON, fetchText } from "../lib/fetch.js";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion, buildTypicalWindRegion } from "../lib/typical-profiles.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";
import { unpublishedGenerationRegion } from "../lib/waste-status.js";

const REGION_ID = "south-korea";
const SOURCE_URL = "https://www.data.go.kr/data/15103243/openapi.do";
const KPX_PV_URL = "https://apis.data.go.kr/B552115/PvAmountByLocHr/getPvAmountByLocHr";

const WIND_GEN_TWH = 3.64;
const SOLAR_GEN_TWH = 37.80;
const WIND_RATE = 0.041;
const SOLAR_RATE = 0.032;
const WIND_CURTAILED_TWH = Math.round(WIND_GEN_TWH * WIND_RATE * 1000) / 1000;
const SOLAR_CURTAILED_TWH = Math.round(SOLAR_GEN_TWH * SOLAR_RATE * 1000) / 1000;

export function dataGoKrServiceKey(): string | undefined {
  const k = process.env.DATA_GO_KR_SERVICE_KEY?.trim();
  return k || undefined;
}

function kpxItems(payload: unknown): Record<string, unknown>[] {
  const body = (payload as { response?: { body?: { items?: unknown } } })?.response?.body?.items;
  const item = body && typeof body === "object" ? (body as { item?: unknown }).item : body;
  if (Array.isArray(item)) return item as Record<string, unknown>[];
  if (item && typeof item === "object") return [item as Record<string, unknown>];
  return [];
}

/** Parse PvAmountByLocHr JSON into hourly MW points (KST → UTC). */
export function parseKpxPvItems(payload: unknown): CurtailmentPoint[] {
  const byHour = new Map<string, number>();
  for (const row of kpxItems(payload)) {
    const ymd = String(row.ymd ?? row.YMD ?? "");
    const hhRaw = String(row.hh ?? row.hour ?? row.hr ?? "");
    const amount = Number(row.pvAmount ?? row.amount ?? row.gen ?? row.qty);
    if (!/^\d{8}$/.test(ymd) || !Number.isFinite(amount)) continue;
    const hour = Number(hhRaw.replace(/\D/g, "").slice(0, 2));
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) continue;
    const y = Number(ymd.slice(0, 4));
    const mo = Number(ymd.slice(4, 6));
    const d = Number(ymd.slice(6, 8));
    const utc = Date.UTC(y, mo - 1, d, hour - 9, 0, 0);
    const iso = new Date(utc).toISOString();
    byHour.set(iso, (byHour.get(iso) ?? 0) + Math.max(0, amount));
  }
  return Array.from(byHour.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([utcTimestamp, mw]) => ({ utcTimestamp, mw }));
}

function emberFallback(reason: string): { solar: RegionData; wind: RegionData } {
  const solarNote =
    `KPX mainland live feed unavailable (${reason}); ` +
    `curtailed = Ember/OWID 2025 solar generation ${SOLAR_GEN_TWH} TWh × ${(SOLAR_RATE * 100).toFixed(1)}% ` +
    `published 2024 rate = ${SOLAR_CURTAILED_TWH} TWh/yr (mainland, excl. Jeju).`;
  const windNote =
    `KPX mainland live feed unavailable (${reason}); ` +
    `curtailed = Ember/OWID 2025 wind generation ${WIND_GEN_TWH} TWh × ${(WIND_RATE * 100).toFixed(1)}% ` +
    `published 2024 rate = ${WIND_CURTAILED_TWH} TWh/yr (mainland, excl. Jeju).`;
  return {
    solar: buildTypicalSolarRegion("south-korea-solar", 3, SOLAR_CURTAILED_TWH, solarNote, "2025"),
    wind: buildTypicalWindRegion("south-korea-wind", 3, WIND_CURTAILED_TWH, windNote, "2025"),
  };
}

async function fetchKpxPv(ymd: string, key: string): Promise<CurtailmentPoint[]> {
  const url =
    `${KPX_PV_URL}?serviceKey=${encodeURIComponent(key)}` +
    `&pageNo=1&numOfRows=1000&dataType=JSON&ymd=${ymd}`;
  const payload = await fetchJSON(url, { timeoutMs: 15000, retries: 1 });
  return parseKpxPvItems(payload);
}

function kstYmd(now: Date, daysBack: number): string {
  const kst = new Date(now.getTime() + 9 * 3_600_000);
  const d = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - daysBack));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

async function run({ probe = true } = {}): Promise<{ solar: RegionData; wind: RegionData }> {
  const key = dataGoKrServiceKey();
  if (key) {
    try {
      const days = [kstYmd(new Date(), 1), kstYmd(new Date(), 2)];
      const parts = await Promise.all(days.map((ymd) => fetchKpxPv(ymd, key)));
      const points = parts.flat();
      if (points.length >= 24) {
        const solar = unpublishedGenerationRegion(
          "south-korea-solar",
          "solar",
          points,
          "KPX PvAmountByLocHr (data.go.kr B552115). Generation collected; waste unpublished. " +
            "Wind stays Ember×rate until a KPX wind series is confirmed. Not T1a.",
        );
        const ember = emberFallback("wind series not in PvAmountByLocHr");
        return { solar, wind: ember.wind };
      }
    } catch (err) {
      console.error("KPX serviceKey present but PvAmountByLocHr failed; Ember fallback", err);
      return emberFallback((err as Error).message);
    }
  }

  if (probe && !key) {
    try {
      await fetchText(SOURCE_URL, { timeoutMs: 15000, retries: 1, headers: { "user-agent": "Mozilla/5.0" } });
    } catch {
      // decorative reachability only
    }
  }
  return emberFallback(
    "DATA_GO_KR_SERVICE_KEY unset — data.go.kr requires Korean identity verification",
  );
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback<{ solar: RegionData; wind: RegionData }>(REGION_ID, () => run(), {
    regionTier: "estimated" as const,
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("south-korea loader failed", err); process.exit(1); });
}

export const buildSouthKoreaData = () => run({ probe: false });
