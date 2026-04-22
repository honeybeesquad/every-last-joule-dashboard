# Every Last Joule

```js
const cbeci = await FileAttachment("data/cbeci.json").json();
const ercot = await FileAttachment("data/ercot.json").json();
const caiso = await FileAttachment("data/caiso.json").json();
```

```js
import { aggregateAtHour } from "../lib/calc.js";

const regionData = { ercot, caiso };
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

<p class="caption" style="margin-top: 1.5rem;">Hashrate source: mempool.space. Texas curtailment: EIA hourly wind × 6.15% calibrated rate. Snapshot: ${cbeci.lastUpdated}. Full methodology in Week 6.</p>
