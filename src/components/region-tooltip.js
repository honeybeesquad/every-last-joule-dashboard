import { regionGWAtHour } from "../lib/calc.js";
import { getFuelColor, FUEL_LABEL, dominantFuel } from "../lib/fuel.js";

/**
 * Floating detail card anchored to a globe click. Shows region identity,
 * live-updating "now" GW, 24h peak, 30d TWh, fuel, source link, and a
 * 24-hour sparkline. Live-subscribes to the clock so the "now" number
 * tweens as playback advances.
 *
 * API:
 *   const tooltip = mountRegionTooltip({ clock, regionData, getMode, regions });
 *   tooltip.show(region, { clientX, clientY });
 *   tooltip.hide();
 */
export function mountRegionTooltip({ clock, regionData, getMode, regions }) {
  const el = document.createElement("div");
  el.className = "region-tooltip";
  el.hidden = true;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Region detail");
  document.body.appendChild(el);

  let currentRegion = null;
  let clockSub = null;

  function fuelOf(region) {
    if (region.kind === "flare") return "flare";
    return dominantFuel(region, regionData[region.id]);
  }

  function colorFor(region) {
    if (region.kind === "flare") return getFuelColor("flare");
    return getFuelColor(dominantFuel(region, regionData[region.id]));
  }

  function fuelLabel(region) {
    if (region.kind === "flare") return "Flared gas";
    return FUEL_LABEL[dominantFuel(region, regionData[region.id])];
  }

  function drawSparkline(canvas, data) {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    const w = rect.width;
    const h = rect.height;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    const profile = data?.profile ?? [];
    if (!profile.length) { ctx.restore(); return; }
    const maxG = Math.max(0.01, ...profile);
    const pad = 2;
    const plotW = w - pad * 2;
    const plotH = h - pad * 2;
    const color = currentRegion ? colorFor(currentRegion) : "#14afac";
    // Fill
    const grad = ctx.createLinearGradient(0, pad, 0, h - pad);
    grad.addColorStop(0, color + "aa");
    grad.addColorStop(1, color + "22");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(pad, h - pad);
    for (let i = 0; i < 24; i++) {
      const x = pad + (i / 23) * plotW;
      const y = pad + plotH - (profile[i] / maxG) * plotH;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(pad + plotW, h - pad);
    ctx.closePath();
    ctx.fill();
    // Stroke
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const x = pad + (i / 23) * plotW;
      const y = pad + plotH - (profile[i] / maxG) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Current-hour dot
    const hourNow = ((clock.hour % 24) + 24) % 24;
    const cx = pad + (hourNow / 23) * plotW;
    const interpIdx = Math.floor(hourNow) % 24;
    const t = hourNow - Math.floor(hourNow);
    const interpGW = (profile[interpIdx] ?? 0) * (1 - t) + (profile[(interpIdx + 1) % 24] ?? 0) * t;
    const cy = pad + plotH - (interpGW / maxG) * plotH;
    ctx.fillStyle = getFuelColor("flare");
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function updateLive() {
    if (!currentRegion) return;
    const data = regionData[currentRegion.id];
    if (!data) return;
    const mode = getMode?.() ?? "avg30d";
    const nowGW = regionGWAtHour(data, clock.hour, mode);
    const nowEl = el.querySelector("[data-now]");
    if (nowEl) nowEl.textContent = `${nowGW.toFixed(2)} GW`;
    const canvas = el.querySelector("canvas.region-tooltip-sparkline");
    drawSparkline(canvas, data);
  }

  function positionAnchor(anchor) {
    if (!anchor) {
      el.style.left = `${window.innerWidth / 2 - 130}px`;
      el.style.top  = `${window.innerHeight / 2 - 80}px`;
      return;
    }
    const { clientX, clientY } = anchor;
    const margin = 14;
    const w = 260;
    const h = 180;
    // Prefer right of cursor; flip left if too close to right edge.
    let x = clientX + margin;
    if (x + w > window.innerWidth - 8) x = clientX - margin - w;
    x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
    // Prefer slightly above cursor.
    let y = clientY - h / 2;
    y = Math.max(8, Math.min(y, window.innerHeight - h - 8));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  function formatAge(iso) {
    if (!iso) return "unknown";
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return iso.slice(0, 10);
    const ageSec = Math.max(0, (Date.now() - then) / 1000);
    if (ageSec < 60) return `${Math.floor(ageSec)}s ago`;
    if (ageSec < 3600) return `${Math.floor(ageSec / 60)}m ago`;
    if (ageSec < 86400) return `${Math.floor(ageSec / 3600)}h ago`;
    if (ageSec < 86400 * 7) return `${Math.floor(ageSec / 86400)}d ago`;
    return `${Math.floor(ageSec / 86400)}d ago`;
  }

  function freshnessBadge(data) {
    if (!data) return "";
    const status = data.sourceStatus === "degraded"
      ? "degraded"
      : data.sourceStatus === "cached"
        ? "cached"
        : "live";
    const age = formatAge(data.lastSuccessAt ?? data.lastUpdated);
    const klass = `region-tooltip-freshness-${status}`;
    const icon = status === "live" ? "●" : "⚠";
    const label = status === "live" ? `live · ${age}` : `${status} · ${age}`;
    return `<span class="${klass}" title="sourceStatus=${status}; lastSuccessAt=${data.lastSuccessAt ?? "?"}; lastUpdated=${data.lastUpdated ?? "?"}">${icon} ${label}</span>`;
  }

  function show(region, anchor) {
    currentRegion = region;
    const data = regionData[region.id];
    const mode = getMode?.() ?? "avg30d";
    const nowGW = data ? regionGWAtHour(data, clock.hour, mode) : 0;
    const peakGW = data?.peakGW ?? 0;
    const totalTWh = data?.totalTWh ?? 0;
    const sourceNote = data?.sourceNote ?? "";
    const color = colorFor(region);
    const label = fuelLabel(region);
    const fuel = fuelOf(region);

    el.innerHTML = `
      <button class="region-tooltip-close" aria-label="Close">&times;</button>
      <div class="region-tooltip-header">
        <span class="dot" style="background:${color};box-shadow:0 0 10px ${color}66;"></span>
        <div class="region-tooltip-titles">
          <span class="region-tooltip-name">${region.name}</span>
          <span class="region-tooltip-country">${region.country} · ${label}</span>
        </div>
      </div>
      <div class="region-tooltip-stats">
        <div class="region-tooltip-stat"><span>Now (UTC)</span><span class="num-tabular" data-now>${nowGW.toFixed(2)} GW</span></div>
        <div class="region-tooltip-stat"><span>24h peak</span><span class="num-tabular">${peakGW.toFixed(2)} GW</span></div>
        <div class="region-tooltip-stat"><span>30d total</span><span class="num-tabular">${totalTWh.toFixed(2)} TWh</span></div>
      </div>
      <canvas class="region-tooltip-sparkline" width="240" height="48" aria-label="24-hour curtailment profile"></canvas>
      <div class="region-tooltip-footer">
        ${region.sourceUrl ? `<a href="${region.sourceUrl}" target="_blank" rel="noopener noreferrer">${region.source}</a>` : `<span>${region.source ?? ""}</span>`}
        ${freshnessBadge(data)}
      </div>
      ${sourceNote ? `<div class="region-tooltip-note" title="${sourceNote.replace(/"/g, "&quot;")}">${sourceNote.length > 110 ? sourceNote.slice(0, 108) + "…" : sourceNote}</div>` : ""}
    `;
    el.dataset.fuel = fuel;
    el.hidden = false;
    positionAnchor(anchor);
    // Wire close button
    el.querySelector(".region-tooltip-close")?.addEventListener("click", hide, { once: true });
    // Draw sparkline after DOM paints to pick up correct canvas dimensions
    requestAnimationFrame(() => updateLive());
    // Subscribe to clock if not already
    if (!clockSub) clockSub = clock.subscribe(() => updateLive());
  }

  function hide() {
    currentRegion = null;
    el.hidden = true;
    if (clockSub) { clockSub(); clockSub = null; }
  }

  // Dismiss on Escape or click outside
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !el.hidden) hide();
  });
  document.addEventListener("pointerdown", (e) => {
    if (el.hidden) return;
    if (el.contains(e.target)) return;
    const canvas = document.getElementById("globe-canvas");
    // The globe canvas handles its own click-to-show; don't double-dismiss if
    // the user is clicking inside the canvas (that will trigger show() or
    // show(null) which replaces/clears current region separately).
    if (canvas && canvas.contains(e.target)) return;
    // The theme toggle should not dismiss the tooltip — instead the
    // themechange listener below re-paints the open tooltip with the new
    // theme's tokens, which is the spec's intended behaviour.
    if (e.target.closest && e.target.closest(".theme-toggle")) return;
    hide();
  }, true);

  function onThemeChange() {
    if (!el.hidden) updateLive();   // re-paints the sparkline with new fuel colour
  }
  window.addEventListener("themechange", onThemeChange);

  return { show, hide, element: el };
}
