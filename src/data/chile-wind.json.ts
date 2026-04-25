import { pathToFileURL } from "url";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalWindRegion } from "../lib/typical-profiles.js";
import type { RegionData } from "../lib/types.js";

/**
 * Chile wind curtailment loader — southern wind corridor (Biobío to Los Lagos).
 *
 * Chile's southern wind corridor (Biobío, Araucanía, Los Ríos, Los Lagos) runs
 * from roughly 37°S to 44°S. The Westerly wind regime peaks in the afternoon
 * (roughly UTC 18-20 local ~3-5pm). Key plants: Los Cururos, El Arrayán,
 * Cuel, Renaico, Aurora.
 *
 * CEN's "Reducciones de Generación Renovable" XLSX series (coordinador.cl)
 * started tracking wind (PE eólica) curtailment from 2024 and added hydro
 * spill from H2 2024. From Enel Chile's 2024 ERV disclosure (~236 GWh wind
 * alone) and extrapolating system-wide, total Chilean wind curtailment in
 * 2024 is estimated at ~600–700 GWh (~0.65 TWh).
 *
 * The CEN XLSX wp-content URLs include the upload date in the path, which
 * changes monthly and cannot be predicted without scraping the index page
 * (Cloudflare-blocked from most IPs outside Chile). The atacama-chile loader
 * already attempts the solar sheet from that same XLSX; a future upgrade
 * could extend it to parse the wind sheet ("Resumen-DiarioHorario-Eolico")
 * from the same workbook. For now this is a T3-modelled wind-shape fallback
 * (annual anchor + typical wind diurnal). See docs/methodology/uncertainty.md.
 *
 * Source: CEN Reporte Art.72-15 2024 (https://www.coordinador.cl/wp-content/
 * uploads/2025/04/CEN-Reporte-Art-72-15-ano-2024.pdf) — total ERV 5,908 GWh;
 * Enel Chile wind alone 236 GWh; system-wide wind estimated 650 GWh (~11%).
 */

const REGION_ID = "chile-wind";
const ANNUAL_TWH = 0.65;
// Chilean Westerlies peak mid-afternoon: ~3pm local (UTC-3) ≈ UTC 18.
const WIND_PEAK_UTC = 18;

const run = async (): Promise<RegionData> =>
  buildTypicalWindRegion(
    REGION_ID,
    WIND_PEAK_UTC,
    ANNUAL_TWH,
    "CEN Chile 2024 wind ERV estimate ~0.65 TWh/yr (Enel wind 236 GWh + ~3× system multiplier); southern wind corridor Biobío-Los Lagos; Westerly afternoon peak UTC 18; live XLSX parse pending CEN stable API.",
    "2024",
  );

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>(REGION_ID, run, {
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("chile-wind loader failed", err);
      process.exit(1);
    });
}

export const buildChileWindData = () => run();
