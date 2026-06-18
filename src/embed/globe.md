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
import { isRenewable } from "../lib/fuel.js";
import { splitRegion } from "../lib/split-region.js";
import { finalizeRegionData } from "../lib/region-data-finalize.js";
import { mountGlobe } from "../globe.js";

// Same parallel-fetch pattern as src/index.md. The embed needs the full
// region set so the globe shows the same hotspots as the live dashboard;
// individual loaders are not duplicated, just re-imported via FileAttachment.
const [
  cbeci, ercot, caiso, miso, pjm, spp, nyiso, isoNe, bpa,
  entsoe, aemo, belgium, france, denmark, newZealand, norway, atacama,
  chileWind, statics, anchor, northSea, brazilNE, ontario, alberta,
  ireland, peru, southAfrica, argentina, uruguay, paraguay, mexico,
  japanChubu, japanChugoku, japanHokkaido, japanHokuriku, japanKansai,
  japanKyushu, japanOkinawa, japanShikoku, japanTepco, japanTohoku,
  vietnam, thailand, indiaRajasthan, cyprus, ethiopia, kazakhstan,
  honduras, jeju, kenya, egypt, morocco, namibia, waSwis, ntPilbara,
  indonesia, malaysia, philippines, southKorea, russiaMainland, taiwan, jordan,
  saudiSolar, uae, oman, israel, innerMongolia, gansu, qinghai, ningxia,
  yunnan, tibet, indiaGujarat, indiaTamilNadu, indiaKarnataka, indiaAndhraPradesh,
  indiaMaharashtra, indiaEast, pakistan, iran,
  indiaMadhyaPradesh, indiaTelangana, indiaUttarPradesh, indiaPunjab, indiaOdisha, indiaChhattisgarh,
  iraqMainland, kurdistan, bangladesh, mongolia, britishColumbia,
  quebec, manitoba, saskatchewan, turkey, colombia, florida,
  chinaShandong, chinaGuangdong, chinaJiangsu, chinaAnhui, chinaHunan,
  chinaLiaoning, chinaHubei, chinaShanxi, chinaShaanxi, chinaZhejiang,
  chinaHenan, chinaFujian, chinaJiangxi, chinaBeijing, chinaGuizhou,
  chinaChongqing, chinaTianjin, chinaHainan, chinaShanghai,
  chinaHebei, chinaHeilongjiang, chinaJilin, xinjiang
] = await Promise.all([
  FileAttachment("../data/cbeci.json").json(),
  FileAttachment("../data/ercot.json").json(),
  FileAttachment("../data/caiso.json").json(),
  FileAttachment("../data/miso.json").json(),
  FileAttachment("../data/pjm.json").json(),
  FileAttachment("../data/spp.json").json(),
  FileAttachment("../data/nyiso.json").json(),
  FileAttachment("../data/iso-ne.json").json(),
  FileAttachment("../data/bpa.json").json(),
  FileAttachment("../data/entsoe.json").json(),
  FileAttachment("../data/aemo.json").json(),
  FileAttachment("../data/belgium.json").json(),
  FileAttachment("../data/france.json").json(),
  FileAttachment("../data/denmark.json").json(),
  FileAttachment("../data/new-zealand.json").json(),
  FileAttachment("../data/norway.json").json(),
  FileAttachment("../data/atacama-chile.json").json(),
  FileAttachment("../data/chile-wind.json").json(),
  FileAttachment("../data/statics.json").json(),
  FileAttachment("../data/anchor.json").json(),
  FileAttachment("../data/north-sea.json").json(),
  FileAttachment("../data/brazil-ne.json").json(),
  FileAttachment("../data/ontario.json").json(),
  FileAttachment("../data/alberta.json").json(),
  FileAttachment("../data/ireland.json").json(),
  FileAttachment("../data/peru.json").json(),
  FileAttachment("../data/south-africa.json").json(),
  FileAttachment("../data/argentina.json").json(),
  FileAttachment("../data/uruguay.json").json(),
  FileAttachment("../data/paraguay.json").json(),
  FileAttachment("../data/mexico.json").json(),
  FileAttachment("../data/japan-chubu.json").json(),
  FileAttachment("../data/japan-chugoku.json").json(),
  FileAttachment("../data/japan-hokkaido.json").json(),
  FileAttachment("../data/japan-hokuriku.json").json(),
  FileAttachment("../data/japan-kansai.json").json(),
  FileAttachment("../data/japan-kyushu.json").json(),
  FileAttachment("../data/japan-okinawa.json").json(),
  FileAttachment("../data/japan-shikoku.json").json(),
  FileAttachment("../data/japan-tepco.json").json(),
  FileAttachment("../data/japan-tohoku.json").json(),
  FileAttachment("../data/vietnam.json").json(),
  FileAttachment("../data/thailand.json").json(),
  FileAttachment("../data/india-rajasthan.json").json(),
  FileAttachment("../data/cyprus.json").json(),
  FileAttachment("../data/ethiopia.json").json(),
  FileAttachment("../data/kazakhstan.json").json(),
  FileAttachment("../data/honduras.json").json(),
  FileAttachment("../data/jeju.json").json(),
  FileAttachment("../data/kenya.json").json(),
  FileAttachment("../data/egypt.json").json(),
  FileAttachment("../data/morocco.json").json(),
  FileAttachment("../data/namibia.json").json(),
  FileAttachment("../data/wa-swis.json").json(),
  FileAttachment("../data/nt-pilbara.json").json(),
  FileAttachment("../data/indonesia.json").json(),
  FileAttachment("../data/malaysia.json").json(),
  FileAttachment("../data/philippines.json").json(),
  FileAttachment("../data/south-korea.json").json(),
  FileAttachment("../data/russia-mainland.json").json(),
  FileAttachment("../data/taiwan.json").json(),
  FileAttachment("../data/jordan.json").json(),
  FileAttachment("../data/saudi-solar.json").json(),
  FileAttachment("../data/uae.json").json(),
  FileAttachment("../data/oman.json").json(),
  FileAttachment("../data/israel.json").json(),
  FileAttachment("../data/inner-mongolia.json").json(),
  FileAttachment("../data/gansu.json").json(),
  FileAttachment("../data/qinghai.json").json(),
  FileAttachment("../data/ningxia.json").json(),
  FileAttachment("../data/yunnan.json").json(),
  FileAttachment("../data/tibet.json").json(),
  FileAttachment("../data/india-gujarat.json").json(),
  FileAttachment("../data/india-tamil-nadu.json").json(),
  FileAttachment("../data/india-karnataka.json").json(),
  FileAttachment("../data/india-andhra-pradesh.json").json(),
  FileAttachment("../data/india-maharashtra.json").json(),
  FileAttachment("../data/india-east.json").json(),
  FileAttachment("../data/india-madhya-pradesh.json").json(),
  FileAttachment("../data/india-telangana.json").json(),
  FileAttachment("../data/india-uttar-pradesh.json").json(),
  FileAttachment("../data/india-punjab.json").json(),
  FileAttachment("../data/india-odisha.json").json(),
  FileAttachment("../data/india-chhattisgarh.json").json(),
  FileAttachment("../data/pakistan.json").json(),
  FileAttachment("../data/iran.json").json(),
  FileAttachment("../data/iraq-mainland.json").json(),
  FileAttachment("../data/kurdistan.json").json(),
  FileAttachment("../data/bangladesh.json").json(),
  FileAttachment("../data/mongolia.json").json(),
  FileAttachment("../data/british-columbia.json").json(),
  FileAttachment("../data/quebec.json").json(),
  FileAttachment("../data/manitoba.json").json(),
  FileAttachment("../data/saskatchewan.json").json(),
  FileAttachment("../data/turkey.json").json(),
  FileAttachment("../data/colombia.json").json(),
  FileAttachment("../data/florida.json").json(),
  FileAttachment("../data/china-shandong.json").json(),
  FileAttachment("../data/china-guangdong.json").json(),
  FileAttachment("../data/china-jiangsu.json").json(),
  FileAttachment("../data/china-anhui.json").json(),
  FileAttachment("../data/china-hunan.json").json(),
  FileAttachment("../data/china-liaoning.json").json(),
  FileAttachment("../data/china-hubei.json").json(),
  FileAttachment("../data/china-shanxi.json").json(),
  FileAttachment("../data/china-shaanxi.json").json(),
  FileAttachment("../data/china-zhejiang.json").json(),
  FileAttachment("../data/china-henan.json").json(),
  FileAttachment("../data/china-fujian.json").json(),
  FileAttachment("../data/china-jiangxi.json").json(),
  FileAttachment("../data/china-beijing.json").json(),
  FileAttachment("../data/china-guizhou.json").json(),
  FileAttachment("../data/china-chongqing.json").json(),
  FileAttachment("../data/china-tianjin.json").json(),
  FileAttachment("../data/china-hainan.json").json(),
  FileAttachment("../data/china-shanghai.json").json(),
  FileAttachment("../data/china-hebei.json").json(),
  FileAttachment("../data/china-heilongjiang.json").json(),
  FileAttachment("../data/china-jilin.json").json(),
  FileAttachment("../data/xinjiang.json").json()
]);

// Identical wiring to src/index.md. Kept inline (rather than abstracted to
// a shared loaders.ts module) because the dashboard wiring is not yet
// factored out — see the "End-to-end loader-output integrity test" follow-up
// in STATUS.md. When that refactor lands this block should follow it.
const regionData = {
  "ercot-east-wind":  ercot["ercot-east-wind"],
  "ercot-east-solar":  ercot["ercot-east-solar"],
  "ercot-west-wind":   ercot["ercot-west-wind"],
  "ercot-west-solar":  ercot["ercot-west-solar"],
  "caiso-wind":  caiso.wind,
  "caiso-solar": caiso.solar,
  "miso-wind":   miso.wind,
  "miso-solar":  miso.solar,
  "pjm-wind":    pjm.wind,
  "pjm-solar":   pjm.solar,
  "spp-wind":    spp.wind,
  "spp-solar":   spp.solar,
  "nyiso-zones-d-e":  splitRegion(nyiso.wind, "nyiso-zones-d-e", 0.75, "Zones D+E share (75% of NYISO wind curtailment per Power Trends 2024)"),
  "nyiso-rest-wind":  splitRegion(nyiso.wind, "nyiso-rest-wind", 0.25, "Remainder of NYISO wind"),
  "nyiso-rest-solar": nyiso.solar,
  "iso-ne-maine-vermont": splitRegion(isoNe.wind, "iso-ne-maine-vermont", 0.93, "ME+VT share (93% of NE wind curtailment per ISO-NE IMM)"),
  "iso-ne-rest-wind":     splitRegion(isoNe.wind, "iso-ne-rest-wind", 0.07, "Remainder of ISO-NE wind"),
  "iso-ne-rest-solar":    isoNe.solar,
  "bpa-wind":  bpa.wind,
  "bpa-solar": bpa.solar,
  ...aemo,
  ...belgium,
  "germany-wind": entsoe["germany-wind"],
  "germany-solar": entsoe["germany-solar"],
  "spain-wind": entsoe["spain-wind"],
  "spain-solar": entsoe["spain-solar"],
  "portugal-wind": entsoe["portugal-wind"],
  "portugal-solar": entsoe["portugal-solar"],
  "finland-wind": entsoe["finland-wind"],
  "finland-solar": entsoe["finland-solar"],
  ...france,
  "netherlands-wind": entsoe["netherlands-wind"],
  "netherlands-solar": entsoe["netherlands-solar"],
  ...(() => {
    const wShare = denmark.fuelShare?.wind ?? 0.7;
    const sShare = denmark.fuelShare?.solar ?? 0.3;
    return {
      "denmark-west-wind":  splitRegion(denmark, "denmark-west-wind",  0.75 * wShare, "DK1 wind"),
      "denmark-west-solar": splitRegion(denmark, "denmark-west-solar", 0.75 * sShare, "DK1 solar"),
      "denmark-east-wind":  splitRegion(denmark, "denmark-east-wind",  0.25 * wShare, "DK2 wind"),
      "denmark-east-solar": splitRegion(denmark, "denmark-east-solar", 0.25 * sShare, "DK2 solar"),
    };
  })(),
  "poland-wind": entsoe["poland-wind"],
  "poland-solar": entsoe["poland-solar"],
  "greece-wind": entsoe["greece-wind"],
  "greece-solar": entsoe["greece-solar"],
  "romania-wind": entsoe["romania-wind"],
  "romania-solar": entsoe["romania-solar"],
  "turkey-wind": turkey.wind,
  "turkey-solar": turkey.solar,
  "italy-north-zone-wind": entsoe["italy-north-zone-wind"],
  "italy-north-zone-solar": entsoe["italy-north-zone-solar"],
  "italy-sicily-wind": entsoe["italy-sicily-wind"],
  "italy-sicily-solar": entsoe["italy-sicily-solar"],
  "italy-sardinia-wind": entsoe["italy-sardinia-wind"],
  "italy-sardinia-solar": entsoe["italy-sardinia-solar"],
  "sweden-north": entsoe["sweden-north"],
  "sweden-south-wind": entsoe["sweden-south-wind"],
  "sweden-south-solar": entsoe["sweden-south-solar"],
  "hungary-wind": entsoe["hungary-wind"],
  "hungary-solar": entsoe["hungary-solar"],
  "czech-republic-wind": entsoe["czech-republic-wind"],
  "czech-republic-solar": entsoe["czech-republic-solar"],
  "bulgaria-wind": entsoe["bulgaria-wind"],
  "bulgaria-solar": entsoe["bulgaria-solar"],
  estonia: entsoe.estonia,
  "bosnia-and-herzegovina": entsoe["bosnia-and-herzegovina"],
  "croatia-wind": entsoe["croatia-wind"],
  "croatia-solar": entsoe["croatia-solar"],
  "luxembourg-wind": entsoe["luxembourg-wind"],
  "luxembourg-solar": entsoe["luxembourg-solar"],
  "moldova-wind": entsoe["moldova-wind"],
  "moldova-solar": entsoe["moldova-solar"],
  montenegro: entsoe.montenegro,
  "north-macedonia-wind": entsoe["north-macedonia-wind"],
  "north-macedonia-solar": entsoe["north-macedonia-solar"],
  "serbia-wind": entsoe["serbia-wind"],
  "serbia-solar": entsoe["serbia-solar"],
  "slovakia-wind": entsoe["slovakia-wind"],
  "slovakia-solar": entsoe["slovakia-solar"],
  "slovenia-wind": entsoe["slovenia-wind"],
  "slovenia-solar": entsoe["slovenia-solar"],
  switzerland: entsoe.switzerland,
  "gb-scotland-wind":       splitRegion(northSea.wind,  "gb-scotland-wind",       0.70, "Scotland share"),
  "gb-scotland-solar":      splitRegion(northSea.solar, "gb-scotland-solar",      0.70, "Scotland share"),
  "gb-england-wales-wind":  splitRegion(northSea.wind,  "gb-england-wales-wind",  0.30, "E+W share"),
  "gb-england-wales-solar": splitRegion(northSea.solar, "gb-england-wales-solar", 0.30, "E+W share"),
  ...brazilNE,
  ...norway,
  ...ontario,
  ...alberta,
  ...ireland,
  ...peru,
  ...southAfrica,
  "new-zealand-wind":  newZealand.wind,
  "new-zealand-solar": newZealand.solar,
  "new-zealand-geo":   newZealand.geo,
  atacama,
  "chile-wind": chileWind,
  argentina,
  uruguay,
  paraguay,
  mexico,
  "japan-chubu":    japanChubu,
  "japan-chugoku":  japanChugoku,
  "japan-hokkaido": japanHokkaido,
  "japan-hokuriku": japanHokuriku,
  "japan-kansai":   japanKansai,
  "japan-kyushu":   japanKyushu,
  "japan-okinawa":  japanOkinawa,
  "japan-shikoku":  japanShikoku,
  "japan-tepco":    japanTepco,
  "japan-tohoku":   japanTohoku,
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
  ...waSwis,
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
  "india-madhya-pradesh": indiaMadhyaPradesh,
  "india-telangana": indiaTelangana,
  "india-uttar-pradesh": indiaUttarPradesh,
  "india-punjab": indiaPunjab,
  "india-odisha": indiaOdisha,
  "india-chhattisgarh": indiaChhattisgarh,
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
  colombia,
  florida,
  "china-shandong-wind":  chinaShandong.wind,
  "china-shandong-solar": chinaShandong.solar,
  "china-guangdong": chinaGuangdong,
  "china-jiangsu-wind":  chinaJiangsu.wind,
  "china-jiangsu-solar": chinaJiangsu.solar,
  "china-anhui-wind":  chinaAnhui.wind,
  "china-anhui-solar": chinaAnhui.solar,
  "china-hunan-wind":  chinaHunan.wind,
  "china-hunan-solar": chinaHunan.solar,
  "china-hunan-hydro": chinaHunan.hydro,
  "china-liaoning-wind":  chinaLiaoning.wind,
  "china-liaoning-solar": chinaLiaoning.solar,
  "china-hubei-wind":  chinaHubei.wind,
  "china-hubei-solar": chinaHubei.solar,
  "china-hubei-hydro": chinaHubei.hydro,
  "china-shanxi-wind":  chinaShanxi.wind,
  "china-shanxi-solar": chinaShanxi.solar,
  "china-shaanxi-wind":  chinaShaanxi.wind,
  "china-shaanxi-solar": chinaShaanxi.solar,
  "china-zhejiang": chinaZhejiang,
  "china-henan-wind":  chinaHenan.wind,
  "china-henan-solar": chinaHenan.solar,
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
  "china-hebei-wind":  chinaHebei.wind,
  "china-hebei-solar": chinaHebei.solar,
  "china-heilongjiang-wind":  chinaHeilongjiang.wind,
  "china-heilongjiang-solar": chinaHeilongjiang.solar,
  "china-jilin-wind":  chinaJilin.wind,
  "china-jilin-solar": chinaJilin.solar,
  "xinjiang-wind":  xinjiang.wind,
  "xinjiang-solar": xinjiang.solar,
  ...statics,
  ...philippines
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
  const result = aggregateAtHour(regionData, cbeci, wrappedHour, "avg30d");
  let renewableGW = 0;
  for (const region of REGIONS) {
    renewableGW += result.perRegionGW[region.id] ?? 0;
  }
  const renewableEHs = ehsFromGW(renewableGW);
  return cbeci.hashrateEHps > 0 ? (renewableEHs / cbeci.hashrateEHps) * 100 : 0;
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
