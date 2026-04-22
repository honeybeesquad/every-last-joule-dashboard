import { perHourAggregate } from "../lib/calc.js";

/**
 * Mount a 24h aggregate-GW timeline canvas. Shows the sparkline of
 * totalGW per UTC hour; draws a movable marker at the clock's current
 * hour; scrubs the clock on pointer interaction.
 */
export function mountTimeline(canvas, { regionData, cbeci, clock }) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const ctx = canvas.getContext("2d");
  const series = perHourAggregate(regionData, cbeci);
  const gw = series.map((row) => row.totalGW);
  const maxGW = Math.max(1, ...gw);

  function render() {
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    if (!w || !h) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const pad = 14;
    const plotW = w - pad * 2;
    const plotH = h - pad * 2;

    const grad = ctx.createLinearGradient(0, pad, 0, h - pad);
    grad.addColorStop(0, "rgba(20, 175, 172, 0.55)");
    grad.addColorStop(1, "rgba(20, 175, 172, 0.03)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(pad, h - pad);
    for (let i = 0; i < 24; i += 1) {
      const x = pad + (i / 23) * plotW;
      const y = pad + plotH - (gw[i] / maxGW) * plotH;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(pad + plotW, h - pad);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(63, 193, 190, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 24; i += 1) {
      const x = pad + (i / 23) * plotW;
      const y = pad + plotH - (gw[i] / maxGW) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = '10px "Gotham", system-ui, sans-serif';
    ctx.textAlign = "center";
    for (const hr of [0, 6, 12, 18]) {
      const x = pad + (hr / 23) * plotW;
      ctx.fillRect(x - 0.5, h - pad + 1, 1, 4);
      ctx.fillText(`${String(hr).padStart(2, "0")}`, x, h - pad + 14);
    }

    const hourNow = clock.hour;
    const cx = pad + (hourNow / 23) * plotW;
    const cy = pad + plotH - (gw[Math.floor(hourNow) % 24] / maxGW) * plotH;
    ctx.strokeStyle = "#f7931a";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx, pad);
    ctx.lineTo(cx, h - pad);
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
    const pad = 14;
    const plotWidth = Math.max(1, rect.width - pad * 2);
    const x = Math.max(0, Math.min(plotWidth, event.clientX - rect.left - pad));
    const hour = (x / plotWidth) * 23;
    clock.pause();
    clock.scrub(hour);
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
}
