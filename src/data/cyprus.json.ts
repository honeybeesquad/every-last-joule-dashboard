import { pathToFileURL } from "url";
import { fetchText } from "../lib/fetch.js";
import { parseEntsoeXml } from "../lib/entsoe.js";
import { withFallback } from "../lib/resilient.js";
import { timeOfDayAverageGW, totalTWh30d } from "../lib/profile.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

const REGION_ID = "cyprus";

/**
 * Cyprus bidding zone on the ENTSO-E transparency platform. Cyprus is an
 * isolated system and an ENTSO-E observer member, but it does publish
 * A75 "actual generation per production type" for this domain.
 */
const CY_DOMAIN = "10YCY-1001A0003J";

/**
 * B16 = solar. Cyprus curtailment is a PV problem, not a wind one: over the 30
 * days to 2026-09-06 the CY zone delivered 0.1512 TWh of B16 solar against
 * 0.0150 TWh of B19 wind (peak 761 MW vs 115 MW), the same ordering holds over
 * the preceding 12 months, and the published anchor is a PV-curtailment figure
 * (`docs/methodology/anchors.md`). `Region.kind` stays "solar" accordingly.
 */
const PSR_TYPE_SOLAR = "B16";

const ENTSOE_API = "https://web-api.tp.entsoe.eu/api";

/**
 * Published annual PV-curtailment anchor: ~0.15 TWh/yr (TSOC 2024).
 *
 * This is the value already recorded for Cyprus in
 * `scripts/validation/external-anchors.json` (`tsoc-2024-annual`, method
 * "inferred") and in `docs/validation/cyprus.md`. The loader previously used
 * an undocumented 0.1 TWh/yr, so the loader and the validation doc disagreed;
 * this constant is the documented figure.
 *
 * HONESTY: the anchor is "inferred", not an independently measured
 * curtailment total, and TSOC publishes no hourly curtailment series at all.
 * That is why the region stays `tier: "estimated"` (T3-modelled) with
 * `sourceProvenance: "modelled-fallback"`. ENTSO-E supplies the *shape*;
 * it does not supply curtailment.
 */
const ANNUAL_CURTAILMENT_TWH = 0.15;

/**
 * Data-quality guards. Cyprus's B16 feed is real but intermittently broken:
 * over the 12 months to 2026-09-05 the peak hour-of-day mean was 634 MW in
 * 2026-08 and 218 MW in 2025-12, but collapsed to 20.5 MW (2026-02),
 * 11.3 MW (2026-07) and 8.9 MW (2026-04) — months where the feed reports
 * near-zero for ~95% of intervals while Cyprus's PV fleet is demonstrably
 * capable of 761 MW. A window like that would yield a flat, meaningless
 * shape, so the loader throws and `withFallback` serves last-good instead.
 */
const MIN_DISTINCT_DAYS = 20;
/** MW. Sits ~2.4x above the worst observed broken month and ~4.4x below the worst clean one. */
const MIN_PEAK_HOUR_MEAN_MW = 50;
/** Cyprus is UTC+3, so solar noon lands near 09:30 UTC. */
const PEAK_HOUR_UTC_MIN = 5;
const PEAK_HOUR_UTC_MAX = 14;

const WINDOW_DAYS = 30;

export const SOURCE_NOTE_PREFIX =
  "Diurnal shape from ENTSO-E A75 actual solar generation, Cyprus bidding zone " +
  "10YCY-1001A0003J (psrType B16), trailing 30 days; scaled to the published " +
  `~${ANNUAL_CURTAILMENT_TWH} TWh/yr TSOC PV-curtailment anchor.`;

function entsoeUrl(token: string, now: Date): string {
  const start = new Date(now.getTime() - WINDOW_DAYS * 24 * 3600 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:T]/g, "").slice(0, 12);
  const params = new URLSearchParams({
    securityToken: token,
    documentType: "A75",
    processType: "A16",
    in_Domain: CY_DOMAIN,
    psrType: PSR_TYPE_SOLAR,
    periodStart: fmt(start),
    periodEnd: fmt(now),
  });
  return `${ENTSOE_API}?${params.toString()}`;
}

/**
 * Build the Cyprus region from measured ENTSO-E solar-generation points.
 *
 * Throws when the window cannot support a trustworthy shape, so that
 * `withFallback` degrades to the last-good snapshot rather than emitting a
 * flat profile that would contradict the region's stated basis.
 */
export function buildCyprusRegion(points: CurtailmentPoint[]): RegionData {
  if (points.length === 0) {
    throw new Error("ENTSO-E CY B16 returned no points");
  }

  const days = new Set(points.map((p) => p.utcTimestamp.slice(0, 10)));
  if (days.size < MIN_DISTINCT_DAYS) {
    throw new Error(
      `ENTSO-E CY B16 covers only ${days.size} distinct days (need ${MIN_DISTINCT_DAYS})`,
    );
  }

  // Hour-of-day mean generation, in GW (timeOfDayAverageGW divides MW by 1000).
  const generationShapeGW = timeOfDayAverageGW(points);
  const peakGenGW = Math.max(...generationShapeGW);
  const peakHourUtc = generationShapeGW.indexOf(peakGenGW);

  if (peakGenGW * 1000 < MIN_PEAK_HOUR_MEAN_MW) {
    throw new Error(
      `ENTSO-E CY B16 peak hour-of-day mean ${(peakGenGW * 1000).toFixed(1)} MW is below the ` +
        `${MIN_PEAK_HOUR_MEAN_MW} MW plausibility floor — feed is reporting near-zero`,
    );
  }

  if (peakHourUtc < PEAK_HOUR_UTC_MIN || peakHourUtc > PEAK_HOUR_UTC_MAX) {
    throw new Error(
      `ENTSO-E CY B16 peak hour ${peakHourUtc}:00 UTC is outside the ` +
        `${PEAK_HOUR_UTC_MIN}-${PEAK_HOUR_UTC_MAX} daylight band — not a solar shape`,
    );
  }

  // Scale the measured shape so it integrates to the published annual anchor,
  // matching scaleProfileToAnnualTWh() in typical-profiles.ts.
  const shapeSum = generationShapeGW.reduce((sum, v) => sum + v, 0);
  if (shapeSum <= 0) {
    throw new Error("ENTSO-E CY B16 shape has non-positive area");
  }
  const dailyGWh = (ANNUAL_CURTAILMENT_TWH * 1000) / 365;
  const scale = dailyGWh / shapeSum;
  const profile = generationShapeGW.map((v) => v * scale);

  const totalTWh = (ANNUAL_CURTAILMENT_TWH * 30) / 365;
  const generationTotalTWh = totalTWh30d(points);

  // Cannot curtail more than you generate. If the anchor exceeds measured
  // generation for the window, either the feed is broken or the anchor is
  // wrong — emitting it would put an impossible number on the globe.
  if (generationTotalTWh < totalTWh) {
    throw new Error(
      `ENTSO-E CY B16 30-day generation ${generationTotalTWh.toFixed(4)} TWh is below the ` +
        `${totalTWh.toFixed(4)} TWh curtailment anchor — implied rate exceeds 100%`,
    );
  }

  // parseEntsoeXml returns sorted points, but this builder is also called
  // directly, so take the max rather than trusting input order.
  const lastUpdated = points.reduce(
    (latest, p) => (p.utcTimestamp > latest ? p.utcTimestamp : latest),
    points[0].utcTimestamp,
  );

  const base: RegionData = {
    regionId: REGION_ID,
    profile,
    latestProfile: null,
    totalTWh,
    peakGW: Math.max(...profile),
    lastUpdated,
    lastSuccessAt: lastUpdated,
    sourceNote:
      `${SOURCE_NOTE_PREFIX} ${days.size} days, ${points.length} intervals, ` +
      `peak generation hour ${peakHourUtc}:00 UTC; implied curtailment rate ` +
      `${((totalTWh / generationTotalTWh) * 100).toFixed(1)}% of measured PV generation ` +
      "over this window. TSOC publishes no hourly curtailment series, so the magnitude is " +
      "the published annual anchor, not a measurement — the region stays T3-modelled.",
    generationProfile: generationShapeGW,
    generationTotalTWh,
  };

  return applyUncertainty(base, { regionTier: "estimated", profileKind: "solar" });
}

async function run(): Promise<RegionData> {
  const token = process.env.ENTSOE_API_TOKEN;
  if (!token) throw new Error("ENTSOE_API_TOKEN not set");

  const xml = await fetchText(entsoeUrl(token, new Date()), { timeoutMs: 60000, retries: 2 });
  return buildCyprusRegion(parseEntsoeXml(xml));
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "estimated" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("cyprus loader failed", err);
      process.exit(1);
    });
}

export const buildCyprusData = () => run();
