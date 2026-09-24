import * as d3 from "npm:d3";
import * as topojson from "npm:topojson-client";
import { regionGWAtHour, generationGWAtHour } from "./lib/calc.js";
import { showsWastePillar, wasteStatusOf } from "./lib/waste-status.js";
import { getRegionFuelColor, getFuelColor, fuelShareAtHour, dominantFuel, FUEL_LABEL } from "./lib/fuel.js";
import { readGlobeTokens } from "./lib/theme-tokens.js";
import { buildPillarUnits } from "./lib/pillar-layout.js";
import { qualityBucket, qualityOpacity, dotStyleFor } from "./lib/region-quality.js";
import { wrapLongitude, easeOutCubic } from "./lib/globe-geo.js";
import {
  FUELS, BAND_ALPHA, dayBand, dotHash, assignTerritory, DotCellIndex, barsForUnit, tintHex,
} from "./lib/globe-surface.js";
import { vec, subsolar, FOLLOW_SUN, wrapLon, D2R } from "./lib/globe-camera.js";
import {
  HORIZON_DOT_PITCH, HORIZON_FULL_LAT0, HORIZON_PHONE, HORIZON_LAT_RANGE, borderAlpha, clampView,
  horizonFullGeometry, horizonGeometry, horizonPhoneGeometry, horizonTerritoryRadiusDeg, minZoom,
  viewGeometry, zoomOutBlend, zoomViewAt,
} from "./lib/horizon.js";
import { createEngravedRenderer } from "./globe-engraved.js";
import { createHorizonRenderer } from "./globe-horizon.js";

// Locally-vendored world atlas: previously fetched from unpkg.com, which
// added a third-party DNS + TLS handshake (~200–400ms on cellular) to
// every cold page load. Served from our own origin now via FileAttachment.
let atlasPromise;
const landDotsByStep = new Map();

async function loadAtlas(topologyUrl) {
  if (!atlasPromise) {
    atlasPromise = fetch(topologyUrl)
      .then((response) => response.json())
      .then((topology) => ({
        countries: topojson.feature(topology, topology.objects.countries),
        // Merged land for the engraved globe's knock-out and coastline: the
        // countries layer would also draw every border.
        land: topojson.feature(topology, topology.objects.land),
        // Every border and coast once, for the horizon when zoomed in.
        borders: topojson.mesh(topology, topology.objects.countries),
      }));
  }
  return atlasPromise;
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
  const { countries, land, borders } = await loadAtlas(initial.topologyUrl);
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
    // Light mode's engraved globe has its own camera. It follows the sun
    // until the visitor drags it (redesign plan 6.1); "Now" turns following
    // back on through update({ follow: true }). Longitude carries across a
    // mode switch; latitude is per mode.
    lat0: FOLLOW_SUN.light.lat0,
    lon0: null,
    follow: true,
    // Phones show a static globe; "Explore the globe" opens it full screen
    // and interactive (src/components/explorer.js, redesign plan 6.4).
    exploring: false,
    // Dark's own view: a zoom about the pointer, and the camera latitude a
    // vertical drag tilts. The phone band ignores both; the explorer uses them.
    darkLat0: FOLLOW_SUN.dark.lat0,
    darkView: { zoom: 1, tx: 0, ty: 0 },
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
      // The light and dark modes define their beam-tip colours as tokens;
      // the paper figure's palette defines none and keeps its tint.
      fuelTip[f] = tokens.fuelTips?.[f] || tintHex(fuelColor[f], 0.55);
      glowSprite[f] = makeGlow(fuelColor[f]);
    }
  }
  refreshFuelPaint();

  function refreshTokens() {
    tokens = readGlobeTokens(document.documentElement);
    refreshFuelPaint();
    engraved.reset();
    horizon.reset();
    readLabelClearance();
    // Light and dark share the camera longitude (state.lon0), so it carries
    // across the switch with the hour, selection and follow-the-sun
    // (redesign plan 3.5); latitude is per mode. Only the paper figure
    // (data-theme="embed") runs G1's idle loop, and a page never switches
    // into it.
    if (usesG1()) startLoop();
    else stopLoop();
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
    readLabelClearance();
    render();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);


  // --- Lit territory cache ---
  // Which land dots glow in which fuel depends on every region's GW at the
  // current hour, not on rotation, so it is recomputed only when the hour
  // (to a quarter), the mode or the data changes - not every frame.
  function territorySources(hour) {
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
    return sources;
  }

  /** A territory cache per dot field: recomputed only when the hour (to a
   *  quarter), the time window or the data changes. */
  function territoryCache(radiusDeg) {
    let cached = null;
    return (field, hour) => {
      const key = `${Math.round(hour * 4) / 4}|${state.mode}`;
      if (cached && cached.key === key && cached.field === field &&
          cached.regions === state.regions && cached.regionData === state.regionData) {
        return cached.result;
      }
      const result = assignTerritory(field.lons, field.lats, field.hash, territorySources(hour), field.cells, radiusDeg);
      cached = { key, field, result, regions: state.regions, regionData: state.regionData };
      return result;
    };
  }
  const g1Territory = territoryCache(undefined);
  const darkTerritory = territoryCache(horizonTerritoryRadiusDeg);
  const territoryFor = (hour) => g1Territory(dots, hour);

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

  // ---------------------------------------------------------------------------
  // Which renderer: light mode draws the engraved "Almanac" globe
  // (src/globe-engraved.js), dark the "Horizon" (src/globe-horizon.js). The
  // paper figure (src/embed/globe.md, data-theme="embed") keeps the G1 renderer
  // below: its look is part of a published artefact.
  // ---------------------------------------------------------------------------
  const themeOf = () => document.documentElement.getAttribute("data-theme");
  const isLight = () => themeOf() === "light";
  const isDark = () => themeOf() === "dark";
  const usesG1 = () => !isLight() && !isDark();

  // Off-screen pause (the dashboard asks for it; the paper figure does not):
  // no drawing while the canvas is scrolled away, one draw on the way back.
  let visible = true;
  let dirty = false;
  let io = null;
  if (initial.pauseOffscreen && typeof IntersectionObserver === "function") {
    io = new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      if (visible && dirty) { dirty = false; render(); }
    });
    io.observe(canvas);
  }

  function render(opts) {
    if (!visible) { dirty = true; return; }
    if (isLight()) {
      renderLight(opts);
    } else if (isDark()) {
      renderDark();
    } else {
      // The label card belongs to the redesign's globes; G1 marks a
      // selection with its own ring.
      if (selectionEl) selectionEl.hidden = true;
      renderG1();
    }
    describe();
  }

  // ---------------------------------------------------------------------------
  // Light and dark draw on change (clock ticks, drags, resizes, theme,
  // selection), never on an idle animation loop: the site had to rescue its
  // main thread once already (#1054).
  // ---------------------------------------------------------------------------
  const engraved = createEngravedRenderer();
  const horizon = createHorizonRenderer();
  const phoneQuery = window.matchMedia?.("(max-width: 640px)");
  let lastDrawnHour = null;
  let lightDots = null;
  let darkDots = null;
  let markHits = [];
  let lastLightDrawAt = 0;
  let settleTimer = null;
  const regionVec = new Map();
  function vecFor(region) {
    let v = regionVec.get(region.id);
    if (!v) { v = vec(region.lat, region.lon); regionVec.set(region.id, v); }
    return v;
  }
  const lightRadius = () =>
    Math.min(canvas.width / dpr, canvas.height / dpr) * 0.43 * state.zoomScale;

  // On a phone, outside the explorer, the globe is a static picture: no
  // selection drawn on it, and (update() below) one draw per hour change.
  const phoneStill = () => Boolean(phoneQuery?.matches) && !state.exploring;
  const shownSelection = () => (phoneStill() ? null : state.selectedRegionId);

  // Where the label card must stay clear of at the bottom of the canvas: in
  // dark the glass dock sits over the canvas there. CSS sets it on the canvas
  // as --globe-label-clear; re-read on resize and theme change.
  // --globe-top-clear is the header's height over the canvas, which the
  // zoomed-out whole globe keeps clear of.
  let labelClear = 0;
  let topClear = 0;
  function readLabelClearance() {
    const cs = getComputedStyle(canvas);
    labelClear = parseFloat(cs.getPropertyValue("--globe-label-clear")) || 0;
    topClear = parseFloat(cs.getPropertyValue("--globe-top-clear")) || 0;
  }

  /**
   * What both renderers draw at an hour: one mark (needle or beam) per fuel
   * per region record, never stacked - the same barsForUnit split as the G1
   * pillars, so a mixed region's solar share drops out at local night.
   * Records that share a location sit a few pixels apart. Grids that publish
   * no waste get a dashed ring instead.
   */
  function marksAt(hour) {
    const marks = [];
    const rings = [];
    for (const unit of buildPillarUnitsForState()) {
      const group = unit.regions;
      const data = group.map((r) => state.regionData[r.id]);
      const gw = data.map((d) => (d ? Math.max(0, regionGWAtHour(d, hour, state.mode)) : 0));
      const totalWaste = gw.reduce((sum, g) => sum + g, 0);
      const showWaste = data.some((d) => showsWastePillar(d)) && totalWaste > 0.01;
      if (!showWaste) {
        const gen = data.reduce((sum, d) => sum + (d ? Math.max(0, generationGWAtHour(d, hour)) : 0), 0);
        const unpublished = data.some((d) => wasteStatusOf(d) === "unpublished");
        if (unpublished || gen > 0.01) rings.push({ v: vecFor(group[0]), gen });
        continue;
      }
      const bars = barsForUnit(group.map((r, i) => {
        const share = {};
        for (const f of FUELS) share[f] = showsWastePillar(data[i]) ? fuelShareAtHour(r, f, hour, data[i]) : 0;
        return { gw: gw[i], share };
      }));
      bars.forEach((bar, bi) => {
        const member = group[bar.member];
        const mData = data[bar.member];
        marks.push({
          id: member.id,
          v: vecFor(member),
          fuel: bar.fuel,
          color: fuelColor[bar.fuel],
          bucket: qualityBucket(member, mData),
          stale: mData?.sourceStatus === "degraded",
          gw: bar.gw,
          offset: (bi - (bars.length - 1) / 2) * 4.5,
        });
      });
    }
    return { marks, rings };
  }

  // Light: the engraved globe. While the camera moves it reuses the cached
  // line screen within 0.25 deg and, when dragging, draws in `fast` mode; one
  // exact frame follows once the motion stops.
  function renderLight({ fast = false } = {}) {
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    if (!width || !height) return;
    lastDrawnHour = state.utcHour;
    const now = performance.now();
    const moving = fast || now - lastLightDrawAt < 60;
    lastLightDrawAt = now;
    clearTimeout(settleTimer);
    if (moving) settleTimer = setTimeout(() => render(), 160);

    const hour = ((state.utcHour % 24) + 24) % 24;
    const sun = subsolar(new Date(), hour);
    if (state.follow || state.lon0 == null) state.lon0 = wrapLon(sun.lon + FOLLOW_SUN.light.lonOffset);
    if (!lightDots) lightDots = precomputeLandDots(countries, 0.8);
    const { marks, rings } = marksAt(hour);

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    const out = engraved.draw({
      ctx, w: width, h: height, dpr, cx: width / 2, cy: height / 2, R: lightRadius(),
      lat0: state.lat0, lon0: state.lon0, sun, land, dots: lightDots, needles: marks, rings,
      inkRGB: tokens.inkRGB, paper: tokens.paper, warn: tokens.qualityWarning,
      selectedId: shownSelection(), fast, exact: !moving, leader: !state.exploring,
    });
    ctx.restore();
    markHits = out.hits;
    placeSelection(out.label, hour);
  }

  // Dark: the horizon (redesign plan 6.3). The camera follows the sun until
  // the visitor drags or zooms. A sideways drag turns longitude, a vertical
  // one tilts the globe (state.darkLat0) so any latitude can come to the
  // horizon, and a zoom magnifies the stage about the pointer
  // (state.darkView), with country borders fading in. The backdrop and sprites are cached in the
  // renderer and the lit territory per quarter hour, so a frame is the dots
  // and the beams. On a phone, outside the explorer, it is the band under the
  // hero (redesign plan 3.4); the explorer uses the desktop geometry.
  function renderDark() {
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    if (!width || !height) return;
    lastDrawnHour = state.utcHour;
    const hour = ((state.utcHour % 24) + 24) % 24;
    const sun = subsolar(new Date(), hour);
    if (state.follow || state.lon0 == null) state.lon0 = wrapLon(sun.lon + FOLLOW_SUN.dark.lonOffset);
    if (!darkDots) darkDots = precomputeLandDots(countries, HORIZON_DOT_PITCH);
    const { marks, rings } = marksAt(hour);
    const band = phoneStill();
    const frame = band ? null : darkFrame(width, height);
    const base = band ? horizonPhoneGeometry(width, height) : frame.base;
    const view = band ? { zoom: 1, tx: 0, ty: 0 } : (state.darkView = clampView(state.darkView, width, height, frame.zMin));
    const geo = viewGeometry(base, view, frame?.full);
    // Zoomed in, beams grow more slowly than the land (so they do not swamp
    // it) and dots grow a little. Zoomed out, beams and dots shrink more
    // slowly than the globe, so both still read on the whole sphere. Either
    // way the borders fade in.
    const z = view.zoom;
    const look = band ? HORIZON_PHONE : {
      lat0: darkLat0At(z),
      beam: z > 1 ? 0.1 / Math.sqrt(z) : 0.1 * Math.pow(z, -0.3),
      widthScale: 1,
      dotScale: z > 1 ? Math.min(1.8, Math.pow(z, 0.35)) : Math.max(0.65, Math.pow(z, 0.3)),
    };
    const bAlpha = band ? 0 : borderAlpha(z, frame.zMin);

    ctx.save();
    ctx.scale(dpr, dpr);
    const out = horizon.draw({
      ctx, w: width, h: height, dpr, R: geo.R, top: geo.top, cx: geo.cx, skyTop: base.top,
      borders: bAlpha > 0 ? borderLines() : null, borderAlpha: bAlpha,
      lat0: look.lat0, lon0: state.lon0, sun,
      dots: darkDots, territory: darkTerritory(darkDots, hour),
      beams: marks, rings, t: tokens, fuel: fuelColor, tip: fuelTip,
      beam: look.beam, widthScale: look.widthScale, dotScale: look.dotScale,
      selectedId: shownSelection(), labelBottom: height - labelClear, leader: !state.exploring,
    });
    ctx.restore();
    markHits = out.hits;
    placeSelection(out.label, hour);
  }

  /** Border and coast polylines as unit vectors, built on first zoom. */
  let borderCache = null;
  function borderLines() {
    if (!borderCache) {
      borderCache = borders.coordinates.map((line) => {
        const out = new Float32Array(line.length * 3);
        line.forEach(([lon, lat], i) => out.set(vec(lat, lon), i * 3));
        return out;
      });
    }
    return borderCache;
  }

  /** The horizon, the whole globe and the zoom that reaches it, for a W x H stage. */
  function darkFrame(w, h) {
    const base = horizonGeometry(w, h);
    const full = horizonFullGeometry(w, h, topClear, labelClear);
    return { base, full, zMin: minZoom(base, full) };
  }

  /** Camera latitude at a zoom: the visitor's tilt, turning toward the
   *  whole globe's north-up view as the zoom goes out. */
  function darkLat0At(zoom) {
    const w = canvas.width / dpr, h = canvas.height / dpr;
    const s = zoomOutBlend(zoom, darkFrame(w, h).zMin);
    return Math.max(-85, Math.min(85, state.darkLat0 + s * (HORIZON_FULL_LAT0 - FOLLOW_SUN.dark.lat0)));
  }

  /** The dark globe's geometry as drawn now (not the phone band). */
  function darkGeometry() {
    const w = canvas.width / dpr, h = canvas.height / dpr;
    const frame = darkFrame(w, h);
    return viewGeometry(frame.base, clampView(state.darkView, w, h, frame.zMin), frame.full);
  }

  /**
   * Degrees of camera longitude and latitude per pixel of drag. In light the
   * globe's centre moves with the pointer. In dark the land under the pointer
   * does, as nearly as a turn about the pole allows: longitude by the radius
   * of its latitude circle, a tilt by how squarely it faces the viewer (land
   * at the horizon barely moves up or down when the globe tilts).
   */
  function dragRates(clientX, clientY) {
    if (!isDark()) {
      const r = 1 / lightRadius() / D2R;
      return { lon: r, lat: r };
    }
    const g = darkGeometry();
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - g.cx) / g.R, y = (clientY - rect.top - g.cy) / g.R;
    const r2 = x * x + y * y;
    // Off the globe (in the sky) the drag takes the horizon's crest.
    const lat0 = darkLat0At(state.darkView.zoom);
    let depth = 0, lat = lat0 + 90;
    if (r2 < 1) {
      depth = Math.sqrt(1 - r2);
      const p = lat0 * D2R;
      // The pointer's ground point: x e - y n + depth f, z component only.
      lat = Math.asin(Math.max(-1, Math.min(1, -y * Math.cos(p) + depth * Math.sin(p)))) / D2R;
    }
    return {
      lon: 1 / (g.R * Math.max(0.25, Math.abs(Math.cos(lat * D2R)))) / D2R,
      lat: 1 / (g.R * Math.max(0.35, depth)) / D2R,
    };
  }

  /** Zoom the dark globe by `factor` about a client point (the stage's middle when omitted). */
  function zoomDark(factor, clientX, clientY) {
    const w = canvas.width / dpr, h = canvas.height / dpr;
    if (!w || !h) return;
    const rect = canvas.getBoundingClientRect();
    const mx = clientX == null ? w * 0.57 : clientX - rect.left;
    const my = clientY == null ? h * 0.62 : clientY - rect.top;
    const next = zoomViewAt(state.darkView, factor, mx, my, w, h, darkFrame(w, h).zMin);
    if (next.zoom === state.darkView.zoom && next.tx === state.darkView.tx && next.ty === state.darkView.ty) return;
    state.darkView = next;
    // Zooming in holds the camera, as a drag does, so the land being looked
    // at does not turn away with the sun; "Now" and resetView follow again.
    if (next.zoom !== 1) state.follow = false;
    viewChanged();
    render();
  }

  function isHomeView() {
    const v = state.darkView;
    return v.zoom === 1 && v.tx === 0 && v.ty === 0 && state.darkLat0 === FOLLOW_SUN.dark.lat0 && state.follow;
  }
  function viewChanged() {
    const w = canvas.width / dpr, h = canvas.height / dpr;
    const zMin = w && h ? darkFrame(w, h).zMin : 1;
    initial.onViewChange?.({ zoom: state.darkView.zoom, minZoom: zMin, home: isHomeView() });
  }

  // The selected region's label card: DOM (so its name can link to the
  // region's page), placed by the renderer beside the needle head.
  const selectionEl = initial.selectionEl instanceof Element ? initial.selectionEl : null;
  let selectionFor = null;
  const QUALITY_LABEL = { measured: "Measured", anchored: "Anchored", estimated: "Estimated" };
  function fmtGW(gw) { return gw >= 1 ? gw.toFixed(1) : gw.toFixed(2); }

  function placeSelection(label, hour) {
    if (!selectionEl) return;
    const id = shownSelection();
    const region = label && id ? state.regions.find((r) => r.id === id) : null;
    if (!region) {
      selectionEl.hidden = true;
      selectionFor = null;
      return;
    }
    const data = state.regionData[region.id];
    if (selectionFor !== region.id) {
      const fuel = dominantFuel(region, data);
      selectionEl.replaceChildren();
      const meta = document.createElement("div");
      meta.className = "gs-meta";
      const kicker = document.createElement("span");
      kicker.textContent = "Selected";
      const fuelEl = document.createElement("span");
      fuelEl.className = "gs-fuel";
      const swatch = document.createElement("span");
      swatch.className = `dot dot--${fuel}`;
      swatch.setAttribute("aria-hidden", "true");
      fuelEl.append(swatch, FUEL_LABEL[fuel]);
      meta.append(kicker, fuelEl);
      const name = document.createElement("a");
      name.className = "gs-name";
      name.href = `./region/${encodeURIComponent(region.id)}`;
      name.textContent = region.name;
      const nowEl = document.createElement("div");
      nowEl.className = "gs-now";
      selectionEl.append(meta, name, nowEl);
      selectionFor = region.id;
    }
    const gw = data ? Math.max(0, regionGWAtHour(data, hour, state.mode)) : 0;
    const quality = QUALITY_LABEL[qualityBucket(region, data)];
    const stale = data?.sourceStatus === "degraded" ? " · stale feed" : "";
    selectionEl.querySelector(".gs-now").textContent = `${fmtGW(gw)} GW now · ${quality}${stale}`;
    selectionEl.style.left = `${label.left}px`;
    selectionEl.style.top = `${label.top}px`;
    selectionEl.dataset.side = label.side;
    selectionEl.hidden = false;
  }

  function hitMark(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left, py = clientY - rect.top;
    let best = null, bestD = Infinity;
    for (const hit of markHits) {
      const d = Math.hypot(hit.x - px, hit.y - py);
      if (d < hit.r && d < bestD) { best = hit; bestD = d; }
    }
    return best;
  }

  // Hover (mouse only) hands the region to the page, which opens the detail
  // card (region-tooltip.js); a tap selects instead.
  let hoverId = null;
  function hoverAt(event) {
    if (typeof initial.onRegionHover !== "function") return;
    const hit = event && event.pointerType === "mouse" ? hitMark(event.clientX, event.clientY) : null;
    const id = hit?.id ?? null;
    canvas.style.cursor = id ? "pointer" : "";
    if (id === hoverId) return;
    hoverId = id;
    const region = id ? state.regions.find((r) => r.id === id) : null;
    initial.onRegionHover(region ?? null, event ? { clientX: event.clientX, clientY: event.clientY } : null);
  }

  // The canvas is role="img"; its accessible name restates the hour's total
  // and the three largest regions, at most once a second while the clock
  // plays (redesign plan 6.1). Only where the page asks: the paper figure
  // keeps its own fixed label.
  let describedAt = -Infinity;
  let describeTimer = null;
  function describe() {
    if (!initial.describe) return;
    const wait = 1000 - (performance.now() - describedAt);
    if (wait > 0) {
      if (!describeTimer) describeTimer = setTimeout(() => { describeTimer = null; describe(); }, wait);
      return;
    }
    describedAt = performance.now();
    const hour = ((state.utcHour % 24) + 24) % 24;
    let total = 0;
    const rows = [];
    for (const r of state.regions) {
      const d = state.regionData[r.id];
      if (!d) continue;
      const gw = Math.max(0, regionGWAtHour(d, hour, state.mode));
      total += gw;
      if (gw > 0) rows.push([r.name, gw]);
    }
    rows.sort((a, b) => b[1] - a[1]);
    const hh = String(Math.floor(hour)).padStart(2, "0");
    const mm = String(Math.floor((hour % 1) * 60)).padStart(2, "0");
    const top = rows.slice(0, 3).map(([name, gw]) => `${name} ${fmtGW(gw)} GW`).join(", ");
    canvas.setAttribute(
      "aria-label",
      `Globe of curtailed renewable energy at ${hh}:${mm} UTC: ${total.toFixed(1)} GW in all.` +
        (top ? ` Largest: ${top}.` : ""),
    );
  }

  function renderG1() {
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
  let lightDrag = null;
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
  let pinchLast = 0;
  // Prevent the last-finger lift after a pinch from firing onRegionClick.
  let suppressNextClick = false;

  function newDrag(x, y) {
    return {
      x, y, lon0: state.lon0 ?? 0, lat0: isDark() ? state.darkLat0 : state.lat0,
      rates: dragRates(x, y), moved: false,
    };
  }

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    pointerPositions.set(event.pointerId, [event.clientX, event.clientY]);
    try { canvas.setPointerCapture(event.pointerId); } catch {}

    if (pointerPositions.size >= 2) {
      // Enter pinch mode: stop any active drag first.
      isPinching = true;
      state.dragging = false;
      lightDrag = null;
      canvas.classList.remove("is-dragging");
      const pts = [...pointerPositions.values()];
      pinchInitDist = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
      pinchInitZoom = state.zoomScale;
      pinchLast = pinchInitDist;
    } else if (!usesG1()) {
      // Light and dark: a drag only starts once the pointer has travelled, so
      // a tap stays a tap; the camera is (lat0, lon0) rather than G1's rotation.
      isPinching = false;
      activePointerId = event.pointerId;
      downX = event.clientX;
      downY = event.clientY;
      lightDrag = newDrag(event.clientX, event.clientY);
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
    if (!pointerPositions.has(event.pointerId)) {
      if (!usesG1()) hoverAt(event);
      return;
    }
    pointerPositions.set(event.pointerId, [event.clientX, event.clientY]);

    if (isPinching && pointerPositions.size >= 2) {
      // Update pinch zoom. The horizon zooms about the fingers' midpoint.
      const pts = [...pointerPositions.values()];
      const dist = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
      if (isDark()) {
        if (pinchLast > 0 && !phoneStill()) {
          zoomDark(dist / pinchLast, (pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2);
        }
        pinchLast = dist;
        return;
      }
      if (pinchInitDist > 0) {
        state.zoomScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pinchInitZoom * (dist / pinchInitDist)));
        initial.onZoomChange?.(state.zoomScale); // keep slider in sync with pinch
        render();
      }
      return;
    }

    if (!usesG1()) {
      const drag = lightDrag;
      if (!drag || event.pointerId !== activePointerId) return;
      const tx = event.clientX - drag.x, ty = event.clientY - drag.y;
      if (!drag.moved) {
        if (Math.hypot(tx, ty) < CLICK_MAX_TRAVEL_PX) return;
        drag.moved = true;
        state.dragging = true;
        state.follow = false; // dragging turns follow-the-sun off; "Now" turns it back on
        canvas.classList.add("is-dragging");
        hoverAt(null);
      }
      state.lon0 = wrapLon(drag.lon0 - tx * drag.rates.lon);
      if (isLight()) {
        state.lat0 = Math.max(-60, Math.min(70, drag.lat0 + ty * drag.rates.lat));
      } else if (!phoneStill()) {
        // Dark tilts: pulling down brings the land beyond the horizon over it.
        const [lo, hi] = HORIZON_LAT_RANGE;
        state.darkLat0 = Math.max(lo, Math.min(hi, drag.lat0 + ty * drag.rates.lat));
      }
      if (isDark()) viewChanged();
      render({ fast: true });
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
          if (!usesG1()) {
            lightDrag = newDrag(remPos[0], remPos[1]);
          } else {
            state.dragging = true;
            canvas.classList.add("is-dragging");
          }
        }
      }
      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      return;
    }

    if (activePointerId !== event.pointerId && !wasTracked) return;

    if (!usesG1()) {
      // Light and dark: a pointerup that never became a drag is a tap. It
      // selects the needle or beam under it (again: deselects), or clears
      // the selection.
      const drag = lightDrag;
      lightDrag = null;
      activePointerId = null;
      state.dragging = false;
      canvas.classList.remove("is-dragging");
      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (drag && !drag.moved && event.type === "pointerup" && !suppressNextClick) {
        const hit = hitMark(event.clientX, event.clientY);
        state.selectedRegionId = hit && hit.id !== state.selectedRegionId ? hit.id : null;
        initial.onSelect?.(state.selectedRegionId);
      }
      suppressNextClick = false;
      render();
      return;
    }

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
    if (!usesG1() && !pointerPositions.has(event.pointerId)) hoverAt(null);
  });

  // Scroll-wheel zoom (desktop trackpad + mouse wheel).
  // Named reference so destroy() can remove it.
  function onWheel(event) {
    // The horizon's canvas fills the first screen, so a plain wheel scrolls
    // the page; Ctrl/Cmd + wheel (and a trackpad pinch, which browsers send
    // as Ctrl + wheel) zooms about the pointer.
    if (isDark()) {
      if (!(event.ctrlKey || event.metaKey) || phoneStill()) return;
      event.preventDefault();
      const px = event.deltaMode === 1 ? event.deltaY * 20 : event.deltaMode === 2 ? event.deltaY * 400 : event.deltaY;
      zoomDark(Math.pow(0.99, Math.max(-60, Math.min(60, px))), event.clientX, event.clientY);
      return;
    }
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

  // Safari sends a trackpad pinch as gesture events, not Ctrl + wheel.
  let gestureScale = 1;
  function onGestureStart(event) {
    if (!isDark() || phoneStill()) return;
    event.preventDefault();
    gestureScale = 1;
  }
  function onGestureChange(event) {
    if (!isDark() || phoneStill()) return;
    event.preventDefault();
    zoomDark(event.scale / gestureScale, event.clientX, event.clientY);
    gestureScale = event.scale;
  }
  canvas.addEventListener("gesturestart", onGestureStart);
  canvas.addEventListener("gesturechange", onGestureChange);

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
    if (!usesG1()) return;       // light and dark draw on change, not per frame
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
    if (rafId != null || prefersReducedMotion || !usesG1()) return;
    lastFrameTs = 0;
    rafId = requestAnimationFrame(tick);
  }
  function stopLoop() {
    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  if (prefersReducedMotion || !usesG1()) {
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
      // A clock tick, with nothing else changing, redraws light and dark only
      // when it moves the picture. On a phone, outside the explorer, the globe
      // draws once per hour change while the clock runs (redesign plan 6.2,
      // 3.4); in the explorer the light globe plays in its `fast` mode.
      // Everywhere, "Now" follows the wall clock, which moves the sun 0.004
      // deg a second: a redraw every frame for that would be all cost, so
      // ticks under 15 s of clock time wait. Every other change (mode,
      // follow, data) draws at once, and G1 keeps its own loop.
      const clockOnly = Object.keys(next).every((k) => k === "utcHour" || (k === "mode" && next.mode === state.mode));
      const prev = lastDrawnHour;
      Object.assign(state, next);
      if ("follow" in next) viewChanged();
      if (clockOnly && next.utcHour != null && prev != null && !usesG1()) {
        if (phoneStill() && Math.floor(next.utcHour) === Math.floor(prev)) return;
        if (Math.abs(next.utcHour - prev) < 1 / 240) return;
        render({ fast: isLight() && Boolean(phoneQuery?.matches) });
        return;
      }
      render();
    },
    /** Enter or leave the phone explorer (src/components/explorer.js). */
    setExplorer(on) {
      state.exploring = Boolean(on);
      if (!state.exploring) {
        state.dragging = false;
        lightDrag = null;
        canvas.classList.remove("is-dragging");
      }
      render();
    },
    zoomIn()  { if (isDark()) zoomDark(1.5); else applyZoom(1.25); },
    zoomOut() { if (isDark()) zoomDark(1 / 1.5); else applyZoom(1 / 1.25); },
    resetZoom() { state.zoomScale = 1.0; initial.onZoomChange?.(1.0); render(); },
    /** Dark: back to the stage's view - no zoom, the home tilt, following the sun. */
    resetView() {
      state.darkView = { zoom: 1, tx: 0, ty: 0 };
      state.darkLat0 = FOLLOW_SUN.dark.lat0;
      state.follow = true;
      viewChanged();
      render();
    },
    setZoom(s) { applyZoom(s / state.zoomScale); },
    destroy() {
      stopLoop();
      clearTimeout(settleTimer);
      clearTimeout(describeTimer);
      io?.disconnect();
      window.removeEventListener("themechange", refreshTokens);
      document.removeEventListener("visibilitychange", onVisibility);
      resizeObserver.disconnect();
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("gesturestart", onGestureStart);
      canvas.removeEventListener("gesturechange", onGestureChange);
    }
  };
}
