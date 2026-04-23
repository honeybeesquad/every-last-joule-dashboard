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
