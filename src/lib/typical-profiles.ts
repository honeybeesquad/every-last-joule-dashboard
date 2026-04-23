import type { RegionData } from "./types.js";

function scaleProfileToAnnualTWh(profile: number[], annualTWh: number): number[] {
  const dailyGWh = (annualTWh * 1000) / 365;
  const shapeSum = profile.reduce((sum, value) => sum + value, 0);
  if (shapeSum <= 0) {
    throw new Error("typical profile shape must have positive area");
  }
  const scale = dailyGWh / shapeSum;
  return profile.map((value) => value * scale);
}

export function solarProfile(peakHourUtc: number, annualTWh: number): number[] {
  const shape = Array.from({ length: 24 }, (_, hour) => {
    const center = hour + 0.5;
    const daylight = Math.cos(((center - peakHourUtc) / 12) * Math.PI);
    return Math.max(0, daylight) ** 1.8;
  });

  return scaleProfileToAnnualTWh(shape, annualTWh);
}

export function windProfile(peakHourUtc: number, annualTWh: number): number[] {
  const shape = Array.from({ length: 24 }, (_, hour) => {
    const center = hour + 0.5;
    const phase = Math.cos(((center - peakHourUtc) / 12) * Math.PI);
    return 0.65 + 0.35 * ((phase + 1) / 2);
  });

  return scaleProfileToAnnualTWh(shape, annualTWh);
}

export function hydroProfile(annualTWh: number): number[] {
  return scaleProfileToAnnualTWh(Array(24).fill(1), annualTWh);
}

/**
 * Monthly-share arrays describing what fraction of annual hydro curtailment
 * happens each calendar month. Must sum to 1.0. Used to correct the bogus
 * "flat 24/7 year-round" approximation for seasonal hydro spill.
 *
 * Sourced from hydrological reports / IHA country profiles, hand-curated to
 * reflect real monsoon / snowmelt / wet-season concentration.
 */
export type MonthlyShares = readonly [
  number, number, number, number, number, number,
  number, number, number, number, number, number
];

export const HYDRO_SEASONAL_SHARES = {
  // Yangtze basin monsoon, NH summer peak Jun-Sep (Sichuan)
  sichuan:  [0.01, 0.01, 0.02, 0.04, 0.08, 0.15, 0.22, 0.22, 0.15, 0.07, 0.02, 0.01],
  // Glacial melt + snowmelt NH summer peak May-Aug (Iceland, narrower window)
  iceland:  [0.02, 0.02, 0.03, 0.05, 0.15, 0.20, 0.20, 0.15, 0.10, 0.05, 0.02, 0.01],
  // Paraná basin SH summer peak Dec-Feb (Paraguay / Itaipu flood stage)
  paraguay: [0.20, 0.18, 0.13, 0.08, 0.04, 0.02, 0.02, 0.02, 0.03, 0.05, 0.10, 0.13],
  // Blue Nile / Kiremt monsoon NH summer peak Jul-Aug (Ethiopia / GERD)
  ethiopia: [0.02, 0.02, 0.03, 0.04, 0.06, 0.12, 0.20, 0.22, 0.15, 0.09, 0.03, 0.02],
  // Volga / western Russia snowmelt and wet-season hydro spill, NH summer peak
  "russia-mainland": [0.03, 0.03, 0.05, 0.10, 0.16, 0.18, 0.16, 0.12, 0.07, 0.04, 0.03, 0.03],
  // Lancang River / southwest China monsoon hydro spill, NH summer peak Jul-Sep
  yunnan: [0.01, 0.02, 0.03, 0.05, 0.10, 0.17, 0.20, 0.18, 0.14, 0.07, 0.02, 0.01],
  // Yarlung-Tsangpo high-altitude melt/monsoon spill, narrow Jun-Aug peak
  tibet:  [0.01, 0.01, 0.02, 0.03, 0.08, 0.18, 0.25, 0.22, 0.12, 0.05, 0.02, 0.01],
  // BC Hydro spring snowmelt oversupply, peak May-Jul
  "british-columbia": [0.02, 0.02, 0.03, 0.08, 0.18, 0.22, 0.18, 0.12, 0.07, 0.04, 0.02, 0.02],
  // Hydro-Quebec spring/summer surplus, export-absorbed and milder than BC
  quebec: [0.03, 0.03, 0.05, 0.10, 0.15, 0.15, 0.13, 0.10, 0.08, 0.07, 0.06, 0.05],
  // Colombia bimodal wet seasons, Apr-May and Oct-Nov
  colombia: [0.05, 0.05, 0.08, 0.13, 0.14, 0.10, 0.08, 0.06, 0.08, 0.11, 0.07, 0.05],
  // Peru Andean hydro + summer-peak Sierra rainfall; Peru's south Atacama-
  // adjacent region is solar-dominant, central Andes is hydro. Bimodal-ish,
  // with Jan-Apr rainy season being the bigger hydro-spill window.
  peru: [0.15, 0.15, 0.13, 0.10, 0.06, 0.04, 0.04, 0.04, 0.05, 0.06, 0.08, 0.10],
  // Kenya Olkaria geothermal steam-venting — tracks inverse of demand, not
  // rainfall. July peak (117.5 GWh in Jul 2024 per EPRA), June trough (6.6 GWh
  // in Jun 2025). July is coolest/lowest-demand month; June is outlier low
  // per EPRA 2025 report.
  kenya:    [0.07, 0.05, 0.05, 0.05, 0.07, 0.01, 0.18, 0.15, 0.12, 0.10, 0.09, 0.06],
} as const satisfies Record<string, MonthlyShares>;

/**
 * Factor relative to annual average for a 30-day trailing window ending at
 * `now`. Shares sum to 1 across 12 months; multiplying by 12 normalises so
 * that "full average year" = 1.0. Blends adjacent months when the window
 * spans a boundary, weighted by day count in each month.
 */
export function seasonalScaleFactor(
  monthlyShares: readonly number[],
  now: Date = new Date(),
): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  let totalShare = 0;
  for (let daysBack = 0; daysBack < 30; daysBack++) {
    const d = new Date(now.getTime() - daysBack * msPerDay);
    totalShare += monthlyShares[d.getUTCMonth()] ?? 0;
  }
  // Average daily share × 12 months = scale factor relative to flat-annual.
  return (totalShare / 30) * 12;
}

export function hydroSeasonalProfile(
  annualTWh: number,
  monthlyShares: readonly number[],
  now: Date = new Date(),
): number[] {
  const factor = seasonalScaleFactor(monthlyShares, now);
  const flatGW = (annualTWh * 1000) / 8760;
  return Array(24).fill(flatGW * factor);
}

export function buildTypicalHydroSeasonalRegion(
  regionId: string,
  annualTWh: number,
  monthlyShares: readonly number[],
  sourceNote: string,
  lastUpdated = "2024",
  now: Date = new Date(),
): RegionData {
  const factor = seasonalScaleFactor(monthlyShares, now);
  const profile = hydroSeasonalProfile(annualTWh, monthlyShares, now);
  return {
    regionId,
    profile,
    latestProfile: null,
    // 30-day TWh scales with seasonal factor too — dry-season regions
    // correctly show tiny TWh totals instead of annual-average smearing.
    totalTWh: ((annualTWh * 30) / 365) * factor,
    peakGW: Math.max(...profile),
    lastUpdated,
    sourceNote: `${sourceNote} — current 30-day seasonal factor ${factor.toFixed(2)}×`,
  };
}

export function buildTypicalSolarRegion(
  regionId: string,
  peakHourUtc: number,
  annualTWh: number,
  sourceNote: string,
  lastUpdated = "2024",
): RegionData {
  const profile = solarProfile(peakHourUtc, annualTWh);
  return {
    regionId,
    profile,
    latestProfile: null,
    totalTWh: (annualTWh * 30) / 365,
    peakGW: Math.max(...profile),
    lastUpdated,
    sourceNote,
  };
}

export function buildTypicalWindRegion(
  regionId: string,
  peakHourUtc: number,
  annualTWh: number,
  sourceNote: string,
  lastUpdated = "2024",
): RegionData {
  const profile = windProfile(peakHourUtc, annualTWh);
  return {
    regionId,
    profile,
    latestProfile: null,
    totalTWh: (annualTWh * 30) / 365,
    peakGW: Math.max(...profile),
    lastUpdated,
    sourceNote,
  };
}

export function buildTypicalHydroRegion(
  regionId: string,
  annualTWh: number,
  sourceNote: string,
  lastUpdated = "2024",
): RegionData {
  const profile = hydroProfile(annualTWh);
  return {
    regionId,
    profile,
    latestProfile: null,
    totalTWh: (annualTWh * 30) / 365,
    peakGW: Math.max(...profile),
    lastUpdated,
    sourceNote,
  };
}

export function buildTypicalMixedRegion(
  regionId: string,
  annualTWh: number,
  fuelShare: { solar?: number; wind?: number; hydro?: number },
  sourceNote: string,
  lastUpdated = "2024",
  solarPeakHourUtc = 7,
  windPeakHourUtc = 15,
): RegionData {
  const solar = solarProfile(solarPeakHourUtc, annualTWh * (fuelShare.solar ?? 0));
  const wind = windProfile(windPeakHourUtc, annualTWh * (fuelShare.wind ?? 0));
  const hydro = hydroProfile(annualTWh * (fuelShare.hydro ?? 0));
  const profile = solar.map((value, hour) => value + wind[hour] + hydro[hour]);
  return {
    regionId,
    profile,
    latestProfile: null,
    totalTWh: (annualTWh * 30) / 365,
    peakGW: Math.max(...profile),
    lastUpdated,
    sourceNote,
    fuelShare,
  };
}

/**
 * Overnight (anti-diurnal) curtailment profile. Used for geothermal
 * steam-venting where baseload generation exceeds overnight demand. Kenya
 * Olkaria is the archetype: curtailment concentrated in ~5 overnight hours,
 * zero during the day. `peakUtcHour` is the middle of the venting window in
 * UTC; `halfWidthHours` controls how sharp the bump is (raised-cosine shape,
 * hard zero outside the window).
 */
export function overnightProfile(
  peakUtcHour: number,
  halfWidthHours: number,
  annualTWh: number,
): number[] {
  const shape = Array.from({ length: 24 }, (_, hour) => {
    const center = hour + 0.5;
    // Circular distance to peakUtcHour, wrapping at 24.
    let dist = Math.abs(center - peakUtcHour);
    if (dist > 12) dist = 24 - dist;
    if (dist > halfWidthHours) return 0;
    // Raised-cosine ramp: cos(π × dist / (2 × halfWidth)).
    return Math.cos((dist / halfWidthHours) * (Math.PI / 2));
  });
  return scaleProfileToAnnualTWh(shape, annualTWh);
}

/**
 * Build a RegionData for geothermal overnight-vented curtailment with
 * monthly seasonal scaling. Annual TWh is the base rate; monthly shares
 * determine the seasonal scale factor applied to today's 30-day window.
 */
export function buildGeothermalOvernightRegion(
  regionId: string,
  annualTWh: number,
  peakUtcHour: number,
  halfWidthHours: number,
  monthlyShares: readonly number[],
  sourceNote: string,
  lastUpdated = "2024",
  now: Date = new Date(),
): RegionData {
  const factor = seasonalScaleFactor(monthlyShares, now);
  const rawProfile = overnightProfile(peakUtcHour, halfWidthHours, annualTWh);
  const profile = rawProfile.map((gw) => gw * factor);
  return {
    regionId,
    profile,
    latestProfile: null,
    totalTWh: ((annualTWh * 30) / 365) * factor,
    peakGW: Math.max(...profile),
    lastUpdated,
    sourceNote: `${sourceNote} — overnight venting (UTC ${peakUtcHour - halfWidthHours}-${peakUtcHour + halfWidthHours}), seasonal factor ${factor.toFixed(2)}×`,
  };
}
