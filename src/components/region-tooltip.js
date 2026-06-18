import { regionGWAtHour } from "../lib/calc.js";
import { getFuelColor, FUEL_LABEL, dominantFuel, getRegionFuelColor } from "../lib/fuel.js";

/**
 * Floating detail card anchored to a globe click. Shows region identity,
 * live-updating "now" GW, 24h peak, 30d TWh, fuel, source link, and a
 * 24-hour sparkline. For co-located multi-fuel groups (e.g. wind + solar
 * at the same site) a stacked area chart is drawn instead.
 *
 * API:
 *   const tooltip = mountRegionTooltip({ clock, regionData, getMode, regions });
 *   tooltip.show(regionOrGroup, { clientX, clientY });
 *   tooltip.hide();
 *
 * `regionOrGroup` is either a single Region object or an array of Regions
 * sharing the same lat/lon (stacked composite pillar).
 */
export function mountRegionTooltip({ clock, regionData, getMode, regions }) {
  const el = document.createElement("div");
  el.className = "region-tooltip";
  el.hidden = true;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Region detail");
  document.body.appendChild(el);

  // currentGroup is always an array (1+ regions).
  let currentGroup = null;
  let clockSub = null;

  function fuelOf(region) {
    return dominantFuel(region, regionData[region.id]);
  }

  function colorFor(region) {
    return getRegionFuelColor(region, regionData[region.id]);
  }

  function fuelLabel(region) {
    return FUEL_LABEL[dominantFuel(region, regionData[region.id])];
  }

  /**
   * Draw a stacked area chart for a group of regions. Each member gets its
   * own color band, stacked bottom-to-top in descending-average-GW order.
   */
  function drawStackedSparkline(canvas, group) {
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
    const pad = 2;
    const plotW = w - pad * 2;
    const plotH = h - pad * 2;

    // Build per-hour stacked totals for each member.
    const members = group.map((r) => ({
      region: r,
      profile: (regionData[r.id]?.profile ?? new Array(24).fill(0)),
      color: colorFor(r),
    }));

    // Compute combined profile for y-axis scaling.
    const combined = new Array(24).fill(0);
    for (const m of members) {
      for (let i = 0; i < 24; i++) combined[i] += (m.profile[i] ?? 0);
    }
    const maxG = Math.max(0.01, ...combined);

    // Draw bands from bottom up (sorted largest-first so the biggest fuel
    // is closest to the baseline — easier to compare).
    const avgGW = (p) => p.reduce((s, v) => s + v, 0) / p.length;
    const sorted = [...members].sort((a, b) => avgGW(b.profile) - avgGW(a.profile));

    // Stack: accumulate baselines per hour.
    const baseline = new Array(24).fill(0);
    for (const m of sorted) {
      const color = m.color;
      // Fill band.
      const fillGrad = ctx.createLinearGradient(0, pad, 0, h - pad);
      fillGrad.addColorStop(0, color + "cc");
      fillGrad.addColorStop(1, color + "44");
      ctx.fillStyle = fillGrad;
      ctx.beginPath();
      // Bottom edge (current baseline)
      for (let i = 0; i < 24; i++) {
        const x = pad + (i / 23) * plotW;
        const yBase = pad + plotH - (baseline[i] / maxG) * plotH;
        if (i === 0) ctx.moveTo(x, yBase);
        else ctx.lineTo(x, yBase);
      }
      // Top edge (baseline + this member)
      for (let i = 23; i >= 0; i--) {
        const x = pad + (i / 23) * plotW;
        const yTop = pad + plotH - ((baseline[i] + (m.profile[i] ?? 0)) / maxG) * plotH;
        ctx.lineTo(x, yTop);
      }
      ctx.closePath();
      ctx.fill();
      // Stroke along top edge.
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 24; i++) {
        const x = pad + (i / 23) * plotW;
        const yTop = pad + plotH - ((baseline[i] + (m.profile[i] ?? 0)) / maxG) * plotH;
        if (i === 0) ctx.moveTo(x, yTop);
        else ctx.lineTo(x, yTop);
      }
      ctx.stroke();
      // Advance baseline.
      for (let i = 0; i < 24; i++) baseline[i] += (m.profile[i] ?? 0);
    }

    // Current-hour dot on top of the stack, coloured by the dominant
    // fuel band (sorted[0] is the largest band).
    const hourNow = ((clock.hour % 24) + 24) % 24;
    const cx = pad + (hourNow / 23) * plotW;
    const interpIdx = Math.floor(hourNow) % 24;
    const t = hourNow - Math.floor(hourNow);
    const interpGW = (combined[interpIdx] ?? 0) * (1 - t) + (combined[(interpIdx + 1) % 24] ?? 0) * t;
    const cy = pad + plotH - (interpGW / maxG) * plotH;
    ctx.fillStyle = sorted[0]?.color ?? getFuelColor("solar");
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
    const region = currentGroup?.[0];
    const color = region ? colorFor(region) : "#14afac";
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
    // Current-hour dot, coloured by the region's own dominant fuel.
    const hourNow = ((clock.hour % 24) + 24) % 24;
    const cx = pad + (hourNow / 23) * plotW;
    const interpIdx = Math.floor(hourNow) % 24;
    const t = hourNow - Math.floor(hourNow);
    const interpGW = (profile[interpIdx] ?? 0) * (1 - t) + (profile[(interpIdx + 1) % 24] ?? 0) * t;
    const cy = pad + plotH - (interpGW / maxG) * plotH;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function updateLive() {
    if (!currentGroup) return;
    const mode = getMode?.() ?? "avg30d";
    const canvas = el.querySelector("canvas.region-tooltip-sparkline");

    if (currentGroup.length > 1) {
      // Multi-fuel group: sum GW across all members.
      const nowGW = currentGroup.reduce((s, r) => {
        const d = regionData[r.id];
        return s + (d ? regionGWAtHour(d, clock.hour, mode) : 0);
      }, 0);
      const nowEl = el.querySelector("[data-now]");
      if (nowEl) nowEl.textContent = `${nowGW.toFixed(2)} GW`;
      drawStackedSparkline(canvas, currentGroup);
    } else {
      const region = currentGroup[0];
      const data = regionData[region.id];
      if (!data) return;
      const nowGW = regionGWAtHour(data, clock.hour, mode);
      const nowEl = el.querySelector("[data-now]");
      if (nowEl) nowEl.textContent = `${nowGW.toFixed(2)} GW`;
      drawSparkline(canvas, data);
    }
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
    return `${Math.floor(ageSec / 86400)}d ago`;
  }

  // Vintage label for non-live tiers. Prefers the YYYY-like prefix of
  // `lastUpdated` (e.g. "2024", "2024-Q1", or an ISO string) so the badge
  // tells the reader the data year without misrepresenting it as a fresh fetch.
  function vintageLabel(data) {
    const raw = data?.lastUpdated;
    if (typeof raw === "string" && raw.length >= 4) {
      const yearMatch = raw.match(/^(\d{4})/);
      if (yearMatch) return yearMatch[1];
    }
    return null;
  }

  // Tier-aware freshness badge.
  //   live / live-*-anchored → live/cached/degraded · Xs/m/h/d ago (real fetch state)
  //   anchored               → "anchored · YYYY" or "anchored baseload"  (T2)
  //   estimated              → "modeled · YYYY" or just "modeled"        (T3)
  // T2/T3 regions don't run live fetches, so "lastSuccessAt 2024-01-01"
  // is the data vintage — surfacing "861d ago" misleads the reader into
  // thinking the live feed is broken. See PR for context.
  function freshnessBadge(region, data) {
    if (!region) return "";
    const tier = region.tier;
    const isLiveTier = tier === "live" || tier === "live-domestic-anchored" || tier === "live-neighbour-anchored";

    if (!isLiveTier) {
      // T2-anchored or T3-estimated: render a non-misleading "modeled" badge.
      const kind = tier === "anchored" ? "anchored" : "modeled";
      const klass = `region-tooltip-freshness-${kind}`;
      const vintage = vintageLabel(data);
      const labelText = vintage
        ? `${kind} · ${vintage}`
        : kind;
      const titleAttr = `tier=${tier}; lastUpdated=${data?.lastUpdated ?? "?"}`;
      return `<span class="${klass}" title="${titleAttr}">◆ ${labelText}</span>`;
    }

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

  function show(regionOrGroup, anchor) {
    // Normalise to always-array.
    currentGroup = Array.isArray(regionOrGroup) ? regionOrGroup : [regionOrGroup];
    const mode = getMode?.() ?? "avg30d";

    if (currentGroup.length > 1) {
      // Composite multi-fuel pillar: aggregate stats across all members.
      const rep = currentGroup[0];
      const nowGW = currentGroup.reduce((s, r) => {
        const d = regionData[r.id];
        return s + (d ? regionGWAtHour(d, clock.hour, mode) : 0);
      }, 0);
      const peakGW = currentGroup.reduce((s, r) => s + (regionData[r.id]?.peakGW ?? 0), 0);
      const totalTWh = currentGroup.reduce((s, r) => s + (regionData[r.id]?.totalTWh ?? 0), 0);
      // Build a legend row per fuel member.
      const fuelRows = currentGroup
        .map((r) => {
          const c = colorFor(r);
          const lbl = fuelLabel(r);
          return `<span class="region-tooltip-fuel-swatch" style="background:${c};"></span>${lbl}`;
        })
        .join(" · ");
      const anyData = currentGroup.find((r) => regionData[r.id]);
      const badge = anyData ? freshnessBadge(anyData, regionData[anyData.id]) : freshnessBadge(rep, null);

      el.innerHTML = `
        <button class="region-tooltip-close" aria-label="Close">&times;</button>
        <div class="region-tooltip-header">
          <div class="region-tooltip-titles">
            <span class="region-tooltip-name">${rep.name.replace(/ (Wind|Solar|Hydro)$/, "")}</span>
            <span class="region-tooltip-country">${rep.country} · ${fuelRows}</span>
          </div>
        </div>
        <div class="region-tooltip-stats">
          <div class="region-tooltip-stat"><span>Now (UTC)</span><span class="num-tabular" data-now>${nowGW.toFixed(2)} GW</span></div>
          <div class="region-tooltip-stat"><span>24h peak</span><span class="num-tabular">${peakGW.toFixed(2)} GW</span></div>
          <div class="region-tooltip-stat" title="Trailing 30-day cumulative energy"><span>30d total</span><span class="num-tabular">${totalTWh.toFixed(2)} TWh</span></div>
        </div>
        <canvas class="region-tooltip-sparkline" width="240" height="48" aria-label="24-hour curtailment profile"></canvas>
        <div class="region-tooltip-footer">
          ${rep.sourceUrl ? `<a href="${rep.sourceUrl}" target="_blank" rel="noopener noreferrer">${rep.source}</a>` : `<span>${rep.source ?? ""}</span>`}
          ${badge}
        </div>
      `;
      el.dataset.fuel = fuelOf(rep);
    } else {
      const region = currentGroup[0];
      const data = regionData[region.id];
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
          <div class="region-tooltip-stat" title="Trailing 30-day cumulative energy"><span>30d total</span><span class="num-tabular">${totalTWh.toFixed(2)} TWh</span></div>
        </div>
        <canvas class="region-tooltip-sparkline" width="240" height="48" aria-label="24-hour curtailment profile"></canvas>
        <div class="region-tooltip-footer">
          ${region.sourceUrl ? `<a href="${region.sourceUrl}" target="_blank" rel="noopener noreferrer">${region.source}</a>` : `<span>${region.source ?? ""}</span>`}
          ${freshnessBadge(region, data)}
        </div>
        ${sourceNote ? `<div class="region-tooltip-note" title="${sourceNote.replace(/"/g, "&quot;")}">${sourceNote.length > 110 ? sourceNote.slice(0, 108) + "…" : sourceNote}</div>` : ""}
      `;
      el.dataset.fuel = fuel;
    }

    el.hidden = false;
    positionAnchor(anchor);
    el.querySelector(".region-tooltip-close")?.addEventListener("click", hide, { once: true });
    requestAnimationFrame(() => updateLive());
    if (!clockSub) clockSub = clock.subscribe(() => updateLive());
  }

  function hide() {
    currentGroup = null;
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
