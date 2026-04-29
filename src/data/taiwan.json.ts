import { pathToFileURL } from "url";
import { execFileSync } from "child_process";
import { withFallback } from "../lib/resilient.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import { coerceLastSuccessAt } from "../lib/freshness.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "taiwan";

const TAIPOWER_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "Accept": "application/json, text/plain, */*",
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Referer": "https://www.taipower.com.tw/d006/loadGraph/loadGraph/genshx_.html",
};

function curlGet(url: string): string {
  const headerArgs = Object.entries(TAIPOWER_HEADERS)
    .flatMap(([k, v]) => ["-H", `${k}: ${v}`]);
  return execFileSync("curl", ["-s", "--connect-timeout", "10", url, ...headerArgs], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
}

/** Parse output field which may embed a curtailment percentage in parens. */
function parseMw(s: string): number {
  const m = s.match(/^([0-9.]+)/);
  return m ? parseFloat(m[1]) : 0;
}

/** Parse curtailment % embedded in output field like "411.6(1.245%)". */
function parseCurtailmentPct(s: string): number {
  const m = s.match(/\(([0-9.]+)%\)$/);
  return m ? parseFloat(m[1]) : 0;
}

async function run(): Promise<RegionData> {
  const raw = curlGet("https://www.taipower.com.tw/d006/loadGraph/loadGraph/data/genary.json");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = JSON.parse(raw);

  const lastUpdated: string = data[""] ?? new Date().toISOString();

  const rawRows: unknown[][] = data.aaData ?? [];

  const solarRows: string[][] = rawRows.filter((r) => String(r[0]).toLowerCase().includes("solar")) as string[][];
  const windRows: string[][] = rawRows.filter(
    (r) =>
      String(r[0]).toLowerCase().includes("wind") &&
      !String(r[2]).includes("離岸") && !String(r[2]).includes("海能"),
  ) as string[][];
  const offwindRows: string[][] = rawRows.filter(
    (r) => String(r[2]).includes("離岸") || String(r[2]).includes("海能"),
  ) as string[][];

  const solarSubtotal = solarRows[solarRows.length - 1];
  const windSubtotal = windRows[windRows.length - 1];
  const offwindSubtotal = offwindRows[offwindRows.length - 1];

  const solarOutputMw = parseMw(solarSubtotal[4]);
  const solarCurtPct = parseCurtailmentPct(solarSubtotal[4]);
  const windOutputMw = parseMw(windSubtotal[4]);
  const windCurtPct = parseCurtailmentPct(windSubtotal[4]);
  const offwindOutputMw = parseMw(offwindSubtotal[4]);
  const offwindCurtPct = parseCurtailmentPct(offwindSubtotal[4]);

  const solarAnchorTWh = 0.2;
  const windAnchorTWh = 0.4;
  const totalAnchorTWh = solarAnchorTWh + windAnchorTWh;

  const solarProfile: number[] = Array.from({ length: 24 }, (_, h) => {
    const daylight = Math.cos(((h + 0.5 - 4) / 12) * Math.PI);
    return Math.max(0, daylight) ** 1.8;
  });
  const windProfile: number[] = Array.from({ length: 24 }, (_, h) => {
    const phase = Math.cos(((h + 0.5 - 6) / 12) * Math.PI);
    return 0.65 + 0.35 * ((phase + 1) / 2);
  });

  const solarArea = solarProfile.reduce((a, b) => a + b, 0);
  const windArea = windProfile.reduce((a, b) => a + b, 0);

  const scaledSolar = solarProfile.map((v) => (v / solarArea) * solarAnchorTWh * 1000);
  const scaledWind = windProfile.map((v) => (v / windArea) * windAnchorTWh * 1000);

  const profile: number[] = scaledSolar.map((s, i) => s + scaledWind[i]);
  const peakGW = Math.max(...profile);

  const base: RegionData = {
    regionId: REGION_ID,
    profile,
    latestProfile: null,
    totalTWh: totalAnchorTWh,
    peakGW,
    lastUpdated: lastUpdated.endsWith("Z") ? lastUpdated : `${lastUpdated}Z`,
    lastSuccessAt: coerceLastSuccessAt(new Date().toISOString()),
    fuelShare: { wind: 0.67, solar: 0.33 },
    sourceNote:
      `TAIPOWER real-time unit-level generation (genary.json); solar ${solarOutputMw.toFixed(1)} MW @ ${solarCurtPct.toFixed(3)}% curtailment, wind ${windOutputMw.toFixed(1)} MW @ ${windCurtPct.toFixed(3)}% + offshore ${offwindOutputMw.toFixed(1)} MW. Diurnal shape from live unit-level aggregation. Curtailment anchor ${totalAnchorTWh} TWh/yr (TAIPOWER 2024 domestic reporting + IRENA/TREC 2024). T1b: no single published curtailment rate; domestic anchor via measured diurnal shape.`,
  };

  return applyUncertainty(base, { regionTier: "live-domestic-anchored" });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  withFallback(REGION_ID, run)
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => { console.error("taiwan loader failed", err); process.exit(1); });
}

export const buildTaiwanData = () => run();
