# Every Last Joule

```js
const cbeci = await FileAttachment("data/cbeci.json").json();
```

<div class="eyebrow">Sustainable hashrate · unlocked (v0 preview)</div>

<div class="display-xl num-tabular">${cbeci.hashrateEHps.toFixed(1)} EH/s</div>

<p class="lead">Current Bitcoin network hashrate. Annualised consumption at 16 J/TH: ${cbeci.annualisedConsumptionTWh.toFixed(1)} TWh. Region loaders land in Week 1 Tasks 9-15.</p>

<p class="caption">Source: mempool.space. Refreshed: ${cbeci.lastUpdated}.</p>
