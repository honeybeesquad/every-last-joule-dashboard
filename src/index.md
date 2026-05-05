# Every Last Joule

<div id="page-loader" role="status" aria-label="Loading dashboard data">
  <div class="loader-topbar"><div class="loader-topbar-fill"></div></div>
  <div class="loader-center-mark">●</div>
  <div class="loader-center-text">Loading data…</div>
</div>
<div id="app-root"></div>

```js
import { createClock } from "./components/clock.js";
import { mountControls } from "./components/controls.js";
import { mountModeToggle } from "./components/mode-toggle.js";
import { mountThemeToggle } from "./components/theme-toggle.js";
import { mountTimeline } from "./components/timeline.js";
import { mountRegionTooltip } from "./components/region-tooltip.js";
import { aggregateAtHour, ehsFromGW } from "./lib/calc.js";
import { REGIONS } from "./lib/regions.js";
import { FUEL_ORDER, FUEL_LABEL, getFuelColor, fuelShare, isRenewable } from "./lib/fuel.js";
import { applyUncertainty } from "./lib/uncertainty.js";
import { splitRegion } from "./lib/split-region.js";
import { mountGlobe } from "./globe.js";

const ERCOT_NATIVE_ENABLED = false;
const HOTSPOT_LIST_LIMIT = 50;

// Fetch all region data in parallel. Prior to this, every FileAttachment
// was awaited sequentially — 76 round-trips serialised = ~3–5s of pure
// network latency before first paint. HTTP/2 multiplexes these easily;
// on a typical connection this drops to ~300–600ms for the lot.
const [
  cbeci, ercot, ercotNative, caiso, miso, pjm, spp, nyiso, isoNe, bpa,
  entsoe, aemo, belgium, france, denmark, newZealand, norway, atacama,
  chileWind, statics, anchor, northSea, brazilNE, ontario, alberta,
  ireland, peru, southAfrica, argentina, uruguay, paraguay, mexico,
  japanKyushu, vietnam, thailand, indiaRajasthan, cyprus, ethiopia, kazakhstan,
  honduras, jeju, kenya, egypt, morocco, namibia, waSwis, ntPilbara,
  indonesia, malaysia, philippines, southKorea, russiaMainland, taiwan, jordan,
  saudiSolar, uae, oman, israel, innerMongolia, gansu, qinghai, ningxia,
  yunnan, tibet, indiaGujarat, indiaTamilNadu, indiaKarnataka, indiaAndhraPradesh, indiaMaharashtra, indiaEast, pakistan, iran,
  iraqMainland, kurdistan, bangladesh, mongolia, britishColumbia,
  quebec, manitoba, saskatchewan, turkey, colombia, florida,
  chinaShandong, chinaGuangdong, chinaJiangsu, chinaAnhui, chinaHunan,
  chinaLiaoning, chinaHubei, chinaShanxi, chinaShaanxi, chinaZhejiang,
  chinaHenan, chinaFujian, chinaJiangxi, chinaBeijing, chinaGuizhou,
  chinaChongqing, chinaTianjin, chinaHainan, chinaShanghai,
  zenodoVersion
] = await Promise.all([
  FileAttachment("data/cbeci.json").json(),
  FileAttachment("data/ercot.json").json(),
  FileAttachment("data/ercot-native.json").json(),
  FileAttachment("data/caiso.json").json(),
  FileAttachment("data/miso.json").json(),
  FileAttachment("data/pjm.json").json(),
  FileAttachment("data/spp.json").json(),
  FileAttachment("data/nyiso.json").json(),
  FileAttachment("data/iso-ne.json").json(),
  FileAttachment("data/bpa.json").json(),
  FileAttachment("data/entsoe.json").json(),
  FileAttachment("data/aemo.json").json(),
  FileAttachment("data/belgium.json").json(),
  FileAttachment("data/france.json").json(),
  FileAttachment("data/denmark.json").json(),
  FileAttachment("data/new-zealand.json").json(),
  FileAttachment("data/norway.json").json(),
  FileAttachment("data/atacama-chile.json").json(),
  FileAttachment("data/chile-wind.json").json(),
  FileAttachment("data/statics.json").json(),
  FileAttachment("data/anchor.json").json(),
  FileAttachment("data/north-sea.json").json(),
  FileAttachment("data/brazil-ne.json").json(),
  FileAttachment("data/ontario.json").json(),
  FileAttachment("data/alberta.json").json(),
  FileAttachment("data/ireland.json").json(),
  FileAttachment("data/peru.json").json(),
  FileAttachment("data/south-africa.json").json(),
  FileAttachment("data/argentina.json").json(),
  FileAttachment("data/uruguay.json").json(),
  FileAttachment("data/paraguay.json").json(),
  FileAttachment("data/mexico.json").json(),
  FileAttachment("data/japan-kyushu.json").json(),
  FileAttachment("data/vietnam.json").json(),
  FileAttachment("data/thailand.json").json(),
  FileAttachment("data/india-rajasthan.json").json(),
  FileAttachment("data/cyprus.json").json(),
  FileAttachment("data/ethiopia.json").json(),
  FileAttachment("data/kazakhstan.json").json(),
  FileAttachment("data/honduras.json").json(),
  FileAttachment("data/jeju.json").json(),
  FileAttachment("data/kenya.json").json(),
  FileAttachment("data/egypt.json").json(),
  FileAttachment("data/morocco.json").json(),
  FileAttachment("data/namibia.json").json(),
  FileAttachment("data/wa-swis.json").json(),
  FileAttachment("data/nt-pilbara.json").json(),
  FileAttachment("data/indonesia.json").json(),
  FileAttachment("data/malaysia.json").json(),
  FileAttachment("data/philippines.json").json(),
  FileAttachment("data/south-korea.json").json(),
  FileAttachment("data/russia-mainland.json").json(),
  FileAttachment("data/taiwan.json").json(),
  FileAttachment("data/jordan.json").json(),
  FileAttachment("data/saudi-solar.json").json(),
  FileAttachment("data/uae.json").json(),
  FileAttachment("data/oman.json").json(),
  FileAttachment("data/israel.json").json(),
  FileAttachment("data/inner-mongolia.json").json(),
  FileAttachment("data/gansu.json").json(),
  FileAttachment("data/qinghai.json").json(),
  FileAttachment("data/ningxia.json").json(),
  FileAttachment("data/yunnan.json").json(),
  FileAttachment("data/tibet.json").json(),
  FileAttachment("data/india-gujarat.json").json(),
  FileAttachment("data/india-tamil-nadu.json").json(),
  FileAttachment("data/india-karnataka.json").json(),
  FileAttachment("data/india-andhra-pradesh.json").json(),
  FileAttachment("data/india-maharashtra.json").json(),
  FileAttachment("data/india-east.json").json(),
  FileAttachment("data/pakistan.json").json(),
  FileAttachment("data/iran.json").json(),
  FileAttachment("data/iraq-mainland.json").json(),
  FileAttachment("data/kurdistan.json").json(),
  FileAttachment("data/bangladesh.json").json(),
  FileAttachment("data/mongolia.json").json(),
  FileAttachment("data/british-columbia.json").json(),
  FileAttachment("data/quebec.json").json(),
  FileAttachment("data/manitoba.json").json(),
  FileAttachment("data/saskatchewan.json").json(),
  FileAttachment("data/turkey.json").json(),
  FileAttachment("data/colombia.json").json(),
  FileAttachment("data/florida.json").json(),
  FileAttachment("data/china-shandong.json").json(),
  FileAttachment("data/china-guangdong.json").json(),
  FileAttachment("data/china-jiangsu.json").json(),
  FileAttachment("data/china-anhui.json").json(),
  FileAttachment("data/china-hunan.json").json(),
  FileAttachment("data/china-liaoning.json").json(),
  FileAttachment("data/china-hubei.json").json(),
  FileAttachment("data/china-shanxi.json").json(),
  FileAttachment("data/china-shaanxi.json").json(),
  FileAttachment("data/china-zhejiang.json").json(),
  FileAttachment("data/china-henan.json").json(),
  FileAttachment("data/china-fujian.json").json(),
  FileAttachment("data/china-jiangxi.json").json(),
  FileAttachment("data/china-beijing.json").json(),
  FileAttachment("data/china-guizhou.json").json(),
  FileAttachment("data/china-chongqing.json").json(),
  FileAttachment("data/china-tianjin.json").json(),
  FileAttachment("data/china-hainan.json").json(),
  FileAttachment("data/china-shanghai.json").json(),
  FileAttachment("data/zenodo-version.json").json()
]);

document.getElementById("app-root").innerHTML = `
  <div class="app-shell">
    <header class="app-header">
      <div class="app-title">
        <span class="app-mark">●</span>
        <span class="app-wordmark">Every Last Joule</span>
        <span class="app-tag">Wasted Energy Database · <a class="app-tag-version" href="${zenodoVersion.recordUrl}" target="_blank" rel="noopener">v${zenodoVersion.version}</a></span>
      </div>
      <div class="app-header-right">
        <div id="theme-toggle-mount"></div>
        <nav class="app-nav" aria-label="Primary">
          <a href="./methodology">Methodology</a>
          <a href="./about">About</a>
        </nav>
      </div>
    </header>

    <div class="app-body">
      <section class="panel panel-left" aria-label="Headline">
        <div class="eyebrow">Sustainable hashrate · unlocked right now</div>
        <div class="display-xl num-tabular" id="pct-readout">—%</div>
        <p class="lead" id="lead-copy">of today's Bitcoin network could be powered entirely by renewable energy that was wasted in the last thirty days — observed curtailed, spilled, or constrained-off across <span id="region-count">—</span> tracked regions. A measured floor, not a speculative ceiling.</p>
        <div class="stats-row">
          <div class="stat">
            <div class="eyebrow micro">Bitcoin network hashrate</div>
            <div class="num-tabular stat-value" id="hashrate-readout">—</div>
          </div>
          <div class="stat">
            <div class="eyebrow micro">Curtailed this hour</div>
            <div class="num-tabular stat-value" id="gw-readout">—</div>
          </div>
          <div class="stat">
            <div class="eyebrow micro">Hashrate this could support</div>
            <div class="num-tabular stat-value" id="supportable-readout">—</div>
          </div>
        </div>
        <div class="flare-footnote-row">
          <p class="flare-footnote" id="flare-footnote">Plus <span id="flare-readout">—</span> of continuous flared-gas waste in four oil basins — a 24/7 base load, physically separate from the dispatch-down story above and excluded from the headline ratio.</p>
          <div class="flare-toggle-wrap" id="flare-toggle-wrap" hidden>
            <button class="flare-toggle-btn" id="globe-flare-toggle"
                    role="switch" aria-checked="false"
                    aria-label="Show flared-gas basins" title="Show flared-gas basins">
              <span class="flare-toggle-thumb"></span>
            </button>
            <span class="flare-toggle-label">Flare gas</span>
          </div>
        </div>
      </section>

      <section class="panel panel-center" aria-label="Globe">
        <div class="globe-canvas-area">
          <div class="globe-placeholder" id="globe-placeholder" aria-live="polite">
            <span class="globe-placeholder-label">Computing land mask…</span>
          </div>
          <canvas id="globe-canvas" role="img" aria-label="Rotating globe showing active waste-energy hotspots"></canvas>
        </div>
        <div class="globe-zoom-controls" id="globe-zoom-controls" hidden>
          <span class="globe-zoom-label">Zoom</span>
          <input type="range" id="globe-zoom-slider"
                 class="globe-zoom-slider"
                 min="0.5" max="4" step="0.05" value="1"
                 aria-label="Globe zoom" title="Zoom">
        </div>
      </section>

      <section class="panel panel-right" aria-label="Biggest curtailments right now">
        <div class="eyebrow" id="hotspots-title">Biggest curtailments right now · UTC —</div>
        <div class="hotspot-columns hotspot-columns-three">
          ${FUEL_ORDER.map((fuel) => {
            const subtitle = fuel === "solar"
              ? "Peaks at local noon"
              : fuel === "wind"
                ? "Often peaks overnight"
                : "Seasonal — flat within a day";
            return `
              <div class="hotspot-column">
                <div class="hotspot-column-title">
                  <span class="dot" style="background:${getFuelColor(fuel)};box-shadow:0 0 10px ${getFuelColor(fuel)}66;"></span>
                  <span>${FUEL_LABEL[fuel]}</span>
                </div>
                <div class="hotspot-column-subtitle">${subtitle}</div>
                <ol class="hotspot-list" id="hotspot-list-${fuel}"></ol>
              </div>
            `;
          }).join("")}
        </div>
      </section>
    </div>

    <div class="app-timeline">
      <div class="timeline-header">
        <span class="eyebrow">Global curtailment across a 24-hour cycle (GW, stacked by fuel)</span>
        <span class="caption">drag to scrub through the day · press play to watch it loop · toggle Last 24h for raw yesterday</span>
      </div>
      <canvas id="timeline-canvas"></canvas>
      <div class="timeline-controls">
        <div id="timeline-controls"></div>
        <div id="mode-toggle"></div>
      </div>
    </div>

    <footer class="app-footer">
      <p class="caption" id="caption-copy">
        <strong>Network hashrate</strong> from mempool.space (24-hour rolling).
        <strong>Grid curtailment</strong> from EIA (US), ENTSO-E (Europe), Elia (BE), RTE (FR), Energinet (DK), AEMO NEMWeb (AU), Elexon BMRS (UK), ONS (BR), EPRA (KE), Coordinador Nacional (CL), Electricity Authority EMI (NZ), IESO (ON), AESO (AB), and more.
        <strong>Annual baselines</strong> from Ember, IEA, GGFR, and regional regulator reports (see <a href="./methodology">Methodology</a>).
        <span class="footer-refresh">Last refreshed <span id="refreshed-at">—</span>.</span>
      </p>
    </footer>
  </div>
`;

const regionData = {
  // ERCOT — EIA path emits per-fuel east/west × wind/solar:
  ...(ERCOT_NATIVE_ENABLED
    ? {
        // Native ERCOT path (legacy): map ercot-native-east/west to per-fuel keys.
        // Note: ercot-native loader emits mixed fuel data, mapped to both wind/solar.
        "ercot-east-wind":  { ...ercotNative["ercot-native-east"], regionId: "ercot-east-wind" },
        "ercot-east-solar": { ...ercotNative["ercot-native-east"], regionId: "ercot-east-solar" },
        "ercot-west-wind":  { ...ercotNative["ercot-native-west"], regionId: "ercot-west-wind" },
        "ercot-west-solar": { ...ercotNative["ercot-native-west"], regionId: "ercot-west-solar" },
      }
    : {
        "ercot-east-wind":  ercot["ercot-east-wind"],
        "ercot-east-solar":  ercot["ercot-east-solar"],
        "ercot-west-wind":   ercot["ercot-west-wind"],
        "ercot-west-solar":  ercot["ercot-west-solar"],
      }
  ),
  // CAISO/MISO/PJM/SPP/BPA/NYISO/ISO-NE loaders return shape {wind, solar}
  // (unlike ERCOT which returns {<zone>-<fuel>} keys). regionId is set inside
  // the loader payload, so we just pass through the per-fuel children.
  "caiso-wind":  caiso.wind,
  "caiso-solar": caiso.solar,
  "miso-wind":   miso.wind,
  "miso-solar":  miso.solar,
  "pjm-wind":    pjm.wind,
  "pjm-solar":   pjm.solar,
  "spp-wind":    spp.wind,
  "spp-solar":   spp.solar,
  // NYISO — zones D+E (wind-only carve-out) takes 75% of the wind component;
  // remaining 25% stays in nyiso-rest-wind. NYISO Power Trends 2024.
  "nyiso-zones-d-e":  splitRegion(nyiso.wind, "nyiso-zones-d-e", 0.75, "Zones D+E share (75% of NYISO wind curtailment per Power Trends 2024)"),
  "nyiso-rest-wind":  splitRegion(nyiso.wind, "nyiso-rest-wind", 0.25, "Remainder of NYISO wind"),
  "nyiso-rest-solar": nyiso.solar,
  // ISO-NE — Maine/Vermont (wind-only carve-out) takes 93% of the wind
  // component; remaining 7% stays in iso-ne-rest-wind. ISO-NE IMM 2024.
  "iso-ne-maine-vermont": splitRegion(isoNe.wind, "iso-ne-maine-vermont", 0.93, "ME+VT share (93% of NE wind curtailment per ISO-NE IMM)"),
  "iso-ne-rest-wind":     splitRegion(isoNe.wind, "iso-ne-rest-wind", 0.07, "Remainder of ISO-NE wind"),
  "iso-ne-rest-solar":    isoNe.solar,
  "bpa-wind":  bpa.wind,
  "bpa-solar": bpa.solar,
  ...aemo,
  "belgium-wind": belgium,
  "belgium-solar": belgium,
  "germany-wind": entsoe["germany-wind"],
  "germany-solar": entsoe["germany-solar"],
  "spain-wind": entsoe["spain-wind"],
  "spain-solar": entsoe["spain-solar"],
  "portugal-wind": entsoe["portugal-wind"],
  "portugal-solar": entsoe["portugal-solar"],
  "finland-wind": entsoe["finland-wind"],
  "finland-solar": entsoe["finland-solar"],
  france,
  "netherlands-wind": entsoe["netherlands-wind"],
  "netherlands-solar": entsoe["netherlands-solar"],
  // Denmark split by Energinet PriceArea. DK1 (Jutland/Fyn) hosts most
  // onshore wind and interconnects with Germany; DK2 (Zealand) is across
  // Øresund from Sweden. 75/25 approximates DK1's share of combined
  // wind+solar generation.
  "denmark-west": splitRegion(denmark, "denmark-west", 0.75, "DK1 (Jutland/Fyn) share of Energinet wind+solar"),
  "denmark-east": splitRegion(denmark, "denmark-east", 0.25, "DK2 (Zealand) share of Energinet wind+solar"),
  "poland-wind": entsoe["poland-wind"],
  "poland-solar": entsoe["poland-solar"],
  "greece-wind": entsoe["greece-wind"],
  "greece-solar": entsoe["greece-solar"],
  "romania-wind": entsoe["romania-wind"],
  "romania-solar": entsoe["romania-solar"],
  "turkey-wind": turkey.wind,
  "turkey-solar": turkey.solar,
  // Italy split into three ENTSO-E bidding zones. IT-South domain
  // (10Y1001A1001A86H) returns ENTSO-E error 999 from Terna, so Sicily
  // (10Y1001A1001A75E) is used as the southern-IT signal in its place.
  "italy-north-zone-wind": entsoe["italy-north-zone-wind"],
  "italy-north-zone-solar": entsoe["italy-north-zone-solar"],
  "italy-sicily-wind": entsoe["italy-sicily-wind"],
  "italy-sicily-solar": entsoe["italy-sicily-solar"],
  "italy-sardinia-wind": entsoe["italy-sardinia-wind"],
  "italy-sardinia-solar": entsoe["italy-sardinia-solar"],
  "sweden-north": entsoe["sweden-north"],
  "sweden-south-wind": entsoe["sweden-south-wind"],
  "sweden-south-solar": entsoe["sweden-south-solar"],
  // ukraine moved to statics (ENTSO-E Ukrenergo returns empty post-war)
  "hungary-wind": entsoe["hungary-wind"],
  "hungary-solar": entsoe["hungary-solar"],
  "czech-republic-wind": entsoe["czech-republic-wind"],
  "czech-republic-solar": entsoe["czech-republic-solar"],
  "bulgaria-wind": entsoe["bulgaria-wind"],
  "bulgaria-solar": entsoe["bulgaria-solar"],
  lithuania: entsoe.lithuania,
  latvia: entsoe.latvia,
  estonia: entsoe.estonia,
  // PR #45 leftover Balkan + Baltic regions — wired per Phase 3a-v2 per-fuel split.
  "bosnia-and-herzegovina": entsoe["bosnia-and-herzegovina"],
  "croatia-wind": entsoe["croatia-wind"],
  "croatia-solar": entsoe["croatia-solar"],
  "luxembourg-wind": entsoe["luxembourg-wind"],
  "luxembourg-solar": entsoe["luxembourg-solar"],
  "moldova-wind": entsoe["moldova-wind"],
  "moldova-solar": entsoe["moldova-solar"],
  malta: entsoe.malta,
  montenegro: entsoe.montenegro,
  "north-macedonia-wind": entsoe["north-macedonia-wind"],
  "north-macedonia-solar": entsoe["north-macedonia-solar"],
  "serbia-wind": entsoe["serbia-wind"],
  "serbia-solar": entsoe["serbia-solar"],
  "slovakia-wind": entsoe["slovakia-wind"],
  "slovakia-solar": entsoe["slovakia-solar"],
  "slovenia-wind": entsoe["slovenia-wind"],
  "slovenia-solar": entsoe["slovenia-solar"],
  // Switzerland — PV-only ENTSO-E feed; understates hydro spill but
  // captures summer-midday PV oversupply on Swissgrid's corridor.
  switzerland: entsoe.switzerland,
  // GB split — NESO 2024 Markets Roadmap reports ~11 TWh/yr of constraint
  // actions, dominated by the Scotland-to-England boundary. 70/30 split
  // reflects Scotland's disproportionate share of curtailed wind.
  "gb-scotland-wind":       splitRegion(northSea.wind,  "gb-scotland-wind",       0.70, "Scotland share of GB wind curtailment (NESO constraint data)"),
  "gb-scotland-solar":      splitRegion(northSea.solar, "gb-scotland-solar",      0.70, "Scotland share of GB solar curtailment (NESO constraint data)"),
  "gb-england-wales-wind":  splitRegion(northSea.wind,  "gb-england-wales-wind",  0.30, "England+Wales share of GB wind curtailment"),
  "gb-england-wales-solar": splitRegion(northSea.solar, "gb-england-wales-solar", 0.30, "England+Wales share of GB solar curtailment"),
  ...brazilNE,
  // Norway split (2026-04-24): 5 ENTSO-E bidding zones NO1-NO5. The
  // Norway loader emits a Record keyed by norway-no{1-4}-{hydro,wind} + norway-no5 (hydro only).
  ...norway,
  ...ontario,
  ...alberta,
  ...ireland,
  peru,
  "south-africa": southAfrica,
  "new-zealand-wind":  newZealand.wind,
  "new-zealand-solar": newZealand.solar,
  "new-zealand-geo":   newZealand.geo,
  atacama,
  "chile-wind": chileWind,
  argentina,
  uruguay,
  paraguay,
  mexico,
  "japan-kyushu": japanKyushu,
  vietnam,
  thailand,
  "india-rajasthan": indiaRajasthan,
  cyprus,
  ethiopia,
  kazakhstan,
  honduras,
  jeju,
  kenya,
  egypt,
  morocco,
  namibia,
  "wa-swis": waSwis,
  "nt-pilbara": ntPilbara,
  indonesia,
  malaysia,
  "south-korea": southKorea,
  "russia-mainland": russiaMainland,
  taiwan,
  jordan,
  "saudi-solar": saudiSolar,
  uae,
  oman,
  israel,
  "inner-mongolia": innerMongolia,
  "gansu-wind":  gansu.wind,
  "gansu-solar": gansu.solar,
  qinghai,
  "ningxia-wind":  ningxia.wind,
  "ningxia-solar": ningxia.solar,
  yunnan,
  tibet,
  "india-gujarat": indiaGujarat,
  "india-tamil-nadu": indiaTamilNadu,
  "india-karnataka": indiaKarnataka,
  "india-andhra-pradesh": indiaAndhraPradesh,
  "india-maharashtra": indiaMaharashtra,
  "india-east": indiaEast,
  "pakistan-wind":  pakistan.wind,
  "pakistan-solar": pakistan.solar,
  iran,
  "iraq-mainland": iraqMainland,
  kurdistan,
  bangladesh,
  mongolia,
  "british-columbia": britishColumbia,
  quebec,
  manitoba,
  saskatchewan,
  // Colombia: T1b-CSV loader reads committed XM API data (Britta daily relay).
  // Supersedes the T3-static entry in buildAllStatics().
  colombia,
  florida,
  "china-shandong": chinaShandong,
  "china-guangdong": chinaGuangdong,
  "china-jiangsu-wind":  chinaJiangsu.wind,
  "china-jiangsu-solar": chinaJiangsu.solar,
  "china-anhui": chinaAnhui,
  "china-hunan-wind":  chinaHunan.wind,
  "china-hunan-solar": chinaHunan.solar,
  "china-hunan-hydro": chinaHunan.hydro,
  "china-liaoning": chinaLiaoning,
  "china-hubei-wind":  chinaHubei.wind,
  "china-hubei-solar": chinaHubei.solar,
  "china-hubei-hydro": chinaHubei.hydro,
  "china-shanxi-wind":  chinaShanxi.wind,
  "china-shanxi-solar": chinaShanxi.solar,
  "china-shaanxi": chinaShaanxi,
  "china-zhejiang": chinaZhejiang,
  "china-henan": chinaHenan,
  "china-fujian": chinaFujian,
  "china-jiangxi": chinaJiangxi,
  "china-beijing": chinaBeijing,
  "china-guizhou-solar": chinaGuizhou.solar,
  "china-guizhou-hydro": chinaGuizhou.hydro,
  "china-chongqing-hydro": chinaChongqing.hydro,
  "china-chongqing-solar": chinaChongqing.solar,
  "china-tianjin": chinaTianjin,
  "china-hainan": chinaHainan,
  "china-shanghai": chinaShanghai,
  ...statics,
  // Philippines: split by fuel (solar + wind). Loader returns a Record so spread here.
  // Supersedes the philippines statics entry (removed 2026-04-30).
  ...philippines
};

// S2 uncertainty: defensive fallback. Every loader is now responsible for
// setting confidenceTier + uncertaintyLow/HighGW upstream — typical-shape
// builders in `src/lib/typical-profiles.ts`, the statics builder in
// `src/data/statics.json.ts`, and the cache-boundary `enrichWithTier` in
// `src/lib/resilient.ts` between them cover live, static-modelled, and
// flare regions. This loop is a defensive shim for any region that slips
// through (e.g. a future region added to regions.ts without a loader call
// to applyUncertainty).
//
// We derive profileKind from regions.ts kind so the fallback assigns the
// correct tier rather than silently routing every static through T2:
//   wind/solar/mixed → T3-modelled
//   hydro            → T3-modelled (hydro-seasonal fallback)
//   flare            → T2-annual-calibrated (flat 24/7)
//   live regions     → T1-live-TSO (no profileKind)
const KIND_TO_PROFILE = {
  wind: "wind",
  solar: "solar",
  mixed: "mixed",
  hydro: "hydro-seasonal",
  flare: "flat"
};
for (const region of REGIONS) {
  const d = regionData[region.id];
  if (!d) continue;
  if (d.confidenceTier) continue; // preserve tier already set by loader
  const profileKind = region.tier === "static" ? KIND_TO_PROFILE[region.kind] : undefined;
  console.warn(`[uncertainty] late-binding tier for ${region.id} (kind=${region.kind}); loader should set this upstream`);
  regionData[region.id] = applyUncertainty(d, { regionTier: region.tier, profileKind });
}

// Populate the region-count span inside the lead copy without clobbering
// the surrounding HTML (the ${FUEL_ORDER.map} earlier baked it in at render).
{
  const liveRegionCount = REGIONS.filter((r) => r.kind !== "flare").length;
  const countEl = document.getElementById("region-count");
  if (countEl) countEl.textContent = String(liveRegionCount);
}
document.getElementById("refreshed-at").textContent = cbeci.lastUpdated;

const now = new Date();
const initialHour = now.getUTCHours() + now.getUTCMinutes() / 60;
const clock = createClock(initialHour);
const mode = typeof Mutable === "function" ? Mutable("avg30d") : { value: "avg30d" };

function renderAt(hour) {
  const wrappedHour = ((hour % 24) + 24) % 24;
  const activeMode = mode.value ?? "avg30d";
  // Pass the fractional hour so the aggregate tweens between integer hours;
  // the headline readouts (pct, GW) smooth in lock-step with the pillars.
  const result = aggregateAtHour(regionData, cbeci, wrappedHour, activeMode);
  const hh = String(Math.floor(wrappedHour)).padStart(2, "0");
  const mm = String(Math.floor((wrappedHour % 1) * 60)).padStart(2, "0");

  // Renewable-only aggregate — flare excluded from the headline because
  // it is continuous 24/7 base load, not a diurnal curtailment story.
  let renewableGW = 0;
  let flareGW = 0;
  for (const region of REGIONS) {
    const gw = result.perRegionGW[region.id] ?? 0;
    if (region.kind === "flare") flareGW += gw;
    else renewableGW += gw;
  }
  const renewableEHs = ehsFromGW(renewableGW);
  const renewablePct = cbeci.hashrateEHps > 0 ? (renewableEHs / cbeci.hashrateEHps) * 100 : 0;

  // Headline readouts: integer pct and 1-decimal GW. At 2× playback the
  // trailing hundredth-digits churn faster than the eye can read them and
  // carry no information (our calibration noise is ≫ 0.01 pp / 10 MW).
  document.getElementById("pct-readout").textContent = `${renewablePct.toFixed(0)}%`;
  document.getElementById("hashrate-readout").innerHTML = `${cbeci.hashrateEHps.toFixed(1)} <span class="stat-unit">EH/s</span>`;
  document.getElementById("gw-readout").innerHTML = `${renewableGW.toFixed(1)} <span class="stat-unit">GW</span>`;
  document.getElementById("supportable-readout").innerHTML = `${renewableEHs.toFixed(1)} <span class="stat-unit">EH/s</span>`;
  document.getElementById("hotspots-title").textContent = `Active hotspots · UTC ${hh}:${mm}`;
  document.getElementById("flare-readout").textContent = `${flareGW.toFixed(0)} GW`;

  const renewableEntries = REGIONS
    .filter(isRenewable)
    .map((region) => ({ region, gw: result.perRegionGW[region.id] ?? 0 }));

  // Display format: 2 decimals for sub-GW values so small-grid regions
  // don't collapse to "0.0 GW" (e.g. Peru 0.02, Baltics 0.02, NYISO 0.03).
  // 1 decimal for values ≥ 1 GW where that granularity matters less.
  const fmtGW = (gw) => (gw >= 1 ? gw.toFixed(1) : gw.toFixed(2));

  const itemHtml = (fuel) => ({ region, gw }) => `
    <li class="hotspot-item">
      <span class="dot" style="background:${getFuelColor(fuel)};box-shadow:0 0 8px ${getFuelColor(fuel)}66;"></span>
      <span class="hotspot-name">${region.name}</span>
      <span class="hotspot-gw num-tabular">${fmtGW(gw)} GW</span>
    </li>
  `;

  for (const fuel of FUEL_ORDER) {
    const rows = renewableEntries
      .map(({ region, gw }) => ({
        region,
        gw: gw * fuelShare(region, fuel, regionData[region.id]),
      }))
      .filter(({ gw }) => gw > 0)
      .sort((a, b) => b.gw - a.gw)
      .slice(0, HOTSPOT_LIST_LIMIT);
    document.getElementById(`hotspot-list-${fuel}`).innerHTML = rows.map(itemHtml(fuel)).join("");
  }
}

const canvas = document.getElementById("globe-canvas");
canvas.hidden = true;
let globe;

const timeline = mountTimeline(document.getElementById("timeline-canvas"), { regions: REGIONS, regionData, cbeci, clock });
mountControls(document.getElementById("timeline-controls"), clock);
mountModeToggle(document.getElementById("mode-toggle"), {
  initial: mode.value,
  onChange(nextMode) {
    mode.value = nextMode;
    renderAt(clock.hour);
    timeline.update({ mode: nextMode });
    globe?.update({ utcHour: clock.hour, mode: nextMode });
  },
});

const themeToggleHost = document.getElementById("theme-toggle-mount");
if (themeToggleHost) mountThemeToggle(themeToggleHost);

const regionTooltip = mountRegionTooltip({
  clock,
  regionData,
  getMode: () => mode.value,
  regions: REGIONS,
});

const zoomSlider = document.getElementById("globe-zoom-slider");
globe = await mountGlobe(canvas, {
  regions: REGIONS,
  regionData,
  utcHour: initialHour,
  mode: mode.value,
  topologyUrl: await FileAttachment("data/countries-110m.json").url(),
  onRegionClick(region, anchor) {
    if (region) regionTooltip.show(region, anchor);
    else regionTooltip.hide();
  },
  onZoomChange: (scale) => { if (zoomSlider) zoomSlider.value = String(scale.toFixed(3)); },
});
canvas.hidden = false;
document.getElementById("globe-placeholder")?.remove();

// Wire up zoom slider now that the globe is live.
const zoomControls = document.getElementById("globe-zoom-controls");
if (zoomControls && zoomSlider) {
  zoomControls.hidden = false;
  zoomSlider.addEventListener("input", () => globe?.setZoom(parseFloat(zoomSlider.value) || 1));
}

// Wire up flare toggle.
const flareToggleWrap = document.getElementById("flare-toggle-wrap");
const flareToggle = document.getElementById("globe-flare-toggle");
if (flareToggleWrap && flareToggle) {
  flareToggleWrap.hidden = false;
  let flareOn = false;
  flareToggle.addEventListener("click", () => {
    flareOn = !flareOn;
    globe?.update({ showFlare: flareOn });
    flareToggle.classList.toggle("is-active", flareOn);
    flareToggle.setAttribute("aria-checked", String(flareOn));
    flareToggle.setAttribute("aria-label", flareOn ? "Hide flared-gas basins" : "Show flared-gas basins");
  });
}

// Dismiss the loading screen now that the globe and all data are ready.
const pageLoader = document.getElementById("page-loader");
if (pageLoader) {
  pageLoader.classList.add("is-fading");
  setTimeout(() => pageLoader.remove(), 380);
}

clock.subscribe((hour) => globe.update({ utcHour: hour, mode: mode.value }));
clock.subscribe(renderAt);
```
