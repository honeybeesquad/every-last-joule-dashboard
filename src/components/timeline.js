import { regionGWAtHour } from "../lib/calc.js";
import { FUEL_ORDER, fuelShare, getFuelColor } from "../lib/fuel.js";

const PAD = 14;
const SAMPLES_PER_HOUR = 4; // 96 samples across 24h for smooth area curves

/**
 * Mount a stacked-area timeline canvas showing curtailed renewable energy
 * split into four fuel buckets (solar / wind / hydro / other) across a
 * 24-hour cycle. Flared gas is deliberately excluded — it is continuous
 * base-load and would flatten the diurnal peakiness. Draws a movable
 * marker at the clock's current hour; scrubs on pointer interaction;
 * loops cleanly at UTC 24.
 */
export function mountTimeline(canvas, { regions, regionData, cbeci, clock }) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const ctx = canvas.getContext("2d");
  let mode = "avg30d";

  // Precompute per-region per-fuel share so the hot path does one lookup.
  // Loaders can emit a data-driven fuelShare (e.g. Brazil wind+solar split)
  // which takes precedence over the region's canonical kind.
  const shareTable = regions.map((r) => ({
    id: r.id,
    shares: FUEL_ORDER.map((f) => fuelShare(r, f, regionData[r.id])),
  }));

  function seriesAt(hour) {
    // Array of 4 GW values: [solar, wind, hydro, other].
    const bucket = [0, 0, 0, 0];
    for (const { id, shares } of shareTable) {
      const d = regionData[id];
      if (!d) continue;
      const gw = regionGWAtHour(d, hour, mode);
      if (gw <= 0) continue;
      for (let i = 0; i < 4; i += 1) {
        if (shares[i] > 0) bucket[i] += gw * shares[i];
      }
    }
    return bucket;
  }

  function buildSamples() {
    const n = 24 * SAMPLES_PER_HOUR;
    // 4 series × n samples.
    const series = [new Array(n), new Array(n), new Array(n), new Array(n)];
    let maxTotal = 1;
    for (let i = 0; i < n; i += 1) {
      const hour = i / SAMPLES_PER_HOUR;
      const bucket = seriesAt(hour);
      let total = 0;
      for (let f = 0; f < 4; f += 1) {
        series[f][i] = bucket[f];
        total += bucket[f];
      }
      if (total > maxTotal) maxTotal = total;
    }
    return { series, maxTotal };
  }

  function xAt(hour, plotW) {
    return PAD + (hour / 24) * plotW;
  }

  function render() {
    const { series, maxTotal } = buildSamples();
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    if (!w || !h) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const plotW = w - PAD * 2;
    const plotH = h - PAD * 2;
    const baseY = h - PAD;
    const yForGW = (gw) => PAD + plotH - (gw / maxTotal) * plotH;
    const n = series[0].length;

    // Running stack: cumulative[i] is the bottom edge (in GW) of the NEXT layer.
    const cumulative = new Array(n).fill(0);

    for (let f = 0; f < FUEL_ORDER.length; f += 1) {
      const fuel = FUEL_ORDER[f];
      const colorHex = getFuelColor(fuel);
      const grad = ctx.createLinearGradient(0, PAD, 0, baseY);
      grad.addColorStop(0, colorHex + "aa"); // ~67% alpha at top
      grad.addColorStop(1, colorHex + "22"); // ~13% at bottom
      ctx.fillStyle = grad;
      ctx.beginPath();
      // Top edge: cumulative + layer (walking forward)
      for (let i = 0; i < n; i += 1) {
        const hour = i / SAMPLES_PER_HOUR;
        const top = cumulative[i] + series[f][i];
        const x = xAt(hour, plotW);
        const y = yForGW(top);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      // Bottom edge: cumulative only (walking back)
      for (let i = n - 1; i >= 0; i -= 1) {
        const hour = i / SAMPLES_PER_HOUR;
        ctx.lineTo(xAt(hour, plotW), yForGW(cumulative[i]));
      }
      ctx.closePath();
      ctx.fill();

      // Advance running stack.
      for (let i = 0; i < n; i += 1) cumulative[i] += series[f][i];
    }

    // Crisp stroke on the total top line for definition.
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--hairline-strong").trim() || "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < n; i += 1) {
      const hour = i / SAMPLES_PER_HOUR;
      const x = xAt(hour, plotW);
      const y = yForGW(cumulative[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // --- Hour ticks ---
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = '10px "Gotham", system-ui, sans-serif';
    ctx.textAlign = "center";
    for (const hr of [0, 6, 12, 18]) {
      const x = xAt(hr, plotW);
      ctx.fillRect(x - 0.5, h - PAD + 1, 1, 4);
      ctx.fillText(`${String(hr).padStart(2, "0")}`, x, h - PAD + 14);
    }

    // --- Current-hour marker (uses interpolated total at the fractional hour) ---
    const hourNow = ((clock.hour % 24) + 24) % 24;
    const bucketNow = seriesAt(hourNow);
    const totalNow = bucketNow[0] + bucketNow[1] + bucketNow[2] + bucketNow[3];
    const cx = xAt(hourNow, plotW);
    const cy = yForGW(totalNow);
    ctx.strokeStyle = getFuelColor("flare");
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx, PAD);
    ctx.lineTo(cx, h - PAD);
    ctx.stroke();
    ctx.fillStyle = getFuelColor("flare");
    ctx.beginPath();
    ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
    ctx.fill();

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
    const plotWidth = Math.max(1, rect.width - PAD * 2);
    const x = Math.max(0, Math.min(plotWidth, event.clientX - rect.left - PAD));
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
