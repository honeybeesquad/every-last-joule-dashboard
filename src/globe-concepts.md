# Globe brightness concepts

<div class="gc-page">

<header class="gc-header">
  <div class="gc-titles">
    <div class="eyebrow">Brand redesign · brightness concepts</div>
    <h1>Pick the globe's <span class="accent-word">brightness</span>.</h1>
    <p class="gc-lead">Four directions for the day-side gradient, land dots, and sphere base. The terminator (day/night line) and rotation behaviour are identical across all four — only the colour tokens change. Click a tab to apply that concept to the globe below.</p>
  </div>
</header>

<div class="gc-tabs" role="tablist" aria-label="Globe brightness concepts">
  <button class="tab active" data-concept="A" role="tab" aria-selected="true">A · Editorial sunrise</button>
  <button class="tab" data-concept="B" role="tab">B · Lime-lit grid</button>
  <button class="tab" data-concept="C" role="tab">C · Lit land</button>
  <button class="tab" data-concept="D" role="tab">D · Lifted ink</button>
</div>

<div class="gc-stage">
  <div class="gc-globe-wrap">
    <canvas id="gc-globe-canvas"></canvas>
  </div>

  <aside class="gc-meta">
    <div class="eyebrow" id="gc-current-label">Concept A · Editorial sunrise</div>
    <p class="gc-blurb" id="gc-current-blurb">Day-side gradient becomes warm amber/peach — real photons, not acid lime. Night stays inky. Land dots stay off-white. Doesn't conflict with the headline accent. The conservative choice.</p>
    <div class="gc-tokens" id="gc-current-tokens"></div>
  </aside>
</div>

</div>

```js
import { mountGlobe } from "./globe.js";

const countriesUrl = await FileAttachment("./data/countries-110m.json").url();

const canvas = document.getElementById("gc-globe-canvas");
const globe = await mountGlobe(canvas, {
  regions: [],
  regionData: {},
  utcHour: 12,
  mode: "avg30d",
  unitMode: "MW",
  topologyUrl: countriesUrl,
});

const CONCEPTS = {
  A: {
    label: "Concept A · Editorial sunrise",
    blurb: "Day-side gradient becomes warm amber/peach — real photons, not acid lime. Night stays inky. Land dots stay off-white. Doesn't conflict with the headline accent. The conservative choice.",
    tokens: {
      "--globe-dot-day":   "#F2F2F0",
      "--globe-dot-night": "rgba(242, 242, 240, 0.32)",
      "--globe-border":    "rgba(255, 184, 92, 0.35)",
      "--day-gradient-1":  "rgba(255, 184, 92, 0.38)",
      "--day-gradient-2":  "rgba(255, 145, 70, 0.16)",
      "--day-gradient-3":  "rgba(0, 0, 0, 0)",
      "--night-overlay":   "rgba(0, 0, 0, 0.55)",
      "--surface-bg-2":    "#0A0A0A",
    },
  },
  B: {
    label: "Concept B · Lime-lit grid",
    blurb: "The globe IS the accent moment — acid-lime day-side gradient at 45/20% alphas, bright border. Most on-brand, highest energy. Commits the page's single accent moment to the globe; the headline % would have to tone down.",
    tokens: {
      "--globe-dot-day":   "#F2F2F0",
      "--globe-dot-night": "rgba(242, 242, 240, 0.32)",
      "--globe-border":    "rgba(212, 255, 58, 0.62)",
      "--day-gradient-1":  "rgba(212, 255, 58, 0.45)",
      "--day-gradient-2":  "rgba(212, 255, 58, 0.20)",
      "--day-gradient-3":  "rgba(0, 0, 0, 0)",
      "--night-overlay":   "rgba(0, 0, 0, 0.55)",
      "--surface-bg-2":    "#0A0A0A",
    },
  },
  C: {
    label: "Concept C · Lit land",
    blurb: "Land dots themselves become acid lime — about 70% saturation. The dots, not the gradient, drive brightness. Reads as 'data points lighting up continents' — every megawatt-hour made visible. Subtle warm wash for day-side.",
    tokens: {
      "--globe-dot-day":   "#D4FF3A",
      "--globe-dot-night": "rgba(212, 255, 58, 0.28)",
      "--globe-border":    "rgba(212, 255, 58, 0.28)",
      "--day-gradient-1":  "rgba(255, 184, 92, 0.18)",
      "--day-gradient-2":  "rgba(255, 145, 70, 0.06)",
      "--day-gradient-3":  "rgba(0, 0, 0, 0)",
      "--night-overlay":   "rgba(0, 0, 0, 0.50)",
      "--surface-bg-2":    "#0A0A0A",
    },
  },
  D: {
    label: "Concept D · Lifted ink",
    blurb: "Minimal commitment — sphere base goes from near-black #060606 to surface #141414, day-gradient up to 35/15%, dots to pure white. The globe stops being a black hole and becomes a tangible sphere with dimensional lighting. No new colours.",
    tokens: {
      "--globe-dot-day":   "#FFFFFF",
      "--globe-dot-night": "rgba(255, 255, 255, 0.36)",
      "--globe-border":    "rgba(212, 255, 58, 0.42)",
      "--day-gradient-1":  "rgba(212, 255, 58, 0.35)",
      "--day-gradient-2":  "rgba(212, 255, 58, 0.15)",
      "--day-gradient-3":  "rgba(0, 0, 0, 0)",
      "--night-overlay":   "rgba(0, 0, 0, 0.40)",
      "--surface-bg-2":    "#141414",
    },
  },
};

function applyConcept(key) {
  const c = CONCEPTS[key];
  if (!c) return;
  const root = document.documentElement;
  for (const [name, value] of Object.entries(c.tokens)) {
    root.style.setProperty(name, value);
  }
  document.getElementById("gc-current-label").textContent = c.label;
  document.getElementById("gc-current-blurb").textContent = c.blurb;
  const tokenList = document.getElementById("gc-current-tokens");
  tokenList.innerHTML = Object.entries(c.tokens)
    .map(([k, v]) => `<div class="gc-token-row"><code class="gc-token-name">${k}</code><span class="gc-token-value">${v}</span></div>`)
    .join("");
  for (const btn of document.querySelectorAll(".gc-tabs .tab")) {
    const active = btn.dataset.concept === key;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  }
  window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: "ledger-" + key } }));
}

for (const btn of document.querySelectorAll(".gc-tabs .tab")) {
  btn.addEventListener("click", () => applyConcept(btn.dataset.concept));
}

applyConcept("A");
```

<style>
.gc-page {
  padding: 56px 40px 96px;
  max-width: 1280px;
  margin: 0 auto;
  color: var(--text);
}

.gc-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 36px;
  max-width: 760px;
}
.gc-header h1 {
  font-family: var(--font-sans);
  font-weight: 800;
  font-size: clamp(40px, 5vw, 72px);
  line-height: 0.95;
  letter-spacing: -0.045em;
  color: var(--text);
  margin: 12px 0 0;
  text-wrap: pretty;
}
.gc-lead {
  font-size: 15px;
  line-height: 1.55;
  color: var(--muted);
  margin: 16px 0 0;
  max-width: 64ch;
  text-wrap: pretty;
}

.gc-tabs {
  display: flex;
  gap: 8px;
  padding: 6px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-pill);
  width: fit-content;
  margin-bottom: 32px;
  flex-wrap: wrap;
}

.gc-stage {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 40px;
  align-items: start;
}
@media (max-width: 900px) {
  .gc-stage { grid-template-columns: 1fr; gap: 24px; }
}

.gc-globe-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  max-height: 640px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  overflow: hidden;
}
#gc-globe-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.gc-meta {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-top: 4px;
}
.gc-blurb {
  font-size: 14px;
  line-height: 1.55;
  color: var(--muted);
  margin: 0;
  text-wrap: pretty;
}
.gc-tokens {
  margin-top: 16px;
  padding: 16px 18px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.gc-token-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  align-items: baseline;
  font-family: var(--font-mono);
  font-size: 11px;
}
.gc-token-name { color: var(--accent); background: none; border: 0; padding: 0; }
.gc-token-value { color: var(--muted); white-space: nowrap; }
</style>
