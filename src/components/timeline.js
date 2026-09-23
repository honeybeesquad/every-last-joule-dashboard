import { regionGWAtHour } from "../lib/calc.js";
import { FUEL_ORDER, FUEL_LABEL, fuelShareAtHour, getFuelColor } from "../lib/fuel.js";

const PAD = 14;
const SAMPLES_PER_HOUR = 4; // 96 samples across 24h for smooth curves

// Light (Almanac): three unstacked rows on one shared scale, so the fuels
// compare honestly (redesign plan 3.1; the handoff's drawSmallMultiples).
const ROW_H = 26;
const ROW_GAP = 8;
const TOP = 6; // room for the playhead's overhang

/** Catmull-Rom-style smooth path through points, as the reference draws. */
function smoothPath(ctx, pts) {
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    ctx.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
      p2[0], p2[1],
    );
  }
}

function hexA(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/**
 * Mount the 24-hour timeline for curtailed renewable energy by fuel, with a
 * movable marker at the clock's hour; scrubs on pointer interaction; loops
 * at UTC 24. Light mode draws small multiples, dark the stacked area.
 * `fuelsEl` (optional) gets one row per fuel with its GW at the clock's hour.
 */
export function mountTimeline(canvas, { regions, regionData, cbeci, clock, fuelsEl = null }) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const ctx = canvas.getContext("2d");
  let mode = "avg30d";
  const isLight = () => document.documentElement.getAttribute("data-theme") === "light";

  // Precompute per-region per-fuel share so the hot path does one lookup.
  // Loaders can emit a data-driven fuelShare (e.g. Brazil wind+solar split)
  // which takes precedence over the region's canonical kind.
  const shareTable = regions.map((r) => ({
    id: r.id,
    // Per hour, not once per region: the chart spans 24 hours, and a flat
    // annual share paints solar into the overnight hours.
    sharesAtHour: (h) => FUEL_ORDER.map((f) => fuelShareAtHour(r, f, h, regionData[r.id])),
  }));

  function seriesAt(hour) {
    // One GW value per fuel in FUEL_ORDER.
    const bucket = FUEL_ORDER.map(() => 0);
    for (const { id, sharesAtHour } of shareTable) {
      const d = regionData[id];
      if (!d) continue;
      const gw = regionGWAtHour(d, hour, mode);
      if (gw <= 0) continue;
      const shares = sharesAtHour(hour);
      for (let i = 0; i < FUEL_ORDER.length; i += 1) {
        if (shares[i] > 0) bucket[i] += gw * shares[i];
      }
    }
    return bucket;
  }

  // The 24-hour series only changes with the mode or the data, not the
  // clock, so it is built once per mode rather than on every frame.
  let samples = null;
  function buildSamples() {
    if (samples && samples.mode === mode) return samples;
    const n = 24 * SAMPLES_PER_HOUR;
    const series = FUEL_ORDER.map(() => new Array(n));
    let maxTotal = 1;
    let maxSingle = 0.01;
    for (let i = 0; i < n; i += 1) {
      const bucket = seriesAt(i / SAMPLES_PER_HOUR);
      let total = 0;
      for (let f = 0; f < FUEL_ORDER.length; f += 1) {
        series[f][i] = bucket[f];
        total += bucket[f];
        if (bucket[f] > maxSingle) maxSingle = bucket[f];
      }
      if (total > maxTotal) maxTotal = total;
    }
    samples = { mode, series, maxTotal, maxSingle, n };
    return samples;
  }

  // Fuel rows beside (light desktop) or above (narrow) the chart.
  let fuelValueEls = [];
  if (fuelsEl) {
    fuelsEl.innerHTML = FUEL_ORDER.map((fuel) => `
      <li class="timeline-fuel fuel-${fuel}">
        <span class="timeline-fuel-name"><span class="dot dot--${fuel}" aria-hidden="true"></span>${FUEL_LABEL[fuel]}</span>
        <span class="timeline-fuel-gw num-tabular">—</span>
      </li>`).join("");
    fuelValueEls = [...fuelsEl.querySelectorAll(".timeline-fuel-gw")];
  }

  // Canvas cannot read custom properties, so each paint reads the mode's
  // tokens once. Re-run on themechange (below), which is what makes the
  // chart follow the light/dark switch.
  function readTokens() {
    const cs = getComputedStyle(document.documentElement);
    const get = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
    return {
      rule: get("--hairline-strong", "rgba(128,128,128,0.5)"),
      label: get("--ink-soft", "rgba(128,128,128,0.8)"),
      ink: get("--ink", "rgb(128,128,128)"),
      inkRGB: get("--globe-ink-rgb", "128, 128, 128").replace(/\s+/g, ""),
      paper: get("--surface-bg-3", "rgb(128,128,128)"),
      mono: get("--font-mono", "ui-monospace, monospace"),
    };
  }

  /** Light: small multiples, full width, no horizontal padding. */
  function drawSmallMultiples(w, h, { series, maxSingle, n }, hourNow, tokens) {
    const k = ROW_H / maxSingle;
    const X = (i) => (i / n) * w;
    const bottom = TOP + 3 * ROW_H + 2 * ROW_GAP;
    for (let hh = 0; hh <= 24; hh += 3) {
      const x = Math.round((hh / 24) * (w - 1)) + 0.5;
      ctx.strokeStyle = `rgba(${tokens.inkRGB},${hh % 6 === 0 ? 0.28 : 0.1})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, TOP); ctx.lineTo(x, bottom); ctx.stroke();
    }
    const px = (hourNow / 24) * w;
    FUEL_ORDER.forEach((fuel, f) => {
      const color = getFuelColor(fuel);
      const base = TOP + f * (ROW_H + ROW_GAP) + ROW_H;
      const pts = series[f].map((v, j) => [X(j), base - v * k]);
      pts.push([w, base - series[f][0] * k]);
      ctx.beginPath(); smoothPath(ctx, pts); ctx.lineTo(w, base); ctx.lineTo(0, base); ctx.closePath();
      ctx.fillStyle = hexA(color, 0.16); ctx.fill();
      ctx.beginPath(); smoothPath(ctx, pts);
      ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.strokeStyle = `rgba(${tokens.inkRGB},0.35)`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, base + 0.5); ctx.lineTo(w, base + 0.5); ctx.stroke();
      const x = hourNow / 24 * n;
      const a = Math.floor(x) % n, t = x - Math.floor(x);
      const v = series[f][a] * (1 - t) + series[f][(a + 1) % n] * t;
      ctx.fillStyle = color; ctx.strokeStyle = tokens.paper; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(px, base - v * k, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
    ctx.strokeStyle = tokens.ink; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, bottom + 2); ctx.stroke();
  }

  /** Dark (until the dark redesign's ribbon): the stacked area. */
  function drawStacked(w, h, { series, maxTotal, n }, hourNow, tokens) {
    const plotW = w - PAD * 2;
    const plotH = h - PAD * 2;
    const baseY = h - PAD;
    const xAt = (hour) => PAD + (hour / 24) * plotW;
    const yForGW = (gw) => PAD + plotH - (gw / maxTotal) * plotH;
    // Running stack: cumulative[i] is the bottom edge (in GW) of the NEXT layer.
    const cumulative = new Array(n).fill(0);
    for (let f = 0; f < FUEL_ORDER.length; f += 1) {
      const colorHex = getFuelColor(FUEL_ORDER[f]);
      const grad = ctx.createLinearGradient(0, PAD, 0, baseY);
      grad.addColorStop(0, hexA(colorHex, 0.67));
      grad.addColorStop(1, hexA(colorHex, 0.13));
      ctx.fillStyle = grad;
      ctx.beginPath();
      for (let i = 0; i < n; i += 1) {
        const x = xAt(i / SAMPLES_PER_HOUR);
        const y = yForGW(cumulative[i] + series[f][i]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      for (let i = n - 1; i >= 0; i -= 1) ctx.lineTo(xAt(i / SAMPLES_PER_HOUR), yForGW(cumulative[i]));
      ctx.closePath();
      ctx.fill();
      for (let i = 0; i < n; i += 1) cumulative[i] += series[f][i];
    }
    // Crisp stroke on the total top line for definition.
    ctx.strokeStyle = tokens.rule;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < n; i += 1) {
      const x = xAt(i / SAMPLES_PER_HOUR);
      const y = yForGW(cumulative[i]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Hour ticks.
    ctx.fillStyle = tokens.label;
    ctx.font = `10px ${tokens.mono}`;
    ctx.textAlign = "center";
    for (const hr of [0, 6, 12, 18]) {
      const x = xAt(hr);
      ctx.fillRect(x - 0.5, h - PAD + 1, 1, 4);
      ctx.fillText(`${String(hr).padStart(2, "0")}`, x, h - PAD + 14);
    }
    // The playhead is ink in both modes (amber was 2.0:1 on paper).
    const totalNow = seriesAt(hourNow).reduce((s, v) => s + v, 0);
    const cx = xAt(hourNow);
    ctx.strokeStyle = tokens.ink;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(cx, PAD); ctx.lineTo(cx, h - PAD); ctx.stroke();
    ctx.fillStyle = tokens.ink;
    ctx.beginPath(); ctx.arc(cx, yForGW(totalNow), 4.5, 0, Math.PI * 2); ctx.fill();
  }

  function render() {
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const hourNow = ((clock.hour % 24) + 24) % 24;
    if (fuelValueEls.length) {
      const now = seriesAt(hourNow);
      fuelValueEls.forEach((el, f) => { el.textContent = `${now[f].toFixed(1)} GW`; });
    }
    if (!w || !h) return;
    const s = buildSamples();
    const tokens = readTokens();
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    if (isLight()) drawSmallMultiples(w, h, s, hourNow, tokens);
    else drawStacked(w, h, s, hourNow, tokens);
    ctx.restore();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    render();
  }

  function scrubFromPointer(event) {
    const rect = canvas.getBoundingClientRect();
    const inset = isLight() ? 0 : PAD;
    const plotWidth = Math.max(1, rect.width - inset * 2);
    const x = Math.max(0, Math.min(plotWidth, event.clientX - rect.left - inset));
    const hour = (x / plotWidth) * 24;
    clock.pause();
    clock.scrub(hour % 24);
  }

  resize();
  new ResizeObserver(resize).observe(canvas);

  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId);
    scrubFromPointer(event);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (event.buttons) scrubFromPointer(event);
  });
  canvas.style.cursor = "ew-resize";

  clock.subscribe(() => render());
  render();

  function onThemeChange() { render(); }
  window.addEventListener("themechange", onThemeChange);

  return {
    update(next = {}) {
      if (next.mode) mode = next.mode;
      render();
    },
    destroy() {
      window.removeEventListener("themechange", onThemeChange);
    },
  };
}
