# Every Last Joule

<div id="app-root"></div>

```js
import { createClock } from "./components/clock.js";
import { mountControls } from "./components/controls.js";
import { mountModeToggle } from "./components/mode-toggle.js";
import { mountTimeline } from "./components/timeline.js";
import { mountRegionTooltip } from "./components/region-tooltip.js";
import { aggregateAtHour, ehsFromGW } from "./lib/calc.js";
import { REGIONS } from "./lib/regions.js";
import { FUEL_ORDER, FUEL_LABEL, FUEL_COLOR, fuelShare, isRenewable } from "./lib/fuel.js";
import { mountGlobe } from "./globe.js";

const ERCOT_NATIVE_ENABLED = false;
const HOTSPOT_LIST_LIMIT = 50;

const cbeci = await FileAttachment("data/cbeci.json").json();
const ercot = await FileAttachment("data/ercot.json").json();
const ercotNative = await FileAttachment("data/ercot-native.json").json();
const caiso = await FileAttachment("data/caiso.json").json();
const miso = await FileAttachment("data/miso.json").json();
const pjm = await FileAttachment("data/pjm.json").json();
const spp = await FileAttachment("data/spp.json").json();
const nyiso = await FileAttachment("data/nyiso.json").json();
const isoNe = await FileAttachment("data/iso-ne.json").json();
const bpa = await FileAttachment("data/bpa.json").json();
const entsoe = await FileAttachment("data/entsoe.json").json();
const aemo = await FileAttachment("data/aemo.json").json();
const belgium = await FileAttachment("data/belgium.json").json();
const france = await FileAttachment("data/france.json").json();
const denmark = await FileAttachment("data/denmark.json").json();
const newZealand = await FileAttachment("data/new-zealand.json").json();
const norway = await FileAttachment("data/norway.json").json();
const atacama = await FileAttachment("data/atacama-chile.json").json();
const chileWind = await FileAttachment("data/chile-wind.json").json();
const statics = await FileAttachment("data/statics.json").json();
const anchor = await FileAttachment("data/anchor.json").json();
const northSea = await FileAttachment("data/north-sea.json").json();
const brazilNE = await FileAttachment("data/brazil-ne.json").json();
const ontario = await FileAttachment("data/ontario.json").json();
const alberta = await FileAttachment("data/alberta.json").json();
const ireland = await FileAttachment("data/ireland.json").json();
const peru = await FileAttachment("data/peru.json").json();
const southAfrica = await FileAttachment("data/south-africa.json").json();
const argentina = await FileAttachment("data/argentina.json").json();
const uruguay = await FileAttachment("data/uruguay.json").json();
const paraguay = await FileAttachment("data/paraguay.json").json();
const mexico = await FileAttachment("data/mexico.json").json();
const japan = await FileAttachment("data/japan.json").json();
const vietnam = await FileAttachment("data/vietnam.json").json();
const thailand = await FileAttachment("data/thailand.json").json();
const indiaNorth = await FileAttachment("data/india-north.json").json();
const cyprus = await FileAttachment("data/cyprus.json").json();
const ethiopia = await FileAttachment("data/ethiopia.json").json();
const kazakhstan = await FileAttachment("data/kazakhstan.json").json();
const honduras = await FileAttachment("data/honduras.json").json();
const jeju = await FileAttachment("data/jeju.json").json();
const kenya = await FileAttachment("data/kenya.json").json();
const egypt = await FileAttachment("data/egypt.json").json();
const morocco = await FileAttachment("data/morocco.json").json();
const namibia = await FileAttachment("data/namibia.json").json();
const waSwis = await FileAttachment("data/wa-swis.json").json();
const ntPilbara = await FileAttachment("data/nt-pilbara.json").json();
const indonesia = await FileAttachment("data/indonesia.json").json();
const malaysia = await FileAttachment("data/malaysia.json").json();
const southKorea = await FileAttachment("data/south-korea.json").json();
const russiaMainland = await FileAttachment("data/russia-mainland.json").json();
const taiwan = await FileAttachment("data/taiwan.json").json();
const jordan = await FileAttachment("data/jordan.json").json();
const saudiSolar = await FileAttachment("data/saudi-solar.json").json();
const uae = await FileAttachment("data/uae.json").json();
const oman = await FileAttachment("data/oman.json").json();
const israel = await FileAttachment("data/israel.json").json();
const innerMongolia = await FileAttachment("data/inner-mongolia.json").json();
const gansu = await FileAttachment("data/gansu.json").json();
const qinghai = await FileAttachment("data/qinghai.json").json();
const ningxia = await FileAttachment("data/ningxia.json").json();
const yunnan = await FileAttachment("data/yunnan.json").json();
const tibet = await FileAttachment("data/tibet.json").json();
const indiaSouth = await FileAttachment("data/india-south.json").json();
const indiaWest = await FileAttachment("data/india-west.json").json();
const indiaEast = await FileAttachment("data/india-east.json").json();
const pakistan = await FileAttachment("data/pakistan.json").json();
const iran = await FileAttachment("data/iran.json").json();
const iraqMainland = await FileAttachment("data/iraq-mainland.json").json();
const kurdistan = await FileAttachment("data/kurdistan.json").json();
const bangladesh = await FileAttachment("data/bangladesh.json").json();
const mongolia = await FileAttachment("data/mongolia.json").json();
const britishColumbia = await FileAttachment("data/british-columbia.json").json();
const quebec = await FileAttachment("data/quebec.json").json();
const manitoba = await FileAttachment("data/manitoba.json").json();
const saskatchewan = await FileAttachment("data/saskatchewan.json").json();
const colombia = await FileAttachment("data/colombia.json").json();

document.getElementById("app-root").innerHTML = `
  <div class="app-shell">
    <header class="app-header">
      <div class="app-title">
        <span class="app-mark">●</span>
        <span class="app-wordmark">Every Last Joule</span>
        <span class="app-tag">Unlocked Potential · v0</span>
      </div>
      <nav class="app-nav" aria-label="Primary">
        <a href="./methodology">Methodology</a>
        <a href="./about">About</a>
      </nav>
    </header>

    <div class="app-body">
      <section class="panel panel-left" aria-label="Headline">
        <div class="eyebrow">Sustainable hashrate · unlocked right now</div>
        <div class="display-xl num-tabular" id="pct-readout">—%</div>
        <p class="lead" id="lead-copy">of today's Bitcoin network could be powered entirely by renewable energy that was observed curtailed, spilled, or constrained-off in the last thirty days — across <span id="region-count">—</span> tracked regions. A measured floor, not a speculative ceiling.</p>
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
        <p class="flare-footnote" id="flare-footnote">Plus <span id="flare-readout">—</span> of continuous flared-gas waste in four oil basins — a 24/7 base load, physically separate from the dispatch-down story above and excluded from the headline ratio.</p>
      </section>

      <section class="panel panel-center" aria-label="Globe">
        <div class="globe-placeholder" id="globe-placeholder" aria-live="polite">
          <span class="globe-placeholder-label">Computing land mask…</span>
        </div>
        <canvas id="globe-canvas" role="img" aria-label="Rotating globe showing active waste-energy hotspots"></canvas>
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
                  <span class="dot" style="background:${FUEL_COLOR[fuel]};box-shadow:0 0 10px ${FUEL_COLOR[fuel]}66;"></span>
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
  ...(ERCOT_NATIVE_ENABLED
    ? {
        "ercot-west": { ...ercotNative["ercot-native-west"], regionId: "ercot-west" },
        "ercot-east": { ...ercotNative["ercot-native-east"], regionId: "ercot-east" }
      }
    : ercot),
  caiso,
  miso,
  pjm,
  spp,
  nyiso,
  "iso-ne": isoNe,
  bpa,
  ...aemo,
  belgium,
  germany: entsoe.germany,
  iberia: entsoe.iberia,
  portugal: entsoe.portugal,
  finland: entsoe.finland,
  france,
  netherlands: entsoe.netherlands,
  denmark,
  poland: entsoe.poland,
  greece: entsoe.greece,
  romania: entsoe.romania,
  // Italy split into three ENTSO-E bidding zones (v1t)
  "italy-north-zone": entsoe["italy-north-zone"],
  "italy-south": entsoe["italy-south"],
  "italy-sardinia": entsoe["italy-sardinia"],
  "sweden-north": entsoe["sweden-north"],
  "sweden-south": entsoe["sweden-south"],
  // ukraine moved to statics (ENTSO-E Ukrenergo returns empty post-war)
  hungary: entsoe.hungary,
  "czech-republic": entsoe["czech-republic"],
  bulgaria: entsoe.bulgaria,
  baltics: entsoe.baltics,
  "north-sea": northSea,
  ...brazilNE,
  "n-norway": norway,
  ontario,
  alberta,
  ireland,
  peru,
  "south-africa": southAfrica,
  "new-zealand": newZealand,
  atacama,
  "chile-wind": chileWind,
  argentina,
  uruguay,
  paraguay,
  mexico,
  japan,
  vietnam,
  thailand,
  "india-north": indiaNorth,
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
  gansu,
  qinghai,
  ningxia,
  yunnan,
  tibet,
  "india-south": indiaSouth,
  "india-west": indiaWest,
  "india-east": indiaEast,
  pakistan,
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
  ...statics
};

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

  document.getElementById("pct-readout").textContent = `${renewablePct.toFixed(2)}%`;
  document.getElementById("hashrate-readout").innerHTML = `${cbeci.hashrateEHps.toFixed(1)} <span class="stat-unit">EH/s</span>`;
  document.getElementById("gw-readout").innerHTML = `${renewableGW.toFixed(2)} <span class="stat-unit">GW</span>`;
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
      <span class="dot" style="background:${FUEL_COLOR[fuel]};box-shadow:0 0 8px ${FUEL_COLOR[fuel]}66;"></span>
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

const regionTooltip = mountRegionTooltip({
  clock,
  regionData,
  getMode: () => mode.value,
  regions: REGIONS,
});

globe = await mountGlobe(canvas, {
  regions: REGIONS,
  regionData,
  utcHour: initialHour,
  mode: mode.value,
  onRegionClick(region, anchor) {
    if (region) regionTooltip.show(region, anchor);
    else regionTooltip.hide();
  },
});
canvas.hidden = false;
document.getElementById("globe-placeholder")?.remove();

clock.subscribe((hour) => globe.update({ utcHour: hour, mode: mode.value }));
clock.subscribe(renderAt);
```
