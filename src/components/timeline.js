import { regionGWAtHour } from "../lib/calc.js";

const PAD = 14;
const SAMPLES_PER_HOUR = 4; // 96 samples across 24h for smooth area curves

/**
 * Mount a stacked-area timeline canvas showing flare (orange, baseline) +
 * renewable curtailment (teal, stacked on top) over a 24-hour cycle.
 * Draws a movable marker at the clock's current hour; scrubs the clock on
 * pointer interaction; loops cleanly at UTC 24.
 */
export function mountTimeline(canvas, { regions, regionData, cbeci, clock }) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const ctx = canvas.getContext("2d");
  let mode = "avg30d";

  // Partition region IDs into flare vs renewable so we can sum each series.
  const flareIds = regions.filter((r) => r.kind === "flare").map((r) => r.id);
  const renewableIds = regions.filter((r) => r.kind !== "flare").map((r) => r.id);

  function seriesAt(hour) {
    let flare = 0;
    let renewable = 0;
    for (const id of flareIds) {
      const d = regionData[id];
      if (d) flare += regionGWAtHour(d, hour, mode);
    }
    for (const id of renewableIds) {
      const d = regionData[id];
      if (d) renewable += regionGWAtHour(d, hour, mode);
    }
    return { flare, renewable, total: flare + renewable };
  }

  function buildSamples() {
    const n = 24 * SAMPLES_PER_HOUR;
    const flareArr = new Array(n);
    const renewableArr = new Array(n);
    let maxTotal = 1;
    for (let i = 0; i < n; i += 1) {
      const hour = (i / SAMPLES_PER_HOUR);
      const { flare, renewable, total } = seriesAt(hour);
      flareArr[i] = flare;
      renewableArr[i] = renewable;
      if (total > maxTotal) maxTotal = total;
    }
    return { flareArr, renewableArr, maxTotal };
  }

  function xAt(hour, plotW) {
    return PAD + (hour / 24) * plotW;
  }

  function render() {
    const { flareArr, renewableArr, maxTotal } = buildSamples();
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    if (!w || !h) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const plotW = w - PAD * 2;
    const plotH = h - PAD * 2;
    const yForGW = (gw) => PAD + plotH - (gw / maxTotal) * plotH;

    const n = flareArr.length;
    const baseY = h - PAD;

    // --- Flare baseline area (orange) ---
    const flareGrad = ctx.createLinearGradient(0, PAD, 0, baseY);
    flareGrad.addColorStop(0, "rgba(247, 147, 26, 0.55)");
    flareGrad.addColorStop(1, "rgba(247, 147, 26, 0.10)");
    ctx.fillStyle = flareGrad;
    ctx.beginPath();
    ctx.moveTo(PAD, baseY);
    for (let i = 0; i < n; i += 1) {
      const hour = i / SAMPLES_PER_HOUR;
      ctx.lineTo(xAt(hour, plotW), yForGW(flareArr[i]));
    }
    ctx.lineTo(PAD + plotW, baseY);
    ctx.closePath();
    ctx.fill();

    // --- Renewable stacked area (teal, on top of flare) ---
    const renewGrad = ctx.createLinearGradient(0, PAD, 0, baseY);
    renewGrad.addColorStop(0, "rgba(20, 175, 172, 0.60)");
    renewGrad.addColorStop(1, "rgba(20, 175, 172, 0.12)");
    ctx.fillStyle = renewGrad;
    ctx.beginPath();
    // top edge: total
    for (let i = 0; i < n; i += 1) {
      const hour = i / SAMPLES_PER_HOUR;
      const total = flareArr[i] + renewableArr[i];
      const x = xAt(hour, plotW);
      const y = yForGW(total);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    // bottom edge: flare (in reverse)
    for (let i = n - 1; i >= 0; i -= 1) {
      const hour = i / SAMPLES_PER_HOUR;
      ctx.lineTo(xAt(hour, plotW), yForGW(flareArr[i]));
    }
    ctx.closePath();
    ctx.fill();

    // Thin stroke on the total line for definition.
    ctx.strokeStyle = "rgba(63, 193, 190, 0.85)";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let i = 0; i < n; i += 1) {
      const hour = i / SAMPLES_PER_HOUR;
      const total = flareArr[i] + renewableArr[i];
      const x = xAt(hour, plotW);
      const y = yForGW(total);
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

    // --- Current-hour marker (uses fractional hour + interpolated total) ---
    const hourNow = ((clock.hour % 24) + 24) % 24;
    const { flare, renewable } = seriesAt(hourNow);
    const totalNow = flare + renewable;
    const cx = xAt(hourNow, plotW);
    const cy = yForGW(totalNow);
    ctx.strokeStyle = "#f7931a";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx, PAD);
    ctx.lineTo(cx, h - PAD);
    ctx.stroke();
    ctx.fillStyle = "#f7931a";
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

  return {
    update(next = {}) {
      if (next.mode) mode = next.mode;
      render();
    },
  };
}
