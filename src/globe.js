import * as d3 from "npm:d3";
import * as topojson from "npm:topojson-client";
import { regionGWAtHour, generationGWAtHour } from "./lib/calc.js";
import { showsWastePillar, wasteStatusOf } from "./lib/waste-status.js";
import { getRegionFuelColor } from "./lib/fuel.js";
import { readGlobeTokens } from "./lib/theme-tokens.js";
import { buildPillarUnits } from "./lib/pillar-layout.js";
import { qualityBucket, qualityOpacity, dotStyleFor } from "./lib/region-quality.js";
import { wrapLongitude, easeOutCubic } from "./lib/globe-geo.js";

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

// The land matrix is the globe's main texture, so its density has to track
// how large the globe is actually drawn. At a fixed 2.5deg the dots spread
// out and stop reading as a surface above roughly 700px — the continents
// dissolve into scattered specks. Step is chosen once per mount from the
// canvas size and floored at 1.8deg: finer than that the one-off
// geoContains filter below costs more main-thread time than the extra
// fidelity is worth.
function gridStepFor(size) {
  if (size >= 820) return 1.8;
  if (size >= 560) return 2.1;
  return 2.5;
}

function precomputeLandDots(countries, step) {
  const key = step.toFixed(2);
  const cached = landDotsByStep.get(key);
  if (cached) return cached;
  const dots = [];
  for (let lat = -80; lat <= 80; lat += step) {
    const cos = Math.cos((lat * Math.PI) / 180);
    const lonStep = step / Math.max(cos, 0.2);
    for (let lon = -180; lon <= 180; lon += lonStep) {
      dots.push([lon, lat]);
    }
  }
  const filtered = dots.filter(([lon, lat]) => {
    for (const feature of countries.features) {
      if (d3.geoContains(feature, [lon, lat])) return true;
    }
    return false;
  });
  landDotsByStep.set(key, filtered);
  return filtered;
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
  // Callouts name the largest curtailments on the face you can currently see.
  // Off by default so the paper's embed stays a bare globe.
  const showCallouts = initial.showCallouts === true;
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

  function refreshTokens() {
    tokens = readGlobeTokens(document.documentElement);
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

  // --- Callout selection -----------------------------------------------
  // Which regions get named is re-picked on a slow cadence, not per frame:
  // at 60fps the top-N set flickers as pillars cross the horizon and labels
  // visibly reshuffle. Positions still track their own pillar every frame,
  // so a label stays glued to the pillar it names while the globe turns.
  const CALLOUT_MAX = 6;
  const CALLOUT_REPICK_MS = 1400;
  const CALLOUT_MIN_SEP_PX = 44;
  let calloutIds = [];
  let calloutPickedAt = -Infinity;

  /**
   * Name the largest curtailments on the visible face: a short leader line
   * from each pillar tip out to a label parked in the left or right gutter.
   * Labels are spread vertically so they never overlap each other.
   */
  function drawCallouts(ctx, pool, geom, width, height, now) {
    if (now - calloutPickedAt > CALLOUT_REPICK_MS || calloutIds.length === 0) {
      calloutIds = pool
        .sort((a, b) => b.gw - a.gw)
        .slice(0, CALLOUT_MAX)
        .map((c) => c.id);
      calloutPickedAt = now;
    }
    const items = [];
    for (const id of calloutIds) {
      const g = geom.get(id);
      if (g) items.push({ ...g, side: g.x < width / 2 ? "left" : "right" });
    }
    const GUTTER = 104;
    for (const side of ["left", "right"]) {
      const col = items.filter((i) => i.side === side).sort((a, b) => a.y - b.y);
      let last = -Infinity;
      for (const i of col) {
        i.labelY = Math.max(i.y, last + CALLOUT_MIN_SEP_PX);
        last = i.labelY;
      }
    }
    ctx.save();
    ctx.setLineDash([]);
    for (const i of items) {
      if (i.labelY < 18 || i.labelY > height - 18) continue;
      const elbowX = i.x + i.dx * 16;
      const elbowY = i.y + i.dy * 16;
      const labelX = i.side === "left" ? GUTTER : width - GUTTER;
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = tokens.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(i.x, i.y);
      ctx.lineTo(elbowX, elbowY);
      ctx.lineTo(labelX, i.labelY);
      ctx.stroke();
      ctx.fillStyle = i.color;
      ctx.beginPath();
      ctx.arc(elbowX, elbowY, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.textAlign = i.side === "left" ? "right" : "left";
      const tx = labelX + (i.side === "left" ? -9 : 9);
      ctx.font = '11px "IBM Plex Mono", ui-monospace, monospace';
      ctx.fillStyle = `rgba(${tokens.dotDayRGB}, 0.95)`;
      ctx.fillText(i.name, tx, i.labelY - 5);
      ctx.font = '13px "IBM Plex Mono", ui-monospace, monospace';
      ctx.fillStyle = i.color;
      ctx.fillText(`${i.gw.toFixed(i.gw >= 1 ? 1 : 2)} GW`, tx, i.labelY + 12);
    }
    ctx.restore();
  }

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

  function render() {
    const renderNow = performance.now();
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    const size = Math.min(width, height);
    if (!width || !height) return;

    const projection = d3.geoOrthographic()
      .scale(size * 0.46 * state.zoomScale)
      .translate([width / 2, height / 2])
      .clipAngle(90)
      .rotate(state.rotation);
    const path = d3.geoPath(projection, ctx);
    const center = [-state.rotation[0], -state.rotation[1]];
    const hour = ((state.utcHour % 24) + 24) % 24;
    const sunLng = wrapLongitude((12 - hour) * 15);
    const now = new Date();
    const start = Date.UTC(now.getUTCFullYear(), 0, 0);
    const diff = now.getTime() - start;
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
    const sunLat = 23.45 * Math.sin((2 * Math.PI * (dayOfYear - 81)) / 365);
    const antiSolarLng = wrapLongitude(sunLng + 180);
    const sunScreen = projection([sunLng, sunLat]);

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // One flat ocean fill. The radial day wash and the night-overlay wash
    // that used to sit on top are gone: they tinted the whole sphere the
    // same hue as the solar pillars, which is what made the globe read as a
    // single warm haze. Day and night are now carried entirely by the land
    // matrix below, so the only saturated thing on the sphere is fuel colour.
    ctx.beginPath();
    path({ type: "Sphere" });
    ctx.fillStyle = tokens.oceanHex;
    ctx.fill();

    const dotPx = size >= 820 ? 1.8 : 1.5;
    const dotHalf = dotPx / 2;
    for (const [lon, lat] of dots) {
      const dist = d3.geoDistance([lon, lat], center);
      if (dist > Math.PI / 2 - 0.02) continue;
      const point = projection([lon, lat]);
      if (!point) continue;
      // Hard terminator rather than a falloff: a dot is lit or it is not.
      // The unlit side stays warm and bright (amber, not grey) so the
      // continents read across the whole face instead of fading out.
      const solarAngle = d3.geoDistance([lon, lat], [sunLng, sunLat]);
      const lit = Math.cos(solarAngle) > 0.12;
      ctx.fillStyle = lit
        ? `rgba(${tokens.dotDayRGB}, 0.97)`
        : `rgba(${tokens.dotNightRGB}, 0.95)`;
      ctx.fillRect(point[0] - dotHalf, point[1] - dotHalf, dotPx, dotPx);
    }

    ctx.beginPath();
    path({
      type: "GeometryCollection",
      geometries: countries.features.map((feature) => feature.geometry)
    });
    ctx.strokeStyle = tokens.border;
    ctx.lineWidth = 0.4;
    ctx.stroke();

    ctx.beginPath();
    path({ type: "Sphere" });
    ctx.strokeStyle = tokens.border;
    ctx.lineWidth = 0.8;
    ctx.stroke();

    const pillarUnits = buildPillarUnitsForState();
    const visibleThisFrame = new Set();
    const calloutPool = [];
    const calloutGeom = new Map();

    for (const unit of pillarUnits) {
      const group = unit.regions;
      const rep = group[0];
      // Compute total GW across all members of this unit.
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
      const totalGW = showWaste ? totalWasteGW : Math.max(totalGenGW, unpublished ? 0.05 : 0);

      const dist = d3.geoDistance([rep.lon, rep.lat], center);
      if (dist > Math.PI / 2) continue;
      const point = projection([rep.lon, rep.lat]);
      if (!point) continue;
      // Only well inside the limb: a label on a pillar at the very edge
      // points off the disc and its leader line crosses the whole globe.
      if (showCallouts && showWaste && dist < Math.PI / 2 * 0.86) {
        calloutPool.push({ id: rep.id, name: rep.name, gw: totalWasteGW });
      }

      // Birth animation: first time a region crosses the horizon, scale it
      // from 0 → 1 over BIRTH_MS so it emerges rather than snapping in.
      const repId = rep.id;
      visibleThisFrame.add(repId);
      if (!pillarBirthTimes.has(repId)) {
        pillarBirthTimes.set(repId, renderNow);
      }
      const birthT = easeOutCubic(
        Math.min(1, (renderNow - pillarBirthTimes.get(repId)) / BIRTH_MS)
      );

      // Anchor for this unit: original projection point shifted horizontally
      // on screen by offsetPx so co-located wind/solar pairs render as
      // adjacent tappable pillars 44px apart (WCAG 2.5.5).
      const anchorX = point[0] + unit.offsetPx;
      const anchorY = point[1];

      const visible = 1 - dist / (Math.PI / 2);
      const weight = Math.sqrt(totalGW);
      // Kept only as the radius of the selection ring; nothing is drawn with
      // a blur any more.
      const glowR = (4 + weight * 5) * birthT;
      const coreR = (1.5 + weight * 0.8) * birthT;
      const centreX = width / 2;
      const centreY = height / 2;
      // Sun dimming is gone. The land matrix already states day from night;
      // dimming the pillars by it as well double-dimmed the night side and
      // hid real curtailment. Confidence (qualityOpacity) and limb distance
      // are the only things allowed to touch pillar opacity.

      // Dominant color for glow + core dot.
      const repData = state.regionData[rep.id];
      const domColor = getRegionFuelColor(rep, repData);

      // Data-quality opacity: measured brightest → estimated dimmest.
      // A degraded (stale >24h) live feed dims to estimated level; the amber
      // dot-ring (drawn below) is the actual freshness alarm. Fuel hue on the
      // pillar body is preserved in every state.
      const repBucket = qualityBucket(rep, repData);
      const repDegraded = repData?.sourceStatus === "degraded";
      const repDotStyle = dotStyleFor(repBucket, repData?.sourceStatus);
      const pillarAlpha = qualityOpacity(repDegraded ? "estimated" : repBucket);

      if (showGen) {
        const genWeight = Math.sqrt(Math.max(totalGenGW, unpublished ? 0.05 : 0));
        const genR = (5.5 + genWeight * 3.5) * birthT;
        ctx.save();
        ctx.globalAlpha = pillarAlpha * visible * 0.55;
        ctx.strokeStyle = unpublished && totalGenGW <= 0.01 ? tokens.border : domColor;
        ctx.lineWidth = unpublished && totalGenGW <= 0.01 ? 1.1 : 1.7;
        if (unpublished && totalGenGW <= 0.01) ctx.setLineDash([2.5, 2.5]);
        ctx.beginPath();
        ctx.arc(anchorX, anchorY, genR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Outward direction from globe centre is anchored at the original
      // projection point so all offset pillars within a bucket lean the
      // same way (parallel bars 44px apart on screen).
      let dx = point[0] - centreX;
      let dy = point[1] - centreY;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (showWaste && len > 0.1) {
        dx /= len;
        dy /= len;
        const pillarH = (3 + weight * 48) * birthT;
        const pillarW = 3;

        if (showCallouts) {
          calloutGeom.set(rep.id, {
            x: anchorX + dx * pillarH, y: anchorY + dy * pillarH,
            dx, dy, color: domColor, gw: totalWasteGW, name: rep.name,
          });
        }
        if (group.length === 1) {
          // Single-fuel pillar: one flat stroke, butt cap, no base-to-tip
          // gradient. The keyline underneath is what keeps a solar pillar
          // legible where it crosses the lit (near-white) or unlit (amber)
          // land — both are close enough to solar gold to swallow it.
          const tipX = anchorX + dx * pillarH;
          const tipY = anchorY + dy * pillarH;
          ctx.globalAlpha = pillarAlpha * visible;
          ctx.lineCap = "butt";
          ctx.strokeStyle = tokens.keyline;
          ctx.lineWidth = pillarW + 2.5;
          ctx.beginPath();
          ctx.moveTo(anchorX, anchorY);
          ctx.lineTo(tipX, tipY);
          ctx.stroke();
          ctx.strokeStyle = domColor;
          ctx.lineWidth = pillarW;
          ctx.beginPath();
          ctx.moveTo(anchorX, anchorY);
          ctx.lineTo(tipX, tipY);
          ctx.stroke();
        } else {
          // Stacked composite pillar: draw one segment per member, proportional to GW.
          // Sort by GW descending so the largest fuel is at the base.
          const segments = group
            .map((r, i) => ({ region: r, gw: gwByRegion[i] }))
            .filter((s) => s.gw > 0)
            .sort((a, b) => b.gw - a.gw);
          let segStart = 0;
          for (const seg of segments) {
            const segFrac = seg.gw / totalGW;
            const segLen = pillarH * segFrac;
            const segStartX = anchorX + dx * segStart;
            const segStartY = anchorY + dy * segStart;
            const segEndX = segStartX + dx * segLen;
            const segEndY = segStartY + dy * segLen;
            const segData = state.regionData[seg.region.id];
            const segColor = getRegionFuelColor(seg.region, segData);
            const segBucket = qualityBucket(seg.region, segData);
            const segDegraded = segData?.sourceStatus === "degraded";
            const segAlpha = qualityOpacity(segDegraded ? "estimated" : segBucket);
            ctx.globalAlpha = segAlpha * visible;
            ctx.lineCap = "butt";
            ctx.strokeStyle = tokens.keyline;
            ctx.lineWidth = pillarW + 2.5;
            ctx.beginPath();
            ctx.moveTo(segStartX, segStartY);
            ctx.lineTo(segEndX, segEndY);
            ctx.stroke();
            ctx.strokeStyle = segColor;
            ctx.lineWidth = pillarW;
            ctx.beginPath();
            ctx.moveTo(segStartX, segStartY);
            ctx.lineTo(segEndX, segEndY);
            ctx.stroke();
            segStart += segLen;
          }
        }
      }

      ctx.globalAlpha = pillarAlpha * visible;
      // Casing first, so a region dot never merges into the land beneath it.
      ctx.fillStyle = tokens.keyline;
      ctx.beginPath();
      ctx.arc(anchorX, anchorY, coreR + 1.1, 0, Math.PI * 2);
      ctx.fill();
      if (repDotStyle === "hollow") {
        // Estimated: outline ring only, no fill — reads as "not measured".
        ctx.strokeStyle = domColor;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(anchorX, anchorY, coreR, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Measured / anchored / degraded: filled core in fuel hue.
        ctx.fillStyle = domColor;
        ctx.beginPath();
        ctx.arc(anchorX, anchorY, coreR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = tokens.keyline;
        ctx.lineWidth = 0.6;
        ctx.stroke();
        if (repDotStyle === "ringed") {
          // Anchored: thin concentric ring around the filled core.
          ctx.strokeStyle = tokens.dotDayRGB ? `rgba(${tokens.dotDayRGB}, 0.7)` : "rgba(255,248,224,0.7)";
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.arc(anchorX, anchorY, coreR + 2, 0, Math.PI * 2);
          ctx.stroke();
        } else if (repDotStyle === "degraded") {
          // Stale live feed: amber dashed warning ring (the freshness alarm).
          ctx.save();
          ctx.strokeStyle = tokens.qualityWarning;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.arc(anchorX, anchorY, coreR + 2.5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      if (rep.id === state.selectedRegionId) {
        ctx.save();
        ctx.globalAlpha = pillarAlpha * 0.9;
        ctx.strokeStyle = "#7cb8ff";
        ctx.lineWidth = 2.2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(anchorX, anchorY, glowR + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    if (showCallouts) drawCallouts(ctx, calloutPool, calloutGeom, width, height, renderNow);

    // Update birth-animation state for next frame.
    // Any region that was visible last frame but not this frame has rotated
    // back over the horizon — remove its birth time so it re-animates on
    // the next appearance.
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
