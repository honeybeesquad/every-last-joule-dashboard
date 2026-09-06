---
title: Every Last Joule — Globe (embed)
toc: false
sidebar: false
header: ""
footer: ""
pager: false
---

<div id="embed-root" class="embed-root" data-theme-scope="sunfire">
  <div class="embed-stage">
    <div class="embed-globe-area">
      <canvas id="embed-globe-canvas" role="img"
              aria-label="Rotating globe showing curtailed renewable energy across tracked grid regions"></canvas>
    </div>
    <div class="embed-meta">
      <ul class="embed-key" aria-label="Fuel colour key">
        <li><span class="embed-key-dot embed-key-dot--solar"></span><span>Solar</span></li>
        <li><span class="embed-key-dot embed-key-dot--wind"></span><span>Wind</span></li>
        <li><span class="embed-key-dot embed-key-dot--hydro"></span><span>Hydro</span></li>
      </ul>
      <p class="embed-readout">
        <strong id="embed-pct">—%</strong>
        <span>of Bitcoin network powered by curtailed renewables right now</span>
      </p>
    </div>
  </div>
</div>

<style>
  :root[data-theme="sunfire"] #embed-root {
    /* Sunfire fuel tokens still resolve from the html element, but visible
       text and the page surround use the da-ri.org Sunfire-paper palette so
       this iframe blends into the consuming document. */
    --embed-bg: #F7F7F4;
    --embed-globe-bg: #0a0f24;
    --embed-fg: #1A2340;
    --embed-fg-muted: #6B7280;
    --embed-rule: #E2E2DC;
  }

  /* Reset the framework's own page chrome so the embed is just the figure. */
  html, body { background: transparent !important; }
  body > header,
  body > nav,
  body > footer,
  #observablehq-header,
  #observablehq-footer,
  #observablehq-sidebar,
  #observablehq-toc,
  .observablehq-link-icon { display: none !important; }
  main, #observablehq-main, #observablehq-center {
    margin: 0 !important;
    padding: 0 !important;
    max-width: none !important;
  }

  .embed-root {
    background: var(--embed-bg);
    color: var(--embed-fg);
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    width: 100%;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    box-sizing: border-box;
  }

  .embed-stage {
    width: 100%;
    max-width: 960px;
    display: grid;
    grid-template-rows: 1fr auto;
    gap: 14px;
  }

  .embed-globe-area {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 10;
    min-height: 360px;
    background: var(--embed-globe-bg);
    border-radius: 6px;
    overflow: hidden;
  }

  #embed-globe-canvas {
    width: 100%;
    height: 100%;
    display: block;
    /* Hidden until mountGlobe completes, mirroring src/index.md's pattern. */
  }

  .embed-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px 24px;
    padding-top: 12px;
    border-top: 1px solid var(--embed-rule);
  }

  .embed-key {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: 13px;
    color: var(--embed-fg);
  }
  .embed-key li {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .embed-key-dot {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    display: inline-block;
    flex-shrink: 0;
    box-shadow: 0 0 0 1px rgba(26, 35, 64, 0.12);
  }
  .embed-key-dot--solar { background: var(--fuel-solar, #ffd05a); }
  .embed-key-dot--wind  { background: var(--fuel-wind,  #67e8f9); }
  .embed-key-dot--hydro { background: var(--fuel-hydro, #b8cdff); }

  .embed-readout {
    margin: 0;
    font-size: 14px;
    color: var(--embed-fg-muted);
    text-align: right;
  }
  .embed-readout strong {
    font-family: "Fraunces", Georgia, "Times New Roman", serif;
    font-weight: 600;
    font-size: 22px;
    color: var(--embed-fg);
    margin-right: 6px;
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 600px) {
    .embed-globe-area { aspect-ratio: 4 / 3; min-height: 280px; }
    .embed-readout { text-align: left; }
  }
</style>

```js
// Force the Sunfire theme on this embed so fuel colour tokens resolve
// regardless of any localStorage state inherited from a previous visit
// to the parent dashboard. The embed has no theme switcher.
document.documentElement.setAttribute("data-theme", "sunfire");
```

```js
import { aggregateAtHour, ehsFromGW } from "../lib/calc.js";
import { REGIONS } from "../lib/regions.js";
import { EMBED_DATA_LOADERS, loadDataFiles } from "../lib/data-loaders.js";
import { isRenewable } from "../lib/fuel.js";
import { splitRegion } from "../lib/split-region.js";
import { finalizeRegionData } from "../lib/region-data-finalize.js";
import { mountGlobe } from "../globe.js";

// Same registry as the dashboard: src/lib/data-loaders.js is the single
// declared mapping of key → data file → label, and EMBED_DATA_LOADERS is that
// list minus the entries flagged `embed: false` (only the Zenodo version
// badge — not a region, and a live fetch this page must not block on).
//
// This page used to repeat the dashboard's fetch array and name the results by
// array position; PR #203 rotated eight of those bindings by six slots here and
// on the dashboard, and nine regions rendered another region's curtailment for
// about three months (fixed by PR #922). Deriving both the fetch list and the
// `feeds` record from one keyed registry removes the position entirely.
const feeds = await loadDataFiles(EMBED_DATA_LOADERS);

// Identical wiring to src/index.md. The loader list is now shared
// (src/lib/data-loaders.js), but this regionData literal is still a
// hand-maintained copy of the dashboard's — see the "shared buildRegionData()"
// follow-up in STATUS.md. When that extraction lands this block goes with it.
//
// Until then `tests/globe-drift.test.ts` enforces the copy: it asserts this
// object has exactly the same keys and spreads as src/index.md's, and that
// both pages parse as JavaScript. Add a region to the dashboard and that test
// fails until you add it here too.
const regionData = {
  "ercot-east-wind":  feeds.ercot["ercot-east-wind"],
  "ercot-east-solar":  feeds.ercot["ercot-east-solar"],
  "ercot-west-wind":   feeds.ercot["ercot-west-wind"],
  "ercot-west-solar":  feeds.ercot["ercot-west-solar"],
  "caiso-wind":  feeds.caiso.wind,
  "caiso-solar": feeds.caiso.solar,
  "miso-wind":   feeds.miso.wind,
  "miso-solar":  feeds.miso.solar,
  "pjm-wind":    feeds.pjm.wind,
  "pjm-solar":   feeds.pjm.solar,
  "spp-wind":    feeds.spp.wind,
  "spp-solar":   feeds.spp.solar,
  "nyiso-zones-d-e":  splitRegion(feeds.nyiso.wind, "nyiso-zones-d-e", 0.75, "Zones D+E share (75% of NYISO wind curtailment per Power Trends 2024)"),
  "nyiso-rest-wind":  splitRegion(feeds.nyiso.wind, "nyiso-rest-wind", 0.25, "Remainder of NYISO wind"),
  "nyiso-rest-solar": feeds.nyiso.solar,
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
  "germany-50hertz-wind":  feeds.germanyCurtailment["germany-50hertz-wind"],
  "germany-50hertz-solar": feeds.germanyCurtailment["germany-50hertz-solar"],
  "germany-amprion-wind":  feeds.germanyCurtailment["germany-amprion-wind"],
  "germany-amprion-solar": feeds.germanyCurtailment["germany-amprion-solar"],
  "germany-tennet-de-wind":  feeds.germanyCurtailment["germany-tennet-de-wind"],
  "germany-tennet-de-solar": feeds.germanyCurtailment["germany-tennet-de-solar"],
  "germany-transnetbw-wind":  feeds.germanyCurtailment["germany-transnetbw-wind"],
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
  ...(() => {
    const wShare = feeds.denmark.fuelShare?.wind ?? 0.7;
    const sShare = feeds.denmark.fuelShare?.solar ?? 0.3;
    return {
      "denmark-west-wind":  splitRegion(feeds.denmark, "denmark-west-wind",  0.75 * wShare, "DK1 wind"),
      "denmark-west-solar": splitRegion(feeds.denmark, "denmark-west-solar", 0.75 * sShare, "DK1 solar"),
      "denmark-east-wind":  splitRegion(feeds.denmark, "denmark-east-wind",  0.25 * wShare, "DK2 wind"),
      "denmark-east-solar": splitRegion(feeds.denmark, "denmark-east-solar", 0.25 * sShare, "DK2 solar"),
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
  "hungary-wind": feeds.entsoe["hungary-wind"],
  "hungary-solar": feeds.entsoe["hungary-solar"],
  "czech-republic-wind": feeds.entsoe["czech-republic-wind"],
  "czech-republic-solar": feeds.entsoe["czech-republic-solar"],
  "bulgaria-wind": feeds.entsoe["bulgaria-wind"],
  "bulgaria-solar": feeds.entsoe["bulgaria-solar"],
  "estonia-wind":  feeds.entsoe["estonia-wind"],
  "estonia-solar": feeds.entsoe["estonia-solar"],
  "bosnia-and-herzegovina": feeds.entsoe["bosnia-and-herzegovina"],
  "croatia-wind": feeds.entsoe["croatia-wind"],
  "croatia-solar": feeds.entsoe["croatia-solar"],
  "luxembourg-wind": feeds.entsoe["luxembourg-wind"],
  "luxembourg-solar": feeds.entsoe["luxembourg-solar"],
  "moldova-wind": feeds.entsoe["moldova-wind"],
  "moldova-solar": feeds.entsoe["moldova-solar"],
  montenegro: feeds.entsoe.montenegro,
  "north-macedonia-wind": feeds.entsoe["north-macedonia-wind"],
  "north-macedonia-solar": feeds.entsoe["north-macedonia-solar"],
  "serbia-wind": feeds.entsoe["serbia-wind"],
  "serbia-solar": feeds.entsoe["serbia-solar"],
  "slovakia-wind": feeds.entsoe["slovakia-wind"],
  "slovakia-solar": feeds.entsoe["slovakia-solar"],
  "slovenia-wind": feeds.entsoe["slovenia-wind"],
  "slovenia-solar": feeds.entsoe["slovenia-solar"],
  switzerland: feeds.entsoe.switzerland,
  "gb-scotland-wind":       splitRegion(feeds.northSea.wind,  "gb-scotland-wind",       0.70, "Scotland share"),
  "gb-scotland-solar":      splitRegion(feeds.northSea.solar, "gb-scotland-solar",      0.70, "Scotland share"),
  "gb-england-wales-wind":  splitRegion(feeds.northSea.wind,  "gb-england-wales-wind",  0.30, "E+W share"),
  "gb-england-wales-solar": splitRegion(feeds.northSea.solar, "gb-england-wales-solar", 0.30, "E+W share"),
  ...feeds.brazilNE,
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
  "japan-hokkaido-solar": feeds.japanHokkaido["japan-hokkaido-solar"],
  "japan-hokkaido-wind":  feeds.japanHokkaido["japan-hokkaido-wind"],
  "japan-hokuriku": feeds.japanHokuriku,
  "japan-kansai":   feeds.japanKansai,
  "japan-kyushu":   feeds.japanKyushu,
  "japan-okinawa":  feeds.japanOkinawa,
  "japan-shikoku":  feeds.japanShikoku,
  "japan-tepco":    feeds.japanTepco,
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
  "south-korea-wind":  feeds.southKorea.wind,
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
  ...feeds.philippines
};

// Finalize the assembled region data — shared with src/index.md. Note: this
// previously called assertCanonicalRegionData *fatally*, retaining the
// "stuck loading" crash that #224 fixed for index.md; the shared helper makes
// it non-fatal here too.
finalizeRegionData(regionData, REGIONS);

const now = new Date();
const initialHour = now.getUTCHours() + now.getUTCMinutes() / 60;

// Renewable Bitcoin % at the current UTC hour. Identical formula to
// src/index.md. The dataset is renewables-only.
function computeRenewablePct(utcHour) {
  const wrappedHour = ((utcHour % 24) + 24) % 24;
  const result = aggregateAtHour(regionData, feeds.cbeci, wrappedHour, "avg30d");
  let renewableGW = 0;
  for (const region of REGIONS) {
    renewableGW += result.perRegionGW[region.id] ?? 0;
  }
  const renewableEHs = ehsFromGW(renewableGW);
  return feeds.cbeci.hashrateEHps > 0 ? (renewableEHs / feeds.cbeci.hashrateEHps) * 100 : 0;
}

function paintReadout(utcHour) {
  const pct = computeRenewablePct(utcHour);
  const el = document.getElementById("embed-pct");
  if (el) el.textContent = `${pct.toFixed(0)}%`;
}

paintReadout(initialHour);

const canvas = document.getElementById("embed-globe-canvas");
const globe = await mountGlobe(canvas, {
  regions: REGIONS.filter((r) => isRenewable(r)),  // renewables-only globe
  regionData,
  utcHour: initialHour,
  mode: "avg30d",
  unitMode: "MW",
  topologyUrl: await FileAttachment("../data/countries-110m.json").url(),
});

// Tick the readout once a minute so the figure stays roughly current
// even when the iframe sits open in a paper for hours. The globe's own
// auto-rotation keeps the canvas alive between ticks.
setInterval(() => {
  const t = new Date();
  const h = t.getUTCHours() + t.getUTCMinutes() / 60;
  globe.update({ utcHour: h, mode: "avg30d", unitMode: "MW" });
  paintReadout(h);
}, 60_000);
```
