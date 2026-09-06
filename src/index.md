# Every Last Joule

<div id="page-loader" role="status" aria-label="Loading dashboard data">
  <div class="loader-topbar"><div class="loader-topbar-fill"></div></div>
  <div class="loader-center-mark">●</div>
  <div class="loader-center-text">Every Last Joule</div>
  <div class="loader-terminal">
    <div class="loader-terminal-bar">
      <div class="loader-terminal-dots"><span></span><span></span><span></span></div>
      <span class="loader-terminal-title">Loading regions</span>
    </div>
    <div class="loader-terminal-viewport">
      <div id="loader-terminal-scroll" class="loader-terminal-scroll"></div>
    </div>
  </div>
  <div class="loader-counter">
    <span id="loader-n">0</span> / <span id="loader-total">—</span> regions
  </div>
</div>
<div id="app-root"></div>

```js
import { initLoaderProgress, trackFile } from "./components/loader-progress.js";
import { createClock } from "./components/clock.js";
import { mountControls } from "./components/controls.js";
import { mountModeToggle } from "./components/mode-toggle.js";
import { mountThemeToggle } from "./components/theme-toggle.js";
import { mountTimeline } from "./components/timeline.js";
import { mountRegionTooltip } from "./components/region-tooltip.js";
import { aggregateAtHour, ehsFromGW } from "./lib/calc.js";
import { REGIONS } from "./lib/regions.js";
import { DATA_LOADERS, loadDataFiles } from "./lib/data-loaders.js";
import { FUEL_ORDER, FUEL_LABEL, getFuelColor, fuelShare, isRenewable } from "./lib/fuel.js";
import { splitRegion } from "./lib/split-region.js";
import { finalizeRegionData } from "./lib/region-data-finalize.js";
import { mountGlobe } from "./globe.js";

const HOTSPOT_LIST_LIMIT = 50;

// Fetch every registered data file in parallel. Prior to this, each
// FileAttachment was awaited sequentially — 76 round-trips serialised = ~3–5s
// of pure network latency before first paint. HTTP/2 multiplexes them easily;
// on a typical connection this drops to ~300–600ms for the lot.
//
// The key → file → label mapping lives in ONE place, src/lib/data-loaders.js,
// and both the fetch list and the `feeds` record below are derived from it.
// This page used to hold two parallel structures — an array of promises and an
// array destructuring that named the results — where a name was bound to a
// file by array position alone. PR #203 inserted six loaders into the array
// but appended their names after `pakistan, iran`, rotating eight bindings by
// six slots on this page and on /embed/globe; nine regions rendered another
// region's curtailment for about three months (fixed by PR #922). Reading
// `feeds.<key>` from a name-keyed record removes the position, and with it
// that class of bug.
//
// trackFile() (loader-progress.js) wraps each promise so the loading terminal
// updates as each source resolves. Its denominator is DATA_LOADERS.length —
// the registry's own size, never a hand-maintained number. A hand-maintained
// count silently desyncs (this happened: a stale 132 against the real 135
// entries fired the mop-up-on-last-file logic three files early and the
// counter overshot to "468 / 459 regions"). Not every entry is a single
// canonical region — CBECI, Anchor data and Version metadata are non-region
// payloads, and "Static regions" bundles several regions into one file — so
// the per-file share is a smoothed approximation of progress, not a literal
// region tally, but it still lands on exactly REGIONS.length once every file
// has resolved.
initLoaderProgress(REGIONS.length, DATA_LOADERS.length);
const feeds = await loadDataFiles(DATA_LOADERS, trackFile);

document.getElementById("app-root").innerHTML = `
  <div class="app-shell">
    <header class="app-header">
      <div class="app-title">
        <span class="app-mark">●</span>
        <span class="app-wordmark">Every Last <span class="app-wordmark-accent">Joule</span></span>
        <span class="app-tag">Wasted Energy Database · <a class="app-tag-version" href="${feeds.zenodoVersion.recordUrl}" target="_blank" rel="noopener">v${feeds.zenodoVersion.version}</a></span>
      </div>
      <div class="app-header-right">
        <div id="theme-toggle-mount"></div>
        <nav class="app-nav" aria-label="Primary">
          <a href="./methodology">Methodology</a>
          <a href="./paper">Paper</a>
          <a href="./about">About</a>
        </nav>
      </div>
    </header>

    <div class="app-body">
      <section class="panel panel-left" aria-label="Headline">
        <div class="eyebrow">Sustainable hashrate · unlocked right now</div>
        <div class="stat-headline-row">
          <div class="display-xl num-tabular" id="pct-readout" aria-live="polite" aria-atomic="true">—%</div>
        </div>
        <p class="lead" id="lead-copy">of today's Bitcoin network could be powered entirely by renewable energy that was wasted on an average day — observed curtailed, spilled, or constrained-off across <span id="region-count" aria-live="polite" aria-atomic="true">—</span> tracked regions. This is a measured floor, not a speculative ceiling.</p>
        <div class="stats-row">
          <div class="stat">
            <div class="eyebrow micro" id="hashrate-label">Bitcoin network hashrate</div>
            <div class="num-tabular stat-value" id="hashrate-readout" aria-live="polite" aria-atomic="true">—</div>
          </div>
          <div class="stat">
            <div class="eyebrow micro" id="gw-label">Curtailed this hour</div>
            <div class="num-tabular stat-value" id="gw-readout" aria-live="polite" aria-atomic="true">—</div>
          </div>
          <div class="stat">
            <div class="eyebrow micro" id="supportable-label">Hashrate this could support</div>
            <div class="num-tabular stat-value" id="supportable-readout" aria-live="polite" aria-atomic="true">—</div>
          </div>
        </div>
      </section>

      <section class="panel panel-center" aria-label="Globe">
        <div class="globe-canvas-area">
          <div class="globe-placeholder" id="globe-placeholder" aria-live="polite">
            <span class="globe-placeholder-label">Computing land mask…</span>
          </div>
          <canvas id="globe-canvas" role="img" aria-label="Rotating globe showing active waste-energy hotspots"></canvas>
          <details class="globe-legend" id="globe-legend" aria-label="Legend: data quality and freshness">
            <summary class="globe-legend-summary">ⓘ Legend</summary>
            <div class="globe-legend-body">
              <div class="globe-legend-row"><span class="ql-dot ql-measured" aria-hidden="true"></span>Measured (live feed)</div>
              <div class="globe-legend-row"><span class="ql-dot ql-anchored" aria-hidden="true"></span>Anchored (published annual)</div>
              <div class="globe-legend-row"><span class="ql-dot ql-estimated" aria-hidden="true"></span>Estimated (modelled)</div>
              <div class="globe-legend-row"><span class="ql-dot ql-degraded" aria-hidden="true"></span>Stale feed (&gt;24h)</div>
              <div class="globe-legend-caption">Brighter pillar = higher confidence</div>
            </div>
          </details>
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
                  <span class="dot dot--${fuel}"></span>
                  <span>${FUEL_LABEL[fuel]}</span>
                </div>
                <div class="hotspot-column-subtitle">${subtitle}<span class="hotspot-column-count" id="hotspot-count-${fuel}"></span></div>
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
  "ercot-east-wind":  feeds.ercot["ercot-east-wind"],
  "ercot-east-solar":  feeds.ercot["ercot-east-solar"],
  "ercot-west-wind":   feeds.ercot["ercot-west-wind"],
  "ercot-west-solar":  feeds.ercot["ercot-west-solar"],
  // CAISO/MISO/PJM/SPP/BPA/NYISO/ISO-NE loaders return shape {wind, solar}
  // (unlike ERCOT which returns {<zone>-<fuel>} keys). regionId is set inside
  // the loader payload, so we just pass through the per-fuel children.
  "caiso-wind":  feeds.caiso.wind,
  "caiso-solar": feeds.caiso.solar,
  "miso-wind":   feeds.miso.wind,
  "miso-solar":  feeds.miso.solar,
  "pjm-wind":    feeds.pjm.wind,
  "pjm-solar":   feeds.pjm.solar,
  "spp-wind":    feeds.spp.wind,
  "spp-solar":   feeds.spp.solar,
  // NYISO — zones D+E (wind-only carve-out) takes 75% of the wind component;
  // remaining 25% stays in nyiso-rest-wind. NYISO Power Trends 2024.
  "nyiso-zones-d-e":  splitRegion(feeds.nyiso.wind, "nyiso-zones-d-e", 0.75, "Zones D+E share (75% of NYISO wind curtailment per Power Trends 2024)"),
  "nyiso-rest-wind":  splitRegion(feeds.nyiso.wind, "nyiso-rest-wind", 0.25, "Remainder of NYISO wind"),
  "nyiso-rest-solar": feeds.nyiso.solar,
  // ISO-NE — Maine/Vermont (wind-only carve-out) takes 93% of the wind
  // component; remaining 7% stays in iso-ne-rest-wind. ISO-NE IMM 2024.
  "iso-ne-maine-vermont": splitRegion(feeds.isoNe.wind, "iso-ne-maine-vermont", 0.93, "ME+VT share (93% of NE wind curtailment per ISO-NE IMM)"),
  "iso-ne-rest-wind":     splitRegion(feeds.isoNe.wind, "iso-ne-rest-wind", 0.07, "Remainder of ISO-NE wind"),
  "iso-ne-rest-solar":    feeds.isoNe.solar,
  "bpa-wind":  feeds.bpa.wind,
  "bpa-solar": feeds.bpa.solar,
  "soco-wind":  feeds.soco.wind,
  "soco-solar": feeds.soco.solar,
  "pacw-wind":  feeds.pacw.wind,
  "pacw-solar": feeds.pacw.solar,
  "pace-wind":  feeds.pace.wind,
  "pace-solar": feeds.pace.solar,
  "psco-wind":  feeds.psco.wind,
  "psco-solar": feeds.psco.solar,
  "azps-wind":  feeds.azps.wind,
  "azps-solar": feeds.azps.solar,
  "srp-wind":   feeds.srp.wind,
  "srp-solar":  feeds.srp.solar,
  "ipco-wind":  feeds.ipco.wind,
  "ipco-solar": feeds.ipco.solar,
  "tepc-wind":  feeds.tepc.wind,
  "tepc-solar": feeds.tepc.solar,
  ...feeds.aemo,
  ...feeds.aemoPerPlant,
  ...feeds.belgium,
  "germany-50hertz-wind": feeds.germanyCurtailment["germany-50hertz-wind"],
  "germany-50hertz-solar": feeds.germanyCurtailment["germany-50hertz-solar"],
  "germany-amprion-wind": feeds.germanyCurtailment["germany-amprion-wind"],
  "germany-amprion-solar": feeds.germanyCurtailment["germany-amprion-solar"],
  "germany-tennet-de-wind": feeds.germanyCurtailment["germany-tennet-de-wind"],
  "germany-tennet-de-solar": feeds.germanyCurtailment["germany-tennet-de-solar"],
  "germany-transnetbw-wind": feeds.germanyCurtailment["germany-transnetbw-wind"],
  "germany-transnetbw-solar": feeds.germanyCurtailment["germany-transnetbw-solar"],
  "spain-wind": feeds.entsoe["spain-wind"],
  "spain-solar": feeds.entsoe["spain-solar"],
  "portugal-wind": feeds.entsoe["portugal-wind"],
  "portugal-solar": feeds.entsoe["portugal-solar"],
  "finland-wind": feeds.entsoe["finland-wind"],
  "finland-solar": feeds.entsoe["finland-solar"],
  ...feeds.france,
  "netherlands-wind": feeds.entsoe["netherlands-wind"],
  "netherlands-solar": feeds.entsoe["netherlands-solar"],
  // Denmark split by Energinet PriceArea × fuel. DK1 (Jutland/Fyn) hosts
  // most onshore wind and interconnects with Germany; DK2 (Zealand) is
  // across Øresund from Sweden. Zone share: 75% DK1 / 25% DK2 of combined
  // wind+solar generation. Fuel share: observed 30-day split from the
  // loader's fuelShare field (falls back to 70/30 wind/solar for first
  // boot before any data has loaded).
  ...(() => {
    const wShare = feeds.denmark.fuelShare?.wind ?? 0.7;
    const sShare = feeds.denmark.fuelShare?.solar ?? 0.3;
    return {
      "denmark-west-wind":  splitRegion(feeds.denmark, "denmark-west-wind",  0.75 * wShare, "DK1 wind: 75% zone × observed wind fuel-share"),
      "denmark-west-solar": splitRegion(feeds.denmark, "denmark-west-solar", 0.75 * sShare, "DK1 solar: 75% zone × observed solar fuel-share"),
      "denmark-east-wind":  splitRegion(feeds.denmark, "denmark-east-wind",  0.25 * wShare, "DK2 wind: 25% zone × observed wind fuel-share"),
      "denmark-east-solar": splitRegion(feeds.denmark, "denmark-east-solar", 0.25 * sShare, "DK2 solar: 25% zone × observed solar fuel-share"),
    };
  })(),
  "poland-wind": feeds.entsoe["poland-wind"],
  "poland-solar": feeds.entsoe["poland-solar"],
  "greece-wind": feeds.entsoe["greece-wind"],
  "greece-solar": feeds.entsoe["greece-solar"],
  "romania-wind": feeds.entsoe["romania-wind"],
  "romania-solar": feeds.entsoe["romania-solar"],
  "turkey-wind": feeds.turkey.wind,
  "turkey-solar": feeds.turkey.solar,
  // Italy split into three ENTSO-E bidding zones. IT-South domain
  // (10Y1001A1001A86H) returns ENTSO-E error 999 from Terna, so Sicily
  // (10Y1001A1001A75E) is used as the southern-IT signal in its place.
  "italy-north-zone-wind": feeds.entsoe["italy-north-zone-wind"],
  "italy-north-zone-solar": feeds.entsoe["italy-north-zone-solar"],
  "italy-sicily-wind": feeds.entsoe["italy-sicily-wind"],
  "italy-sicily-solar": feeds.entsoe["italy-sicily-solar"],
  "italy-sardinia-wind": feeds.entsoe["italy-sardinia-wind"],
  "italy-sardinia-solar": feeds.entsoe["italy-sardinia-solar"],
  "italy-cnord-wind": feeds.entsoe["italy-cnord-wind"],
  "italy-cnord-solar": feeds.entsoe["italy-cnord-solar"],
  "italy-csud-wind": feeds.entsoe["italy-csud-wind"],
  "italy-csud-solar": feeds.entsoe["italy-csud-solar"],
  "italy-sud-wind": feeds.entsoe["italy-sud-wind"],
  "italy-sud-solar": feeds.entsoe["italy-sud-solar"],
  "italy-calabria-wind": feeds.entsoe["italy-calabria-wind"],
  "italy-calabria-solar": feeds.entsoe["italy-calabria-solar"],
  "sweden-north": feeds.entsoe["sweden-north"],
  "sweden-south-wind": feeds.entsoe["sweden-south-wind"],
  "sweden-south-solar": feeds.entsoe["sweden-south-solar"],
  // ukraine moved to statics (ENTSO-E Ukrenergo returns empty post-war)
  "hungary-wind": feeds.entsoe["hungary-wind"],
  "hungary-solar": feeds.entsoe["hungary-solar"],
  "czech-republic-wind": feeds.entsoe["czech-republic-wind"],
  "czech-republic-solar": feeds.entsoe["czech-republic-solar"],
  "bulgaria-wind": feeds.entsoe["bulgaria-wind"],
  "bulgaria-solar": feeds.entsoe["bulgaria-solar"],
  // lithuania + latvia reverted live→estimated 2026-05-11; flow from `...statics`.
  "estonia-wind": feeds.entsoe["estonia-wind"],
  "estonia-solar": feeds.entsoe["estonia-solar"],
  // PR #45 leftover Balkan + Baltic regions — wired per Phase 3a-v2 per-fuel split.
  "bosnia-and-herzegovina": feeds.entsoe["bosnia-and-herzegovina"],
  "croatia-wind": feeds.entsoe["croatia-wind"],
  "croatia-solar": feeds.entsoe["croatia-solar"],
  "luxembourg-wind": feeds.entsoe["luxembourg-wind"],
  "luxembourg-solar": feeds.entsoe["luxembourg-solar"],
  "moldova-wind": feeds.entsoe["moldova-wind"],
  "moldova-solar": feeds.entsoe["moldova-solar"],
  // malta reverted live→estimated 2026-05-11; flows from `...statics`.
  montenegro: feeds.entsoe.montenegro,
  "north-macedonia-wind": feeds.entsoe["north-macedonia-wind"],
  "north-macedonia-solar": feeds.entsoe["north-macedonia-solar"],
  "serbia-wind": feeds.entsoe["serbia-wind"],
  "serbia-solar": feeds.entsoe["serbia-solar"],
  "slovakia-wind": feeds.entsoe["slovakia-wind"],
  "slovakia-solar": feeds.entsoe["slovakia-solar"],
  "slovenia-wind": feeds.entsoe["slovenia-wind"],
  "slovenia-solar": feeds.entsoe["slovenia-solar"],
  // Switzerland — PV-only ENTSO-E feed; understates hydro spill but
  // captures summer-midday PV oversupply on Swissgrid's corridor.
  switzerland: feeds.entsoe.switzerland,
  // GB split — NESO 2024 Markets Roadmap reports ~11 TWh/yr of constraint
  // actions, dominated by the Scotland-to-England boundary. 70/30 split
  // reflects Scotland's disproportionate share of curtailed wind.
  "gb-scotland-wind":       splitRegion(feeds.northSea.wind,  "gb-scotland-wind",       0.70, "Scotland share of GB wind curtailment (NESO constraint data)"),
  "gb-scotland-solar":      splitRegion(feeds.northSea.solar, "gb-scotland-solar",      0.70, "Scotland share of GB solar curtailment (NESO constraint data)"),
  "gb-england-wales-wind":  splitRegion(feeds.northSea.wind,  "gb-england-wales-wind",  0.30, "England+Wales share of GB wind curtailment"),
  "gb-england-wales-solar": splitRegion(feeds.northSea.solar, "gb-england-wales-solar", 0.30, "England+Wales share of GB solar curtailment"),
  ...feeds.brazilNE,
  // Norway split (2026-04-24): 5 ENTSO-E bidding zones NO1-NO5. The
  // Norway loader emits a Record keyed by norway-no{1-4}-{hydro,wind} + norway-no5 (hydro only).
  ...feeds.norway,
  ...feeds.ontario,
  ...feeds.alberta,
  ...feeds.ireland,
  ...feeds.peru,
  ...feeds.peruPerPlant,
  ...feeds.southAfrica,
  "new-zealand-wind":  feeds.newZealand.wind,
  "new-zealand-solar": feeds.newZealand.solar,
  "new-zealand-geo":   feeds.newZealand.geo,
  "new-zealand-hydro": feeds.newZealandHydro,
  atacama: feeds.atacama,
  "chile-wind": feeds.chileWind,
  argentina: feeds.argentina,
  uruguay: feeds.uruguay,
  paraguay: feeds.paraguay,
  "mexico-solar": feeds.mexico.solar,
  "mexico-wind": feeds.mexico.wind,
  "japan-chubu":    feeds.japanChubu,
  "japan-chugoku":  feeds.japanChugoku,
  // japan-hokkaido split → { japan-hokkaido-solar, japan-hokkaido-wind }
  "japan-hokkaido-solar": feeds.japanHokkaido["japan-hokkaido-solar"],
  "japan-hokkaido-wind":  feeds.japanHokkaido["japan-hokkaido-wind"],
  "japan-hokuriku": feeds.japanHokuriku,
  "japan-kansai":   feeds.japanKansai,
  "japan-kyushu":   feeds.japanKyushu,
  "japan-okinawa":  feeds.japanOkinawa,
  "japan-shikoku":  feeds.japanShikoku,
  "japan-tepco":    feeds.japanTepco,
  // japan-tohoku split → { japan-tohoku-solar, japan-tohoku-wind }
  "japan-tohoku-solar": feeds.japanTohoku["japan-tohoku-solar"],
  "japan-tohoku-wind":  feeds.japanTohoku["japan-tohoku-wind"],
  vietnam: feeds.vietnam,
  thailand: feeds.thailand,
  "india-rajasthan": feeds.indiaRajasthan,
  cyprus: feeds.cyprus,
  ethiopia: feeds.ethiopia,
  kazakhstan: feeds.kazakhstan,
  honduras: feeds.honduras,
  jeju: feeds.jeju,
  kenya: feeds.kenya,
  egypt: feeds.egypt,
  morocco: feeds.morocco,
  namibia: feeds.namibia,
  ...feeds.waSwis,
  "nt-pilbara": feeds.ntPilbara,
  indonesia: feeds.indonesia,
  malaysia: feeds.malaysia,
  "south-korea-solar": feeds.southKorea.solar,
  "south-korea-wind": feeds.southKorea.wind,
  "russia-mainland": feeds.russiaMainland,
  taiwan: feeds.taiwan,
  jordan: feeds.jordan,
  "saudi-solar": feeds.saudiSolar,
  uae: feeds.uae,
  oman: feeds.oman,
  israel: feeds.israel,
  "inner-mongolia-wind":  feeds.innerMongolia.wind,
  "inner-mongolia-solar": feeds.innerMongolia.solar,
  "gansu-wind":  feeds.gansu.wind,
  "gansu-solar": feeds.gansu.solar,
  "qinghai-wind":  feeds.qinghai.wind,
  "qinghai-solar": feeds.qinghai.solar,
  "ningxia-wind":  feeds.ningxia.wind,
  "ningxia-solar": feeds.ningxia.solar,
  "yunnan-wind":  feeds.yunnan.wind,
  "yunnan-solar": feeds.yunnan.solar,
  "tibet-wind":  feeds.tibet.wind,
  "tibet-solar": feeds.tibet.solar,
  "india-gujarat": feeds.indiaGujarat,
  "india-tamil-nadu": feeds.indiaTamilNadu,
  "india-karnataka": feeds.indiaKarnataka,
  "india-andhra-pradesh": feeds.indiaAndhraPradesh,
  "india-maharashtra": feeds.indiaMaharashtra,
  "india-east": feeds.indiaEast,
  "india-madhya-pradesh": feeds.indiaMadhyaPradesh,
  "india-telangana": feeds.indiaTelangana,
  "india-uttar-pradesh": feeds.indiaUttarPradesh,
  "india-punjab": feeds.indiaPunjab,
  "india-odisha": feeds.indiaOdisha,
  "india-chhattisgarh": feeds.indiaChhattisgarh,
  "pakistan-wind":  feeds.pakistan.wind,
  "pakistan-solar": feeds.pakistan.solar,
  iran: feeds.iran,
  "iraq-mainland": feeds.iraqMainland,
  kurdistan: feeds.kurdistan,
  bangladesh: feeds.bangladesh,
  mongolia: feeds.mongolia,
  "british-columbia": feeds.britishColumbia,
  quebec: feeds.quebec,
  manitoba: feeds.manitoba,
  saskatchewan: feeds.saskatchewan,
  // Colombia: T1b-CSV loader reads committed XM API data (Britta daily relay).
  // Supersedes the T3-static entry in buildAllStatics().
  colombia: feeds.colombia,
  florida: feeds.florida,
  "china-shandong-wind":  feeds.chinaShandong.wind,
  "china-shandong-solar": feeds.chinaShandong.solar,
  "china-guangdong": feeds.chinaGuangdong,
  "china-jiangsu-wind":  feeds.chinaJiangsu.wind,
  "china-jiangsu-solar": feeds.chinaJiangsu.solar,
  "china-anhui-wind":  feeds.chinaAnhui.wind,
  "china-anhui-solar": feeds.chinaAnhui.solar,
  "china-hunan-wind":  feeds.chinaHunan.wind,
  "china-hunan-solar": feeds.chinaHunan.solar,
  "china-hunan-hydro": feeds.chinaHunan.hydro,
  "china-liaoning-wind":  feeds.chinaLiaoning.wind,
  "china-liaoning-solar": feeds.chinaLiaoning.solar,
  "china-hubei-wind":  feeds.chinaHubei.wind,
  "china-hubei-solar": feeds.chinaHubei.solar,
  "china-hubei-hydro": feeds.chinaHubei.hydro,
  "china-shanxi-wind":  feeds.chinaShanxi.wind,
  "china-shanxi-solar": feeds.chinaShanxi.solar,
  "china-shaanxi-wind":  feeds.chinaShaanxi.wind,
  "china-shaanxi-solar": feeds.chinaShaanxi.solar,
  "china-zhejiang": feeds.chinaZhejiang,
  "china-henan-wind":  feeds.chinaHenan.wind,
  "china-henan-solar": feeds.chinaHenan.solar,
  "china-fujian": feeds.chinaFujian,
  "china-jiangxi": feeds.chinaJiangxi,
  "china-beijing": feeds.chinaBeijing,
  "china-guizhou-solar": feeds.chinaGuizhou.solar,
  "china-guizhou-hydro": feeds.chinaGuizhou.hydro,
  "china-chongqing-hydro": feeds.chinaChongqing.hydro,
  "china-chongqing-solar": feeds.chinaChongqing.solar,
  "china-tianjin": feeds.chinaTianjin,
  "china-hainan": feeds.chinaHainan,
  "china-shanghai": feeds.chinaShanghai,
  "china-hebei-wind":  feeds.chinaHebei.wind,
  "china-hebei-solar": feeds.chinaHebei.solar,
  "china-heilongjiang-wind":  feeds.chinaHeilongjiang.wind,
  "china-heilongjiang-solar": feeds.chinaHeilongjiang.solar,
  "china-jilin-wind":  feeds.chinaJilin.wind,
  "china-jilin-solar": feeds.chinaJilin.solar,
  "xinjiang-wind":  feeds.xinjiang.wind,
  "xinjiang-solar": feeds.xinjiang.solar,
  "sichuan-wind":  feeds.sichuan.wind,
  "sichuan-solar": feeds.sichuan.solar,
  "guangxi-wind":  feeds.guangxi.wind,
  "guangxi-solar": feeds.guangxi.solar,
  ...feeds.statics,
  // Philippines: split by fuel (solar + wind). Loader returns a Record so spread here.
  // Supersedes the philippines statics entry (removed 2026-04-30).
  ...feeds.philippines
};

// Finalize the assembled region data — non-fatal integrity check (#224),
// solar-night masking, and defensive uncertainty back-fill. Extracted to a
// shared helper so this page and src/embed/globe.md cannot drift apart
// (src/lib/region-data-finalize.ts).
finalizeRegionData(regionData, REGIONS);

// Populate the region-count span inside the lead copy without clobbering
// the surrounding HTML (the ${FUEL_ORDER.map} earlier baked it in at render).
{
  const liveRegionCount = REGIONS.length;
  const countEl = document.getElementById("region-count");
  if (countEl) countEl.textContent = String(liveRegionCount);
}
document.getElementById("refreshed-at").textContent = feeds.cbeci.lastUpdated;

const now = new Date();
const initialHour = now.getUTCHours() + now.getUTCMinutes() / 60;
const clock = createClock(initialHour);
const mode = typeof Mutable === "function" ? Mutable("avg30d") : { value: "avg30d" };
const unit = { value: "MW" };

function renderAt(hour) {
  const wrappedHour = ((hour % 24) + 24) % 24;
  const activeMode = mode.value ?? "avg30d";
  // Pass the fractional hour so the aggregate tweens between integer hours;
  // the headline readouts (pct, GW) smooth in lock-step with the pillars.
  const result = aggregateAtHour(regionData, feeds.cbeci, wrappedHour, activeMode);
  const hh = String(Math.floor(wrappedHour)).padStart(2, "0");
  const mm = String(Math.floor((wrappedHour % 1) * 60)).padStart(2, "0");

  // Renewable curtailment aggregate — the dataset is renewables-only.
  let renewableGW = 0;
  for (const region of REGIONS) {
    renewableGW += result.perRegionGW[region.id] ?? 0;
  }
  const renewableEHs = ehsFromGW(renewableGW);
  const renewablePct = feeds.cbeci.hashrateEHps > 0 ? (renewableEHs / feeds.cbeci.hashrateEHps) * 100 : 0;

  document.getElementById("pct-readout").textContent = `${renewablePct.toFixed(0)}%`;
  document.getElementById("hotspots-title").textContent = `Active hotspots · UTC ${hh}:${mm}`;

  document.getElementById("hashrate-label").textContent = "Bitcoin network hashrate";
  document.getElementById("hashrate-readout").innerHTML =
    `${feeds.cbeci.hashrateEHps.toFixed(1)} <span class="stat-unit">EH/s</span>`;

  document.getElementById("gw-label").textContent = "Curtailed this hour";
  document.getElementById("gw-readout").innerHTML =
    `${renewableGW.toFixed(1)} <span class="stat-unit">GW</span>`;

  document.getElementById("supportable-label").textContent = "Hashrate this could support";
  document.getElementById("supportable-readout").innerHTML =
    `${renewableEHs.toFixed(1)} <span class="stat-unit">EH/s</span>`;

  const renewableEntries = REGIONS
    .filter(isRenewable)
    .map((region) => ({ region, gw: result.perRegionGW[region.id] ?? 0 }));

  // Display format: 2 decimals for sub-GW values so small-grid regions
  // don't collapse to "0.0 GW" (e.g. Peru 0.02, Baltics 0.02, NYISO 0.03).
  // 1 decimal for values ≥ 1 GW where that granularity matters less.
  const fmtGW = (gw) => (gw >= 1 ? gw.toFixed(1) : gw.toFixed(2));

  for (const fuel of FUEL_ORDER) {
    const allEntries = renewableEntries
      .map(({ region, gw }) => ({
        region,
        gw: gw * fuelShare(region, fuel, regionData[region.id]),
      }))
      .filter(({ gw }) => gw > 0);

    const rows = allEntries
      .sort((a, b) => b.gw - a.gw)
      .slice(0, HOTSPOT_LIST_LIMIT);

    // Say plainly when the column is truncated. `allEntries` is every region
    // currently curtailing in this fuel bucket; `rows` is what fits under
    // HOTSPOT_LIST_LIMIT. With 246 solar and 144 wind regions competing for 50
    // slots, the tail is routinely cut, and a list that silently stops at 50
    // reads as complete. The cap itself stays: renderAt() rebuilds all three
    // lists on every clock tick, including timeline playback at up to 8x.
    const countEl = document.getElementById(`hotspot-count-${fuel}`);
    if (countEl) {
      countEl.textContent = allEntries.length > rows.length
        ? ` · ${rows.length} of ${allEntries.length} shown`
        : ` · ${allEntries.length} active`;
    }

    document.getElementById(`hotspot-list-${fuel}`).innerHTML =
      rows.map(({ region, gw }) => `
        <li class="hotspot-item">
          <span class="dot dot--${fuel}"></span>
          <span class="hotspot-name">${region.name}</span>
          <span class="hotspot-gw num-tabular">${fmtGW(gw)} GW</span>
        </li>
      `).join("");
  }
}

const canvas = document.getElementById("globe-canvas");
canvas.hidden = true;
let globe;

const timeline = mountTimeline(document.getElementById("timeline-canvas"), { regions: REGIONS, regionData, cbeci: feeds.cbeci, clock });
mountControls(document.getElementById("timeline-controls"), clock);
mountModeToggle(document.getElementById("mode-toggle"), {
  initial: mode.value,
  onChange(nextMode) {
    mode.value = nextMode;
    renderAt(clock.hour);
    timeline.update({ mode: nextMode });
    globe?.update({ utcHour: clock.hour, mode: nextMode, unitMode: "MW" });
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
  unitMode: "MW",
  topologyUrl: await FileAttachment("data/countries-110m.json").url(),
  onRegionClick(region, anchor) {
    if (region) regionTooltip.show(region, anchor);
    else regionTooltip.hide();
  },
  onZoomChange: (scale) => { if (zoomSlider) zoomSlider.value = String(scale.toFixed(3)); },
});
canvas.hidden = false;
document.getElementById("globe-placeholder")?.remove();

// Legend: open by default on desktop, collapsed (tap-to-expand) on mobile.
const globeLegend = document.getElementById("globe-legend");
if (globeLegend) globeLegend.open = !window.matchMedia("(max-width: 900px)").matches;

// Wire up zoom slider now that the globe is live.
const zoomControls = document.getElementById("globe-zoom-controls");
if (zoomControls && zoomSlider) {
  zoomControls.hidden = false;
  zoomSlider.addEventListener("input", () => globe?.setZoom(parseFloat(zoomSlider.value) || 1));
}

// Dismiss the loading screen now that the globe and all data are ready.
const pageLoader = document.getElementById("page-loader");
if (pageLoader) {
  pageLoader.classList.add("is-fading");
  setTimeout(() => pageLoader.remove(), 380);
}

clock.subscribe((hour) => globe.update({ utcHour: hour, mode: mode.value, unitMode: "MW" }));
clock.subscribe(renderAt);
```
