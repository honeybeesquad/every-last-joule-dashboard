1|import { pathToFileURL, fileURLToPath } from "url";
2|import { dirname, join } from "path";
3|import { readFileSync } from "fs";
4|import { withFallback } from "../lib/resilient.js";
5|import { buildTypicalSolarRegion, buildTypicalWindRegion } from "../lib/typical-profiles.js";
6|import { timeOfDayAverageGW, totalTWh30d, peakGW, latestCompleteUtcDayProfileGW } from "../lib/profile.js";
7|import { applyUncertainty } from "../lib/uncertainty.js";
8|import { relayFreshness, RELAY_STALENESS_THRESHOLD_DAYS } from "../lib/freshness.js";
9|import type { RegionData, CurtailmentPoint } from "../lib/types.js";
10|
11|const REGION_ID = "mexico";
12|const __dirname = dirname(fileURLToPath(import.meta.url));
13|const CSV_PATH = join(__dirname, "../../data/historical/mexico-generacion.csv");
14|
15|// Calibrated-proxy curtailment rates from SENER PRODESEN 2024–2038 + CRE
16|// confiabilidad reports. ~1.2 TWh/yr total curtailment across ~20 GW VRE
17|// capacity (12 GW solar + 8 GW wind) → blended ~6% rate.
18|// Split: solar ~7% (northern-grid saturation in Sonora/Chihuahua/Coahuila),
19|// wind ~5% (Oaxaca/Tehuantepec transmission bottlenecks, lower utilisation).
20|const SOLAR_RATE = 0.07;
21|const WIND_RATE = 0.05;
22|
23|interface CsvRow {
24|  date: string;
25|  hour: number;
26|  eolicaMwh: number;
27|  fotovoltaicaMwh: number;
28|}
29|
30|function parseCsv(text: string): CsvRow[] {
31|  const lines = text.trim().split("\n");
32|  if (lines.length < 2) return [];
33|  const header = lines[0].split(",");
34|  const dateIdx = header.indexOf("date");
35|  const hourIdx = header.indexOf("hour");
36|  const eolicaIdx = header.indexOf("eolica_mwh");
37|  const solarIdx = header.indexOf("fotovoltaica_mwh");
38|  if (dateIdx < 0 || hourIdx < 0 || eolicaIdx < 0 || solarIdx < 0) {
39|    throw new Error("Mexico CSV missing required columns (date, hour, eolica_mwh, fotovoltaica_mwh)");
40|  }
41|  return lines.slice(1)
42|    .map(line => {
43|      const cols = line.split(",");
44|      return {
45|        date: cols[dateIdx]?.trim() ?? "",
46|        hour: parseInt(cols[hourIdx] ?? "0", 10),
47|        eolicaMwh: parseFloat(cols[eolicaIdx] ?? "0") || 0,
48|        fotovoltaicaMwh: parseFloat(cols[solarIdx] ?? "0") || 0,
49|      };
50|    })
51|    .filter(r => r.date.length > 0 && Number.isFinite(r.hour) && r.hour >= 0 && r.hour <= 23);
52|}
53|
54|function readCsvRelay(csvPath = CSV_PATH): { rows: CsvRow[]; latestDate: string } | null {
55|  let text: string;
56|  try {
57|    text = readFileSync(csvPath, "utf-8");
58|  } catch {
59|    return null;
60|  }
61|  const rows = parseCsv(text);
62|  if (rows.length < 24) return null; // Need at least 1 day of hourly data
63|  rows.sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour);
64|  return { rows, latestDate: rows[rows.length - 1]?.date ?? "unknown" };
65|}
66|
67|/**
68| * Convert daily generation CSV rows to CurtailmentPoint[] for a given fuel,
69| * applying the calibration rate to estimate curtailment.
70| * Groups by (date, hour), applies the rate, and builds hourly points.
71| */
72|function rowsToPoints(rows: CsvRow[], fuel: "eolica" | "fotovoltaica", rate: number): CurtailmentPoint[] {
73|  // Group by (date, hour) and average across days for each hour-of-day
74|  const hourTotals = new Map<number, { sum: number; count: number }>();
75|  for (const row of rows) {
76|    const mwh = fuel === "eolica" ? row.eolicaMwh : row.fotovoltaicaMwh;
77|    if (mwh <= 0) continue;
78|    const existing = hourTotals.get(row.hour) ?? { sum: 0, count: 0 };
79|    existing.sum += mwh;
80|    existing.count += 1;
81|    hourTotals.set(row.hour, existing);
82|  }
83|
84|  // Build average MWh per hour-of-day, then apply calibration rate to get curtailment MW
85|  const points: CurtailmentPoint[] = [];
86|  for (let h = 0; h < 24; h++) {
87|    const agg = hourTotals.get(h);
88|    if (!agg || agg.count === 0) continue;
89|    const avgMwh = agg.sum / agg.count;
90|    const curtailmentMw = avgMwh * rate; // MWh generation × rate = MW curtailed (1h interval)
91|    points.push({
92|      utcTimestamp: `2026-01-01T${String(h).padStart(2, "0")}:00:00.000Z`,
93|      mw: Math.max(0, curtailmentMw),
94|    });
95|  }
96|  return points;
97|}
98|
99|/**
100| * Build RegionData from CurtailmentPoint[].
101| */
102|function pointsToRegionData(
103|  regionId: string,
104|  points: CurtailmentPoint[],
105|  sourceNote: string,
106|): RegionData {
107|  const last = points.at(-1)?.utcTimestamp ?? new Date().toISOString();
108|  return {
109|    regionId,
110|    profile: timeOfDayAverageGW(points),
111|    latestProfile: latestCompleteUtcDayProfileGW(points),
112|    totalTWh: totalTWh30d(points),
113|    peakGW: peakGW(points),
114|    lastUpdated: last,
115|    lastSuccessAt: last,
116|    sourceNote,
117|  };
118|}
119|
120|async function run({
121|  probe = false,
122|  now = new Date(),
123|  csvPath = CSV_PATH,
124|}: { probe?: boolean; now?: Date; csvPath?: string } = {}): Promise<{ wind: RegionData; solar: RegionData }> {
125|  // Try CSV relay first
126|  const csv = readCsvRelay(csvPath);
127|  if (csv) {
128|    const windPoints = rowsToPoints(csv.rows, "eolica", WIND_RATE);
129|    const solarPoints = rowsToPoints(csv.rows, "fotovoltaica", SOLAR_RATE);
130|
131|    if (windPoints.length === 0 && solarPoints.length === 0) {
132|      throw new Error("Mexico CSV relay had no valid wind/solar data points");
133|    }
134|
135|    const windTotalMw = windPoints.reduce((s, p) => s + p.mw, 0);
136|    const solarTotalMw = solarPoints.reduce((s, p) => s + p.mw, 0);
137|    const denom = windTotalMw + solarTotalMw;
138|    const fuelShare = denom > 0
139|      ? { wind: windTotalMw / denom, solar: solarTotalMw / denom }
140|      : { wind: 0, solar: 1 };
141|
142|    const windSourceNote = `CENACE Energía Generada Tipo Técnico CSV relay (${csv.rows.length}-hour window, latest: ${csv.latestDate}). Wind (eólica) × ${(WIND_RATE * 100).toFixed(0)}% modelled curtailment rate (PRODESEN anchor, no measured numerator). T3 estimated ±40%. See docs/validation/mexico-wind.md.`;
143|    const solarSourceNote = `CENACE Energía Generada Tipo Técnico CSV relay (${csv.rows.length}-hour window, latest: ${csv.latestDate}). Solar (fotovoltaica) × ${(SOLAR_RATE * 100).toFixed(0)}% modelled curtailment rate (PRODESEN anchor, no measured numerator). T3 estimated ±40%. See docs/validation/mexico-solar.md.`;
144|
145|    const windData = applyUncertainty(
146|      pointsToRegionData("mexico-wind", windPoints, windSourceNote),
147|      { regionTier: "estimated" },
148|    );
149|    const solarData = applyUncertainty(
150|      pointsToRegionData("mexico-solar", solarPoints, solarSourceNote),
151|      { regionTier: "estimated" },
152|    );
153|
154|    // Relay freshness self-stamp
155|    const status = relayFreshness(csv.latestDate, now, RELAY_STALENESS_THRESHOLD_DAYS);
156|    if (status === "degraded") {
157|      windData.sourceStatus = "degraded";
158|      solarData.sourceStatus = "degraded";
159|      windData.lastSuccessAt = csv.latestDate
160|        ? new Date(csv.latestDate).toISOString()
161|        : windData.lastSuccessAt;
162|      solarData.lastSuccessAt = csv.latestDate
163|        ? new Date(csv.latestDate).toISOString()
164|        : solarData.lastSuccessAt;
165|    }
166|
167|    return { wind: windData, solar: solarData };
168|  }
169|
170|  // T3 modelled fallback — no CSV available yet
171|  const windSourceNote = `SENER PRODESEN 2024–2038 anchor: ~1.2 TWh/yr total VRE curtailment; wind share estimated at ~0.4 TWh/yr from Oaxaca/Tehuantepec transmission bottlenecks. CENACE CSV relay not yet available — T3-modelled fallback. Gemini-3.1 research wave 2 (2026-04-30).`;
172|  const solarSourceNote = `SENER PRODESEN 2024–2038 anchor: ~1.2 TWh/yr total VRE curtailment; solar share estimated at ~0.8 TWh/yr from northern-grid saturation (Sonora/Chihuahua/Coahuila). CENACE CSV relay not yet available — T3-modelled fallback. Gemini-3.1 research wave 2 (2026-04-30).`;
173|
174|  const windBase = buildTypicalWindRegion(
175|    "mexico-wind",
176|    18, // peak UTC hour for Oaxaca wind (18:00 UTC = noon local)
177|    0.4, // ~0.4 TWh/yr wind curtailment
178|    windSourceNote,
179|    "2024",
180|  );
181|  const solarBase = buildTypicalSolarRegion(
182|    "mexico-solar",
183|    19, // peak UTC hour for Sonora solar (19:00 UTC = noon local)
184|    0.8, // ~0.8 TWh/yr solar curtailment
185|    solarSourceNote,
186|    "2024",
187|  );
188|
189|  return { wind: windBase, solar: solarBase };
190|}
191|
192|const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
193|
194|if (isMain) {
195|  withFallback<{ wind: RegionData; solar: RegionData }>(REGION_ID, () => run(), {
196|    regionTier: "estimated" as const,
197|    tagLive: (r) => r,
198|    tagCached: (c) => {
199|      // Adapt legacy single-region cache to per-fuel split
200|      if (c && typeof c === "object" && "wind" in c && "solar" in c) {
201|        return c as { wind: RegionData; solar: RegionData };
202|      }
203|      const old = c as unknown as RegionData;
204|      const windShare = old.fuelShare?.wind ?? 0.33;
205|      const solarShare = old.fuelShare?.solar ?? 0.67;
206|      return {
207|        wind: { ...old, regionId: "mexico-wind", totalTWh: (old.totalTWh ?? 0) * windShare, peakGW: (old.peakGW ?? 0) * windShare },
208|        solar: { ...old, regionId: "mexico-solar", totalTWh: (old.totalTWh ?? 0) * solarShare, peakGW: (old.peakGW ?? 0) * solarShare },
209|      };
210|    },
211|  })
212|    .then((data) => process.stdout.write(JSON.stringify(data)))
213|    .catch((err) => {
214|      console.error("mexico loader failed", err);
215|      process.exit(1);
216|    });
217|}
218|
219|export const buildMexicoData = () => run({ probe: false });
220|
221|/** Test seam: run the Mexico loader with deterministic now and/or a fixture CSV path. */
222|export const runMexico = (opts: { probe?: boolean; now?: Date; csvPath?: string } = {}) =>
223|  run(opts);
224|