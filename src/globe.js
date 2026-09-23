import * as d3 from "npm:d3";
import * as topojson from "npm:topojson-client";
import { regionGWAtHour, generationGWAtHour } from "./lib/calc.js";
import { showsWastePillar, wasteStatusOf } from "./lib/waste-status.js";
import { getRegionFuelColor, getFuelColor, fuelShareAtHour } from "./lib/fuel.js";
import { readGlobeTokens } from "./lib/theme-tokens.js";
import { buildPillarUnits } from "./lib/pillar-layout.js";
import { qualityBucket, qualityOpacity, dotStyleFor } from "./lib/region-quality.js";
import { wrapLongitude, easeOutCubic } from "./lib/globe-geo.js";
import {
  FUELS, BAND_ALPHA, dayBand, dotHash, assignTerritory, DotCellIndex, barsForUnit, tintHex,
} from "./lib/globe-surface.js";

// Locally-vendored world atlas: previously fetched from unpkg.com, which
// added a third-party DNS + TLS handshake (~200–400ms on cellular) to
// every cold page load. Served from our own origin now via FileAttachment.
let countriesPromise;
const landDotsByStep = new Map();

async function loadCountries(topologyUrl) {
  if (!countriesPromise) {
    countriesPromise = fetch(topologyUrl)
      .then((response) => response.json())
      .then((topology) => topojson.feature(topology, topology.objects.countries));
  }
  return countriesPromise;
}

// The land matrix is the globe's only surface texture (the G1 "Lantern"
// look, after the GitHub homepage globe): a fine, hex-offset field of small
// dots. It is built from a raster land mask rather than d3.geoContains per
// point, which is what used to floor the pitch at 1.8deg - rasterising the
// atlas once and sampling it costs a few milliseconds at any pitch.
function gridStepFor(size) {
  if (size >= 820) return 1.05;
  if (size >= 560) return 1.2;
  return 1.6;
}

function precomputeLandDots(countries, step) {
  const key = step.toFixed(2);
  const cached = landDotsByStep.get(key);
  if (cached) return cached;
  const W = 2048, H = 1024;
  const mask = document.createElement("canvas");
  mask.width = W;
  mask.height = H;
  const mctx = mask.getContext("2d", { willReadFrequently: true });
  const eq = d3.geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]);
  mctx.beginPath();
  d3.geoPath(eq, mctx)({ type: "GeometryCollection", geometries: countries.features.map((f) => f.geometry) });
  // Offscreen mask: only the alpha channel is read back, so the colour is
  // irrelevant and the same in both modes.
  mctx.fillStyle = "#fff";
  mctx.fill();
  const px = mctx.getImageData(0, 0, W, H).data;
  const lons = [], lats = [];
  let row = 0;
  for (let lat = -58; lat <= 80; lat += step, row++) {
    const cos = Math.max(Math.cos((lat * Math.PI) / 180), 0.15);
    const lonStep = step / cos;
    for (let lon = -180 + (row % 2 ? lonStep / 2 : 0); lon < 180; lon += lonStep) {
      const x = Math.min(W - 1, Math.floor(((lon + 180) / 360) * W));
      const y = Math.min(H - 1, Math.floor(((90 - lat) / 180) * H));
      if (px[(y * W + x) * 4 + 3] > 127) {
        lons.push(lon);
        lats.push(lat);
      }
    }
  }
  const n = lons.length;
  const out = {
    n,
    lons: Float32Array.from(lons),
    lats: Float32Array.from(lats),
    hash: new Float32Array(n),
    xyz: new Float32Array(n * 3),
  };
  for (let i = 0; i < n; i++) {
    out.hash[i] = dotHash(lons[i], lats[i]);
    const la = (lats[i] * Math.PI) / 180, lo = (lons[i] * Math.PI) / 180;
    out.xyz[i * 3] = Math.cos(la) * Math.cos(lo);
    out.xyz[i * 3 + 1] = Math.cos(la) * Math.sin(lo);
    out.xyz[i * 3 + 2] = Math.sin(la);
  }
  out.cells = new DotCellIndex(out.lons, out.lats);
  landDotsByStep.set(key, out);
  return out;
}

function unitVec(lon, lat) {
  const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180;
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
}

export async function mountGlobe(canvas, initial) {
  const ctx = canvas.getContext("2d");
  const countries = await loadCountries(initial.topologyUrl);
  const mountSize = Math.min(canvas.clientWidth || 0, canvas.clientHeight || 0) || 720;
  const dots = precomputeLandDots(countries, gridStepFor(mountSize));
  // Cap DPR lower on narrow viewports — a 1.5x render on a 360px-wide
  // phone is visually indistinguishable from 2x but costs 45% fewer
  // pixels per frame to composite.
  const isMobileViewport = window.matchMedia?.("(max-width: 900px)")?.matches;
  const dprCap = isMobileViewport ? 1.5 : 2;
  const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  const onRegionClick = typeof initial.onRegionClick === "function" ? initial.onRegionClick : null;
  const state = {
    regions: initial.regions,
    regionData: initial.regionData,
    utcHour: initial.utcHour,
    mode: initial.mode ?? "avg30d",
    unitMode: initial.unitMode ?? "MW",
    rotation: [-10, -15, 0],
    dragging: false,
    zoomScale: 1.0,
    selectedRegionId: null,
  };

  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 4.0;

  function applyZoom(factor) {
    state.zoomScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, state.zoomScale * factor));
    // Pause auto-rotation while the user is zooming (same delay as after a drag).
    autoResumeAt = performance.now() + AUTO_RESUME_DELAY_MS;
    initial.onZoomChange?.(state.zoomScale);
    render();
  }

  let tokens = readGlobeTokens(document.documentElement);
  let fuelColor = {};
  let fuelTip = {};
  // Glow is a pre-rendered radial-gradient sprite per fuel, stamped with
  // drawImage. One gradient object per theme instead of two per pillar per
  // frame keeps ~450 glowing pillars inside the 30fps phone budget.
  let glowSprite = {};
  function makeGlow(hex) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const rgb = hex.replace("#", "").match(/../g).map((h) => parseInt(h, 16)).join(",");
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, `rgba(${rgb},0.34)`);
    grad.addColorStop(0.45, `rgba(${rgb},0.09)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return c;
  }
  function refreshFuelPaint() {
    for (const f of FUELS) {
      fuelColor[f] = getFuelColor(f);
      fuelTip[f] = tintHex(fuelColor[f], 0.55);
      glowSprite[f] = makeGlow(fuelColor[f]);
    }
  }
  refreshFuelPaint();

  function refreshTokens() {
    tokens = readGlobeTokens(document.documentElement);
    refreshFuelPaint();
    // Force a redraw so the next paint uses the new colours immediately.
    render();
  }

  window.addEventListener("themechange", refreshTokens);

  // --- Pillar unit cache ---
  // buildPillarUnits allocates a new Map + sorted arrays each call.
  // At 60fps that's GC pressure on every frame for no reason — the inputs
  // only change when state.regions is replaced.
  let _cachedPillarUnits = null;
  let _cachedRegionsRef = null;

  function buildPillarUnitsForState() {
    if (
      _cachedPillarUnits !== null &&
      _cachedRegionsRef === state.regions
    ) {
      return _cachedPillarUnits;
    }
    _cachedPillarUnits = buildPillarUnits(state.regions);
    _cachedRegionsRef = state.regions;
    return _cachedPillarUnits;
  }

  // --- Pillar birth animation ---
  // When a region rotates over the horizon into visibility it used to
  // snap into existence. Instead we track the first visible timestamp per
  // region and animate scale 0 → 1 over BIRTH_MS.
  const BIRTH_MS = 350;
  const pillarBirthTimes = new Map(); // repId → DOMHighResTimeStamp

  /**
   * Hit-test: given client coords, return the closest pillar group within
   * `threshold` pixels on the near hemisphere, or null.
   */
  function hitTestRegion(clientX, clientY, threshold = 20) {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const size = Math.min(width, height);
    if (!width || !height) return null;
    const projection = d3.geoOrthographic()
      .scale(size * 0.46 * state.zoomScale)
      .translate([width / 2, height / 2])
      .clipAngle(90)
      .rotate(state.rotation);
    const centerLngLat = [-state.rotation[0], -state.rotation[1]];
    const px = clientX - rect.left;
    const py = clientY - rect.top;

    const units = buildPillarUnitsForState();
    let bestUnit = null;
    let bestDist2 = threshold * threshold;
    for (const unit of units) {
      const rep = unit.regions[0];
      const dist = d3.geoDistance([rep.lon, rep.lat], centerLngLat);
      if (dist > Math.PI / 2) continue;
      const point = projection([rep.lon, rep.lat]);
      if (!point) continue;
      const targetX = point[0] + unit.offsetPx;
      const dx = targetX - px;
      const dy = point[1] - py;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist2) {
        bestDist2 = d2;
        bestUnit = unit;
      }
    }
    // Return single region for units of one; region array for stacked pillars.
    if (!bestUnit) return null;
    return bestUnit.regions.length === 1 ? bestUnit.regions[0] : bestUnit.regions;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    render();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  // Position the canvas-area absolute within .app-body so it spans precisely
  // from the header's bottom border to the timeline's top border, and across
  // the full content width. Uses direct style props (not CSS vars) because
  // position:absolute offsets are in the containing block's coordinate space.
  function syncGlobeRect() {
    if (window.innerWidth <= 900) return; // mobile: CSS flow handles it
    const header     = document.querySelector(".app-header");
    const timeline   = document.querySelector(".app-timeline");
    const appBody    = document.querySelector(".app-body");
    const canvasArea = canvas.closest(".globe-canvas-area");
    if (!header || !timeline || !appBody || !canvasArea) return;
    const bodyRect     = appBody.getBoundingClientRect();
    const headerBottom = header.getBoundingClientRect().bottom;
    const timelineTop  = timeline.getBoundingClientRect().top;
    const top    = Math.round(headerBottom - bodyRect.top);
    const height = Math.max(200, Math.round(timelineTop - headerBottom));
    canvasArea.style.top    = top    + "px";
    canvasArea.style.height = height + "px";
  }
  syncGlobeRect();
  window.addEventListener("resize", syncGlobeRect);

  // --- Lit territory cache ---
  // Which land dots glow in which fuel depends on every region's GW at the
  // current hour, not on rotation, so it is recomputed only when the hour
  // (to a quarter), the mode or the data changes - not every frame.
  let territory = null;
  let territoryKey = "";
  function territoryFor(hour) {
    const key = `${Math.round(hour * 4) / 4}|${state.mode}`;
    if (territory && key === territoryKey && territory.regions === state.regions && territory.regionData === state.regionData) {
      return territory.result;
    }
    const sources = [];
    for (const r of state.regions) {
      const data = state.regionData[r.id];
      if (!data || !showsWastePillar(data)) continue;
      const gw = Math.max(0, regionGWAtHour(data, hour, state.mode));
      if (gw <= 0.01) continue;
      for (const f of FUELS) {
        const share = fuelShareAtHour(r, f, hour, data);
        if (share > 0) sources.push({ lon: r.lon, lat: r.lat, gw: gw * share, fuel: f, radiusGW: gw });
      }
    }
    const result = assignTerritory(dots.lons, dots.lats, dots.hash, sources, dots.cells);
    territory = { result, regions: state.regions, regionData: state.regionData };
    territoryKey = key;
    return result;
  }

  function drawBaseDot(x, y, coreR, color, dotStyle) {
    if (dotStyle === "hollow") {
      // Estimated: outline ring only - nothing painted inside, because a
      // filled dot is the cue for "measured".
      ctx.strokeStyle = tokens.keyline;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(x, y, coreR + 0.9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(x, y, coreR, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, coreR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = tokens.keyline;
    ctx.lineWidth = 1;
    ctx.stroke();
    if (dotStyle === "ringed") {
      ctx.strokeStyle = `rgba(${tokens.dotDayRGB}, 0.7)`;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.arc(x, y, coreR + 2, 0, Math.PI * 2);
      ctx.stroke();
    } else if (dotStyle === "degraded") {
      ctx.save();
      ctx.strokeStyle = tokens.qualityWarning;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.arc(x, y, coreR + 2.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function render() {
    const renderNow = performance.now();
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    const size = Math.min(width, height);
    if (!width || !height) return;

    const R = size * 0.46 * state.zoomScale;
    const projection = d3.geoOrthographic()
      .scale(R)
      .translate([width / 2, height / 2])
      .clipAngle(90)
      .rotate(state.rotation);
    const center = [-state.rotation[0], -state.rotation[1]];
    const hour = ((state.utcHour % 24) + 24) % 24;
    const sunLng = wrapLongitude((12 - hour) * 15);
    const now = new Date();
    const start = Date.UTC(now.getUTCFullYear(), 0, 0);
    const diff = now.getTime() - start;
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
    const sunLat = 23.45 * Math.sin((2 * Math.PI * (dayOfYear - 81)) / 365);
    const cx = width / 2;
    const cy = height / 2;
    // Mark and dot sizes were tuned on a ~640px globe (R about 250).
    const k = Math.max(0.8, Math.min(2.2, R / 250));

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // --- Sphere: outer halo, lit body, shadow, then land, then rim. ---
    // Day and night are no longer two flat ocean fills with a hairline. The
    // body is lit from a fixed upper-left key light for form, and the actual
    // sun position is carried by the land dots' brightness bands below - a
    // soft ~23deg terminator instead of a hard edge that competed with data.
    const haloR = R * 1.32;
    const halo = ctx.createRadialGradient(cx, cy, R, cx, cy, haloR);
    halo.addColorStop(0, `rgba(${tokens.brandRGB},0.22)`);
    halo.addColorStop(0.18, `rgba(${tokens.brandRGB},0.07)`);
    halo.addColorStop(1, `rgba(${tokens.brandRGB},0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
    ctx.fill();

    const body = ctx.createRadialGradient(cx - R * 0.28, cy - R * 0.36, 0, cx - R * 0.28, cy - R * 0.36, R * 1.5);
    body.addColorStop(0, tokens.bodyHi);
    body.addColorStop(0.55, tokens.bodyMid);
    body.addColorStop(1, tokens.bodyLo);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();

    // A shadow darkens whatever it falls on, in either mode, so black is
    // theme-neutral here: on paper it reads as the sphere's shaded side.
    const shade = ctx.createRadialGradient(cx + R * 0.44, cy + R * 0.4, 0, cx + R * 0.44, cy + R * 0.4, R * 1.4);
    shade.addColorStop(0, "rgba(0,0,0,0.35)");
    shade.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();

    // --- Land dots: neutral brightness bands + lit territory. ---
    // One path per bucket and one fill per bucket, so the whole field is
    // 13 fills a frame whatever the dot count.
    const terr = territoryFor(hour);
    const cv = unitVec(center[0], center[1]);
    const sv = unitVec(sunLng, sunLat);
    const bandPaths = Array.from({ length: BAND_ALPHA.length }, () => new Path2D());
    const terrPaths = FUELS.map(() => [new Path2D(), new Path2D()]);
    const bandUsed = new Uint8Array(BAND_ALPHA.length);
    const terrUsed = new Uint8Array(6);
    for (let i = 0; i < dots.n; i++) {
      const x3 = dots.xyz[i * 3], y3 = dots.xyz[i * 3 + 1], z3 = dots.xyz[i * 3 + 2];
      const c = x3 * cv[0] + y3 * cv[1] + z3 * cv[2];
      if (c < 0.02) continue;
      const pt = projection([dots.lons[i], dots.lats[i]]);
      if (!pt) continue;
      const sc = Math.sqrt(c);
      const f = terr.fuel[i];
      if (f >= 0) {
        const inner = terr.inner[i];
        const r = (0.6 + 0.6 * sc) * k * (inner ? 1.3 : 1.1);
        const p = terrPaths[f][inner];
        p.moveTo(pt[0] + r, pt[1]);
        p.arc(pt[0], pt[1], r, 0, Math.PI * 2);
        terrUsed[f * 2 + inner] = 1;
      } else {
        const band = dayBand(x3 * sv[0] + y3 * sv[1] + z3 * sv[2]);
        const r = (0.45 + 0.5 * sc) * k;
        const p = bandPaths[band];
        p.moveTo(pt[0] + r, pt[1]);
        p.arc(pt[0], pt[1], r, 0, Math.PI * 2);
        bandUsed[band] = 1;
      }
    }
    for (let b = 0; b < bandPaths.length; b++) {
      if (!bandUsed[b]) continue;
      ctx.fillStyle = `rgba(${tokens.dotNeutralRGB},${BAND_ALPHA[b]})`;
      ctx.fill(bandPaths[b]);
    }
    for (let f = 0; f < FUELS.length; f++) {
      for (let inner = 0; inner < 2; inner++) {
        if (!terrUsed[f * 2 + inner]) continue;
        ctx.globalAlpha = inner ? 1 : 0.85;
        ctx.fillStyle = inner ? fuelTip[FUELS[f]] : fuelColor[FUELS[f]];
        ctx.fill(terrPaths[f][inner]);
      }
    }
    ctx.globalAlpha = 1;

    // Fresnel rim: a thin bright edge rather than a stroked outline.
    const rim = ctx.createRadialGradient(cx, cy, R * 0.88, cx, cy, R);
    rim.addColorStop(0, `rgba(${tokens.brandRGB},0)`);
    rim.addColorStop(0.875, `rgba(${tokens.brandRGB},0.14)`);
    rim.addColorStop(1, `rgba(${tokens.brandRGB},0.40)`);
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();

    // --- Pillars: one bar per fuel per region, never stacked. ---
    const pillarUnits = buildPillarUnitsForState();
    const visibleThisFrame = new Set();

    for (const unit of pillarUnits) {
      const group = unit.regions;
      const rep = group[0];
      const gwByRegion = group.map((r) => {
        const data = state.regionData[r.id];
        return data ? Math.max(0, regionGWAtHour(data, hour, state.mode)) : 0;
      });
      const totalWasteGW = gwByRegion.reduce((s, g) => s + g, 0);
      const genByRegion = group.map((r) => {
        const data = state.regionData[r.id];
        return data ? Math.max(0, generationGWAtHour(data, hour)) : 0;
      });
      const totalGenGW = genByRegion.reduce((s, g) => s + g, 0);
      const unpublished = group.some((r) => wasteStatusOf(state.regionData[r.id]) === "unpublished");
      const showWaste = group.some((r) => showsWastePillar(state.regionData[r.id])) && totalWasteGW > 0.01;
      const showGen = unpublished || totalGenGW > 0.01;
      if (!showWaste && !showGen) continue;

      const dist = d3.geoDistance([rep.lon, rep.lat], center);
      if (dist > Math.PI / 2) continue;
      const point = projection([rep.lon, rep.lat]);
      if (!point) continue;

      const repId = rep.id;
      visibleThisFrame.add(repId);
      if (!pillarBirthTimes.has(repId)) pillarBirthTimes.set(repId, renderNow);
      const birthT = easeOutCubic(Math.min(1, (renderNow - pillarBirthTimes.get(repId)) / BIRTH_MS));

      const anchorX = point[0] + unit.offsetPx;
      const anchorY = point[1];
      const visible = 1 - dist / (Math.PI / 2);
      const cosC = Math.cos(dist);
      // Foreshortening: a pillar near the limb is shorter, not splayed
      // sideways, so it cannot out-shout one facing the viewer.
      const foreshort = 0.35 + 0.65 * cosC;
      const limbAlpha = 0.55 + 0.45 * visible;

      const repData = state.regionData[rep.id];
      const domColor = getRegionFuelColor(rep, repData);
      const repBucket = qualityBucket(rep, repData);
      const repDegraded = repData?.sourceStatus === "degraded";
      const repAlpha = qualityOpacity(repDegraded ? "estimated" : repBucket);

      if (showGen) {
        const genWeight = Math.sqrt(Math.max(totalGenGW, unpublished ? 0.05 : 0));
        const genR = (5.5 + genWeight * 3.5) * birthT;
        ctx.save();
        ctx.globalAlpha = repAlpha * visible * 0.55;
        ctx.strokeStyle = unpublished && totalGenGW <= 0.01 ? tokens.border : domColor;
        ctx.lineWidth = unpublished && totalGenGW <= 0.01 ? 1.1 : 1.7;
        if (unpublished && totalGenGW <= 0.01) ctx.setLineDash([2.5, 2.5]);
        ctx.beginPath();
        ctx.arc(anchorX, anchorY, genR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      let dx = point[0] - cx;
      let dy = point[1] - cy;
      const len = Math.hypot(dx, dy);
      if (len > 0.1) { dx /= len; dy /= len; } else { dx = 0; dy = -1; }
      const px = -dy, py = dx;

      if (showWaste) {
        const bars = barsForUnit(group.map((r, i) => {
          const data = state.regionData[r.id];
          const share = {};
          for (const f of FUELS) share[f] = showsWastePillar(data) ? fuelShareAtHour(r, f, hour, data) : 0;
          return { gw: gwByRegion[i], share };
        }));
        const widths = bars.map((b) => Math.min(3.2, 1.2 + 0.75 * Math.sqrt(b.gw)) * Math.sqrt(k));
        const gap = Math.max(...widths, 1) * 2.1 + 1;
        bars.forEach((bar, bi) => {
          const member = group[bar.member];
          const mData = state.regionData[member.id];
          const mBucket = qualityBucket(member, mData);
          const mDegraded = mData?.sourceStatus === "degraded";
          const alpha = qualityOpacity(mDegraded ? "estimated" : mBucket) * limbAlpha;
          const dotStyle = dotStyleFor(mBucket, mData?.sourceStatus);
          const weight = Math.sqrt(bar.gw);
          const w = widths[bi];
          const off = (bi - (bars.length - 1) / 2) * gap;
          const bx = anchorX + px * off, by = anchorY + py * off;
          const H = (3 + weight * 48) * birthT * foreshort * (0.4 + 0.45 * k);
          const tx = bx + dx * H, ty = by + dy * H;
          const col = fuelColor[bar.fuel], tip = fuelTip[bar.fuel];

          ctx.globalAlpha = alpha;
          // Ground glow.
          const gR = (4 + 4.6 * weight) * (0.5 + 0.5 * cosC) * birthT * k;
          ctx.drawImage(glowSprite[bar.fuel], bx - gR, by - gR, gR * 2, gR * 2);
          // Sheath: translucent taper, the pillar's body of light.
          const sh = w * 4.2;
          ctx.globalAlpha = alpha * 0.26;
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(bx + px * sh / 2, by + py * sh / 2);
          ctx.lineTo(tx + px * sh * 0.2, ty + py * sh * 0.2);
          ctx.lineTo(tx - px * sh * 0.2, ty - py * sh * 0.2);
          ctx.lineTo(bx - px * sh / 2, by - py * sh / 2);
          ctx.closePath();
          ctx.fill();
          // Core, with the outer half in the lighter tip tint.
          ctx.globalAlpha = alpha;
          ctx.lineCap = "round";
          ctx.strokeStyle = col;
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(tx, ty);
          ctx.stroke();
          ctx.strokeStyle = tip;
          ctx.lineWidth = Math.max(0.7, w * 0.45);
          ctx.beginPath();
          ctx.moveTo(bx + dx * H * 0.5, by + dy * H * 0.5);
          ctx.lineTo(tx, ty);
          ctx.stroke();
          // Tip flare.
          const tR = w * 2.2;
          ctx.drawImage(glowSprite[bar.fuel], tx - tR, ty - tR, tR * 2, tR * 2);
          ctx.fillStyle = tip;
          ctx.beginPath();
          ctx.arc(tx, ty, w * 0.9, 0, Math.PI * 2);
          ctx.fill();
          // Confidence mark at the bar's own base, in its own fuel.
          const coreR = (1.5 + weight * 0.8) * birthT;
          drawBaseDot(bx, by, coreR, col, dotStyle);
        });
        ctx.lineCap = "butt";
      } else {
        // Generation-only unit (unpublished waste): base dot only.
        ctx.globalAlpha = repAlpha * limbAlpha;
        drawBaseDot(anchorX, anchorY, 1.5 * birthT, domColor, dotStyleFor(repBucket, repData?.sourceStatus));
      }

      if (rep.id === state.selectedRegionId) {
        const glowR = (4 + Math.sqrt(totalWasteGW) * 5) * birthT;
        ctx.save();
        ctx.globalAlpha = repAlpha * 0.9;
        ctx.strokeStyle = tokens.ink;
        ctx.lineWidth = 2.2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(anchorX, anchorY, glowR + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    for (const id of pillarBirthTimes.keys()) {
      if (!visibleThisFrame.has(id)) pillarBirthTimes.delete(id);
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  let activePointerId = null;
  let lastX = 0;
  let lastY = 0;
  let downX = 0;
  let downY = 0;
  let lastMoveAt = 0;
  let autoResumeAt = 0;
  const DRAG_SENSITIVITY = 0.55;
  const AUTO_RESUME_DELAY_MS = 2500;
  // Pointer travel threshold below which we treat the gesture as a click,
  // not a drag. 5px was below typical finger wobble on capacitive touch
  // (~8–12px), so mobile taps mis-registered as tiny drags and pillar
  // selection felt broken. 10px is above wobble, below intentional drag.
  const CLICK_MAX_TRAVEL_PX = 10;

  // Pinch-to-zoom: track all active pointers; switch to pinch mode at 2+.
  const pointerPositions = new Map(); // pointerId → [clientX, clientY]
  let pinchInitDist = 0;
  let pinchInitZoom = 1;
  let isPinching = false;
  // Prevent the last-finger lift after a pinch from firing onRegionClick.
  let suppressNextClick = false;

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    pointerPositions.set(event.pointerId, [event.clientX, event.clientY]);
    try { canvas.setPointerCapture(event.pointerId); } catch {}

    if (pointerPositions.size >= 2) {
      // Enter pinch mode: stop any active drag first.
      isPinching = true;
      state.dragging = false;
      canvas.classList.remove("is-dragging");
      const pts = [...pointerPositions.values()];
      pinchInitDist = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
      pinchInitZoom = state.zoomScale;
    } else {
      // Single-pointer drag start (existing behaviour).
      isPinching = false;
      state.dragging = true;
      activePointerId = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      downX = event.clientX;
      downY = event.clientY;
      lastMoveAt = event.timeStamp;
      canvas.classList.add("is-dragging");
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!pointerPositions.has(event.pointerId)) return;
    pointerPositions.set(event.pointerId, [event.clientX, event.clientY]);

    if (isPinching && pointerPositions.size >= 2) {
      // Update pinch zoom.
      const pts = [...pointerPositions.values()];
      const dist = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
      if (pinchInitDist > 0) {
        state.zoomScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pinchInitZoom * (dist / pinchInitDist)));
        initial.onZoomChange?.(state.zoomScale); // keep slider in sync with pinch
        render();
      }
      return;
    }

    if (!state.dragging || event.pointerId !== activePointerId) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    lastMoveAt = event.timeStamp;
    state.rotation[0] = wrapLongitude(state.rotation[0] + dx * DRAG_SENSITIVITY);
    state.rotation[1] = Math.max(-90, Math.min(90, state.rotation[1] - dy * DRAG_SENSITIVITY));
    render();
  });

  function releasePointer(event) {
    const wasTracked = pointerPositions.has(event.pointerId);
    pointerPositions.delete(event.pointerId);

    if (isPinching) {
      if (pointerPositions.size < 2) {
        // Exit pinch mode; if one finger remains, restart drag from that position.
        isPinching = false;
        // Suppress the imminent click that would otherwise fire when this
        // remaining finger lifts without travelling far (the user was pinching,
        // not tapping).
        suppressNextClick = true;
        if (pointerPositions.size === 1) {
          const [remId, remPos] = [...pointerPositions.entries()][0];
          activePointerId = remId;
          lastX = remPos[0];
          lastY = remPos[1];
          downX = remPos[0];
          downY = remPos[1];
          state.dragging = true;
          canvas.classList.add("is-dragging");
        }
      }
      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      return;
    }

    if (activePointerId !== event.pointerId && !wasTracked) return;
    const travelX = event.clientX - downX;
    const travelY = event.clientY - downY;
    const traveled = Math.hypot(travelX, travelY);
    state.dragging = false;
    activePointerId = null;
    autoResumeAt = performance.now() + AUTO_RESUME_DELAY_MS;
    canvas.classList.remove("is-dragging");
    if (canvas.hasPointerCapture?.(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    // Treat a small-travel pointerup as a click and run hit-testing.
    // Skip if we just exited a pinch — the finger lift is not a tap.
    if (onRegionClick && traveled < CLICK_MAX_TRAVEL_PX && event.type === "pointerup" && !suppressNextClick) {
      const hit = hitTestRegion(event.clientX, event.clientY);
      onRegionClick(hit, { clientX: event.clientX, clientY: event.clientY });
      const hitId = hit ? (Array.isArray(hit) ? hit[0].id : hit.id) : null;
      // Track selection for visual highlight; the rich tooltip is owned by
      // mountRegionTooltip() (callback passed in via onRegionClick).
      state.selectedRegionId = hitId === state.selectedRegionId ? null : hitId;
      render();
    }
    suppressNextClick = false;
  }

  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);
  canvas.addEventListener("pointerleave", (event) => {
    if ((state.dragging || isPinching) && event.buttons === 0) {
      releasePointer(event);
    }
  });

  // Scroll-wheel zoom (desktop trackpad + mouse wheel).
  // Named reference so destroy() can remove it.
  function onWheel(event) {
    event.preventDefault();
    // Normalise delta across deltaMode values (0=pixels, 1=lines, 2=pages).
    // Cap page-mode at 200 pixel-equivalent to avoid a single event zooming
    // more than ~18% (0.999^200 ≈ 0.82).
    const pixels = event.deltaMode === 1 ? event.deltaY * 20
                 : event.deltaMode === 2 ? Math.min(event.deltaY * 400, 200)
                 : event.deltaY;
    applyZoom(Math.pow(0.999, pixels));
  }
  canvas.addEventListener("wheel", onWheel, { passive: false });

  resize();

  // Frame-rate strategy:
  // - Desktop: render every rAF frame (targetFrameMs = 0). The old 16ms
  //   guard was borderline on 60 Hz and would occasionally skip a frame,
  //   then compensate with a double-step on the next — the "pop forward"
  //   the user sees. At native rAF rate the step is tiny every frame.
  // - Mobile/battery: throttle to ~30 FPS (33ms) — half the CPU/GPU work
  //   for a rotation that looks identical to 60 FPS.
  // - All cases: cap the delta at 50ms so a GC pause, browser scheduling
  //   hiccup, or tab-switch recovery never produces a jarring jump.
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const mobileMQ = window.matchMedia?.("(max-width: 900px), (hover: none)");
  let targetFrameMs = mobileMQ?.matches ? 33 : 0;
  mobileMQ?.addEventListener?.("change", (e) => {
    targetFrameMs = e.matches ? 33 : 0;
  });

  let rafId = null;
  let lastFrameTs = 0;

  const tick = (now) => {
    rafId = null;
    if (document.hidden) return; // visibilitychange will resume us
    if (now - lastFrameTs >= targetFrameMs) {
      if (!state.dragging && now >= autoResumeAt) {
        // Cap delta to 50ms: prevents GC pauses / scheduling hiccups from
        // producing a visible jump in rotation angle.
        const dt = Math.min(now - lastFrameTs, 50);
        const step = 0.03 * (dt / 16);
        state.rotation[0] = wrapLongitude(state.rotation[0] + step);
      }
      render();
      lastFrameTs = now;
    }
    rafId = requestAnimationFrame(tick);
  };

  function startLoop() {
    if (rafId != null || prefersReducedMotion) return;
    lastFrameTs = 0;
    rafId = requestAnimationFrame(tick);
  }
  function stopLoop() {
    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  if (prefersReducedMotion) {
    render();
  } else {
    startLoop();
  }

  const onVisibility = () => {
    if (document.hidden) stopLoop();
    else startLoop();
  };
  document.addEventListener("visibilitychange", onVisibility);

  return {
    update(next) {
      Object.assign(state, next);
      render();
    },
    zoomIn()  { applyZoom(1.25); },
    zoomOut() { applyZoom(1 / 1.25); },
    resetZoom() { state.zoomScale = 1.0; initial.onZoomChange?.(1.0); render(); },
    setZoom(s) { applyZoom(s / state.zoomScale); },
    destroy() {
      stopLoop();
      window.removeEventListener("themechange", refreshTokens);
      window.removeEventListener("resize", syncGlobeRect);
      document.removeEventListener("visibilitychange", onVisibility);
      resizeObserver.disconnect();
      canvas.removeEventListener("wheel", onWheel);
    }
  };
}
