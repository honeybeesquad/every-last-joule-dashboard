# Every Last Joule

<div id="app-root"></div>

```js
import { createClock } from "./components/clock.js";
import { mountControls } from "./components/controls.js";
import { mountTimeline } from "./components/timeline.js";
import { aggregateAtHour } from "./lib/calc.js";
import { REGIONS } from "./lib/regions.js";
import { mountGlobe } from "./globe.js";

const cbeci = await FileAttachment("data/cbeci.json").json();
const ercot = await FileAttachment("data/ercot.json").json();
const caiso = await FileAttachment("data/caiso.json").json();
const entsoe = await FileAttachment("data/entsoe.json").json();
const statics = await FileAttachment("data/statics.json").json();
const anchor = await FileAttachment("data/anchor.json").json();
const northSea = await FileAttachment("data/north-sea.json").json();
const brazilNE = await FileAttachment("data/brazil-ne.json").json();

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
      <div class="timeline-controls" id="timeline-controls"></div>
    </div>

    <footer class="app-footer">
      <p class="caption" id="caption-copy">Hashrate: mempool.space. Live grid data: EIA, ENTSO-E, Elexon BMRS, ONS. Static: Ember, GGFR. Refreshed: <span id="refreshed-at">—</span>.</p>
    </footer>
  </div>
`;

const regionData = {
  ercot,
  caiso,
  germany: entsoe.germany,
  iberia: entsoe.iberia,
  finland: entsoe.finland,
  "north-sea": northSea,
  "brazil-ne": brazilNE,
  ...statics
};

document.getElementById("lead-copy").textContent = `of today's Bitcoin network, powered entirely by energy observed curtailed, spilled, or flared in the last 30 days. Visible tracked floor: ${anchor.globalCurtailmentTWh.toFixed(0)} TWh annually.`;
document.getElementById("refreshed-at").textContent = cbeci.lastUpdated;

const now = new Date();
const initialHour = now.getUTCHours() + now.getUTCMinutes() / 60;
const clock = createClock(initialHour);

function renderAt(hour) {
  const utcHour = Math.floor(hour % 24);
  const result = aggregateAtHour(regionData, cbeci, utcHour);
  const hh = String(utcHour).padStart(2, "0");
  const mm = String(Math.floor((hour % 1) * 60)).padStart(2, "0");

  document.getElementById("pct-readout").textContent = `${result.pctOfNetwork.toFixed(2)}%`;
  document.getElementById("hashrate-readout").innerHTML = `${cbeci.hashrateEHps.toFixed(1)} <span class="stat-unit">EH/s</span>`;
  document.getElementById("gw-readout").innerHTML = `${result.totalGW.toFixed(2)} <span class="stat-unit">GW</span>`;
  document.getElementById("supportable-readout").innerHTML = `${result.hashrateEHps.toFixed(1)} <span class="stat-unit">EH/s</span>`;
  document.getElementById("hotspots-title").textContent = `Active hotspots · UTC ${hh}:${mm}`;

  const ranked = REGIONS
    .map((region) => ({ region, gw: regionData[region.id]?.profile?.[utcHour] ?? 0 }))
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

mountTimeline(document.getElementById("timeline-canvas"), { regionData, cbeci, clock });
mountControls(document.getElementById("timeline-controls"), clock);

const globe = await mountGlobe(canvas, { regions: REGIONS, regionData, utcHour: initialHour });
canvas.hidden = false;
document.getElementById("globe-placeholder")?.remove();

clock.subscribe((hour) => globe.update({ utcHour: hour }));
clock.subscribe(renderAt);
```
