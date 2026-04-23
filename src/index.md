# Every Last Joule

<div id="app-root"></div>

```js
import { createClock } from "./components/clock.js";
import { mountControls } from "./components/controls.js";
import { mountModeToggle } from "./components/mode-toggle.js";
import { mountTimeline } from "./components/timeline.js";
import { aggregateAtHour } from "./lib/calc.js";
import { REGIONS } from "./lib/regions.js";
import { mountGlobe } from "./globe.js";

const ERCOT_NATIVE_ENABLED = false;

const cbeci = await FileAttachment("data/cbeci.json").json();
const ercot = await FileAttachment("data/ercot.json").json();
const ercotNative = await FileAttachment("data/ercot-native.json").json();
const caiso = await FileAttachment("data/caiso.json").json();
const entsoe = await FileAttachment("data/entsoe.json").json();
const aemo = await FileAttachment("data/aemo.json").json();
const belgium = await FileAttachment("data/belgium.json").json();
const france = await FileAttachment("data/france.json").json();
const denmark = await FileAttachment("data/denmark.json").json();
const newZealand = await FileAttachment("data/new-zealand.json").json();
const norway = await FileAttachment("data/norway.json").json();
const atacama = await FileAttachment("data/atacama-chile.json").json();
const statics = await FileAttachment("data/statics.json").json();
const anchor = await FileAttachment("data/anchor.json").json();
const northSea = await FileAttachment("data/north-sea.json").json();
const brazilNE = await FileAttachment("data/brazil-ne.json").json();
const ontario = await FileAttachment("data/ontario.json").json();
const alberta = await FileAttachment("data/alberta.json").json();
const ireland = await FileAttachment("data/ireland.json").json();
const peru = await FileAttachment("data/peru.json").json();
const southAfrica = await FileAttachment("data/south-africa.json").json();

document.getElementById("app-root").innerHTML = `
  <div class="app-shell">
    <header class="app-header">
      <div class="app-title">
        <span class="app-mark">●</span>
        <span class="app-wordmark">Every Last Joule</span>
        <span class="app-tag">Unlocked Potential · v0</span>
      </div>
      <a class="app-methodology" href="./methodology">Methodology →</a>
    </header>

    <div class="app-body">
      <section class="panel panel-left" aria-label="Headline">
        <div class="eyebrow">Sustainable hashrate · unlocked</div>
        <div class="display-xl num-tabular" id="pct-readout">—%</div>
        <p class="lead" id="lead-copy">of today's Bitcoin network, powered entirely by energy observed curtailed, spilled, or flared in the last 30 days. A floor, not a ceiling.</p>
        <div class="stats-row">
          <div class="stat">
            <div class="eyebrow micro">Network hashrate</div>
            <div class="num-tabular stat-value" id="hashrate-readout">—</div>
          </div>
          <div class="stat">
            <div class="eyebrow micro">Wasted now (UTC)</div>
            <div class="num-tabular stat-value" id="gw-readout">—</div>
          </div>
          <div class="stat">
            <div class="eyebrow micro">At 16 J/TH supports</div>
            <div class="num-tabular stat-value" id="supportable-readout">—</div>
          </div>
        </div>
      </section>

      <section class="panel panel-center" aria-label="Globe">
        <div class="globe-placeholder" id="globe-placeholder" aria-live="polite">
          <span class="globe-placeholder-label">Computing land mask…</span>
        </div>
        <canvas id="globe-canvas" role="img" aria-label="Rotating globe showing active waste-energy hotspots"></canvas>
      </section>

      <section class="panel panel-right" aria-label="Active hotspots">
        <div class="eyebrow" id="hotspots-title">Active hotspots · UTC —</div>
        <ol class="hotspot-list" id="hotspot-list"></ol>
        <div class="legend">
          <span class="legend-item"><span class="dot dot-teal"></span>Renewable curtailment</span>
          <span class="legend-item"><span class="dot dot-orange"></span>Flared gas</span>
        </div>
      </section>
    </div>

    <div class="app-timeline">
      <div class="timeline-header">
        <span class="eyebrow">24-hour wasted-energy cycle · global (GW)</span>
        <span class="caption">click or drag to scrub</span>
      </div>
      <canvas id="timeline-canvas"></canvas>
      <div class="timeline-controls">
        <div id="timeline-controls"></div>
        <div id="mode-toggle"></div>
      </div>
    </div>

    <footer class="app-footer">
      <p class="caption" id="caption-copy">Hashrate: mempool.space. Live grid data: EIA, ENTSO-E, Elia, RTE, Energinet, AEMO, Elexon BMRS, ONS, EMI. Static: Ember, GGFR. Refreshed: <span id="refreshed-at">—</span>.</p>
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
  ...aemo,
  belgium,
  germany: entsoe.germany,
  iberia: entsoe.iberia,
  finland: entsoe.finland,
  france,
  netherlands: entsoe.netherlands,
  denmark,
  poland: entsoe.poland,
  turkey: entsoe.turkey,
  greece: entsoe.greece,
  romania: entsoe.romania,
  "italy-north": entsoe["italy-north"],
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
  ...statics
};

document.getElementById("lead-copy").textContent = `of today's Bitcoin network, powered entirely by energy observed curtailed, spilled, or flared in the last 30 days. Visible tracked floor: ${anchor.globalCurtailmentTWh.toFixed(0)} TWh annually.`;
document.getElementById("refreshed-at").textContent = cbeci.lastUpdated;

const now = new Date();
const initialHour = now.getUTCHours() + now.getUTCMinutes() / 60;
const clock = createClock(initialHour);
const mode = typeof Mutable === "function" ? Mutable("avg30d") : { value: "avg30d" };

function renderAt(hour) {
  const utcHour = Math.floor(hour % 24);
  const activeMode = mode.value ?? "avg30d";
  const result = aggregateAtHour(regionData, cbeci, utcHour, activeMode);
  const hh = String(utcHour).padStart(2, "0");
  const mm = String(Math.floor((hour % 1) * 60)).padStart(2, "0");

  document.getElementById("pct-readout").textContent = `${result.pctOfNetwork.toFixed(2)}%`;
  document.getElementById("hashrate-readout").innerHTML = `${cbeci.hashrateEHps.toFixed(1)} <span class="stat-unit">EH/s</span>`;
  document.getElementById("gw-readout").innerHTML = `${result.totalGW.toFixed(2)} <span class="stat-unit">GW</span>`;
  document.getElementById("supportable-readout").innerHTML = `${result.hashrateEHps.toFixed(1)} <span class="stat-unit">EH/s</span>`;
  document.getElementById("hotspots-title").textContent = `Active hotspots · UTC ${hh}:${mm}`;

  const ranked = REGIONS
    .map((region) => ({ region, gw: result.perRegionGW[region.id] ?? 0 }))
    .filter((entry) => entry.gw > 0.05)
    .sort((a, b) => b.gw - a.gw)
    .slice(0, 10);

  document.getElementById("hotspot-list").innerHTML = ranked.map(({ region, gw }) => `
    <li class="hotspot-item">
      <span class="dot ${region.kind === "flare" ? "dot-orange" : "dot-teal"}"></span>
      <span class="hotspot-name">${region.name}</span>
      <span class="hotspot-country">${region.country}</span>
      <span class="hotspot-gw num-tabular">${gw.toFixed(1)} GW</span>
    </li>
  `).join("");
}

const canvas = document.getElementById("globe-canvas");
canvas.hidden = true;
let globe;

const timeline = mountTimeline(document.getElementById("timeline-canvas"), { regionData, cbeci, clock });
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

globe = await mountGlobe(canvas, { regions: REGIONS, regionData, utcHour: initialHour, mode: mode.value });
canvas.hidden = false;
document.getElementById("globe-placeholder")?.remove();

clock.subscribe((hour) => globe.update({ utcHour: hour, mode: mode.value }));
clock.subscribe(renderAt);
```
