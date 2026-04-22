# Every Last Joule

```js
import { createElement } from "npm:react";
import { createRoot } from "npm:react-dom/client";
import Globe from "./components/Globe.jsx";

const cbeci = await FileAttachment("data/cbeci.json").json();
const ercot = await FileAttachment("data/ercot.json").json();
const caiso = await FileAttachment("data/caiso.json").json();
const entsoe = await FileAttachment("data/entsoe.json").json();
const statics = await FileAttachment("data/statics.json").json();
const anchor = await FileAttachment("data/anchor.json").json();
const northSea = await FileAttachment("data/north-sea.json").json();
const brazilNE = await FileAttachment("data/brazil-ne.json").json();
```

```js
import { aggregateAtHour } from "../lib/calc.js";
import { REGIONS } from "../lib/regions.js";

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
const utcHour = new Date().getUTCHours();
const result = aggregateAtHour(regionData, cbeci, utcHour);
```

<div class="eyebrow">Sustainable hashrate · unlocked (v0 preview)</div>

<div class="display-xl num-tabular">${result.pctOfNetwork.toFixed(2)}%</div>

<p class="lead">of today's Bitcoin network, powered entirely by energy observed curtailed, spilled, or flared across ${Object.keys(result.perRegionGW).length} region(s) in the last 30 days. A floor, not a ceiling - additional regions land through Weeks 2-3.</p>

<div style="display: flex; gap: 2rem; margin-top: 1rem;">
  <div>
    <div class="eyebrow micro">Network hashrate</div>
    <div class="num-tabular" style="font-size: 24px; font-weight: 700;">${cbeci.hashrateEHps.toFixed(1)} EH/s</div>
  </div>
  <div>
    <div class="eyebrow micro">Wasted now (UTC ${String(utcHour).padStart(2,'0')}:00)</div>
    <div class="num-tabular" style="font-size: 24px; font-weight: 700;">${result.totalGW.toFixed(2)} GW</div>
  </div>
  <div>
    <div class="eyebrow micro">At 16 J/TH supports</div>
    <div class="num-tabular" style="font-size: 24px; font-weight: 700;">${result.hashrateEHps.toFixed(1)} EH/s</div>
  </div>
</div>

<div id="globe-mount" style="width: 100%; max-width: 560px; aspect-ratio: 1; margin: 2rem auto;"></div>

```js
const mount = document.getElementById("globe-mount");
if (mount) {
  const now = new Date();
  const globeUtcHour = now.getUTCHours() + now.getUTCMinutes() / 60;
  createRoot(mount).render(
    createElement(Globe, {
      regions: REGIONS,
      regionData,
      utcHour: globeUtcHour,
      width: mount.clientWidth || 560,
      height: mount.clientWidth || 560
    })
  );
}
```

<p class="caption" style="margin-top: 1.5rem;">Hashrate source: mempool.space. Proxy methodology: EIA wind/solar and ENTSO-E generation × calibrated regional curtailment rates. Snapshot: ${cbeci.lastUpdated}. Full methodology in Week 6.</p>
