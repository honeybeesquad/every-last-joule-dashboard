import * as d3 from "npm:d3";
import * as topojson from "npm:topojson-client";
import { regionGWAtHour } from "./lib/calc.js";
import { getRegionFuelColor } from "./lib/fuel.js";
import { readGlobeTokens, isLinearGradientToken } from "./lib/theme-tokens.js";
import { buildPillarUnits } from "./lib/pillar-layout.js";
import { qualityBucket, qualityOpacity, dotStyleFor } from "./lib/region-quality.js";

// Locally-vendored world atlas: previously fetched from unpkg.com, which
// added a third-party DNS + TLS handshake (~200–400ms on cellular) to
// every cold page load. Served from our own origin now via FileAttachment.
let countriesPromise;
let landDots;

async function loadCountries(topologyUrl) {
  if (!countriesPromise) {
    countriesPromise = fetch(topologyUrl)
      .then((response) => response.json())
      .then((topology) => topojson.feature(topology, topology.objects.countries));
  }
  return countriesPromise;
}

function precomputeLandDots(countries) {
  if (landDots) return landDots;
  const dots = [];
  for (let lat = -80; lat <= 80; lat += 2.5) {
    const cos = Math.cos((lat * Math.PI) / 180);
    const lonStep = 2.5 / Math.max(cos, 0.2);
    for (let lon = -180; lon <= 180; lon += lonStep) {
      dots.push([lon, lat]);
    }
  }
  landDots = dots.filter(([lon, lat]) => {
    for (const feature of countries.features) {
      if (d3.geoContains(feature, [lon, lat])) return true;
    }
    return false;
  });
  return landDots;
}

export async function mountGlobe(canvas, initial) {
  const ctx = canvas.getContext("2d");
  const countries = await loadCountries(initial.topologyUrl);
  const dots = precomputeLandDots(countries);
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

  function refreshTokens() {
    tokens = readGlobeTokens(document.documentElement);
    // Force a redraw so the next paint uses the new colours immediately.
    render();
  }

  window.addEventListener("themechange", refreshTokens);

  // --- Pillar unit cache ---
  // buildPillarUnits allocates a new Map + sorted arrays each call.
  // At 60fps that's GC pressure on every frame for no reason — the input
  // only changes when state.regions is replaced.
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

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
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

    ctx.beginPath();
    path({ type: "Sphere" });
    ctx.fillStyle = tokens.spherebaseHex;
    ctx.fill();

    if (sunScreen) {
      const gradient = ctx.createRadialGradient(
        sunScreen[0],
        sunScreen[1],
        size * 0.04,
        sunScreen[0],
        sunScreen[1],
        size * 0.55
      );
      gradient.addColorStop(0,    tokens.dayGradient1);
      gradient.addColorStop(0.45, tokens.dayGradient2);
      gradient.addColorStop(1,    tokens.dayGradient3);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      path({ type: "Sphere" });
      ctx.fill();
    }

    ctx.beginPath();
    path(d3.geoCircle().center([antiSolarLng, -sunLat]).radius(90)());
    if (isLinearGradientToken(tokens.nightOverlay)) {
      // A theme may use a CSS linear-gradient() for --night-overlay,
      // which canvas can't consume as a fillStyle; reproduce it here.
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const cosA = Math.cos((135 * Math.PI) / 180);
      const sinA = Math.sin((135 * Math.PI) / 180);
      const x0 = w / 2 - (w * cosA) / 2;
      const y0 = h / 2 - (h * sinA) / 2;
      const x1 = w / 2 + (w * cosA) / 2;
      const y1 = h / 2 + (h * sinA) / 2;
      const grad = ctx.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0, "rgba(40,30,20,0.30)");
      grad.addColorStop(1, "rgba(15,10,5,0.55)");
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = tokens.nightOverlay;
    }
    ctx.fill();

    for (const [lon, lat] of dots) {
      const dist = d3.geoDistance([lon, lat], center);
      if (dist > Math.PI / 2 - 0.02) continue;
      const point = projection([lon, lat]);
      if (!point) continue;
      const fade = 1 - dist / (Math.PI / 2);
      const solarAngle = d3.geoDistance([lon, lat], [sunLng, sunLat]);
      const sunlit = Math.max(0, Math.cos(solarAngle));
      const brightness = 0.30 + fade * 0.10 + Math.pow(sunlit, 0.7) * 0.60;
      const dotRGB = sunlit > 0.3 ? tokens.dotDayRGB : tokens.dotNightRGB;
      ctx.fillStyle = `rgba(${dotRGB}, ${brightness})`;
      ctx.fillRect(point[0] - 0.6, point[1] - 0.6, 1.4, 1.4);
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

    for (const unit of pillarUnits) {
      const group = unit.regions;
      const rep = group[0];
      // Compute total GW across all members of this unit.
      const gwByRegion = group.map((r) => {
        const data = state.regionData[r.id];
        return data ? Math.max(0, regionGWAtHour(data, hour, state.mode)) : 0;
      });
      const totalGW = gwByRegion.reduce((s, g) => s + g, 0);
      if (totalGW <= 0.01) continue;

      const dist = d3.geoDistance([rep.lon, rep.lat], center);
      if (dist > Math.PI / 2) continue;
      const point = projection([rep.lon, rep.lat]);
      if (!point) continue;

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
      const glowR = (4 + weight * 5) * birthT;
      const coreR = (1.5 + weight * 0.8) * birthT;
      const centreX = width / 2;
      const centreY = height / 2;
      const solarAngle = d3.geoDistance([rep.lon, rep.lat], [sunLng, sunLat]);
      const sunlit = Math.max(0, Math.cos(solarAngle));
      const sunDim = 0.6 + 0.4 * Math.max(0, sunlit);

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

      ctx.save();
      ctx.filter = "blur(4px)";
      ctx.globalAlpha = pillarAlpha * 0.45 * visible;
      ctx.fillStyle = domColor;
      ctx.beginPath();
      ctx.arc(anchorX, anchorY, glowR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Outward direction from globe centre is anchored at the original
      // projection point so all offset pillars within a bucket lean the
      // same way (parallel bars 44px apart on screen).
      let dx = point[0] - centreX;
      let dy = point[1] - centreY;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0.1) {
        dx /= len;
        dy /= len;
        const pillarH = (3 + weight * 48) * birthT;
        const pillarW = 3;

        if (group.length === 1) {
          // Single-fuel pillar: same gradient style as before.
          const tipX = anchorX + dx * pillarH;
          const tipY = anchorY + dy * pillarH;
          const pillarGradient = ctx.createLinearGradient(anchorX, anchorY, tipX, tipY);
          pillarGradient.addColorStop(0, `${domColor}${tokens.pillarBaseAlpha}`);
          pillarGradient.addColorStop(1, domColor);
          ctx.strokeStyle = pillarGradient;
          ctx.lineWidth = pillarW;
          ctx.lineCap = "round";
          ctx.globalAlpha = pillarAlpha * visible * sunDim;
          ctx.beginPath();
          ctx.moveTo(anchorX, anchorY);
          ctx.lineTo(tipX, tipY);
          ctx.stroke();

          ctx.save();
          ctx.filter = "blur(3px)";
          ctx.globalAlpha = pillarAlpha * 0.5 * visible * sunDim;
          ctx.fillStyle = domColor;
          ctx.beginPath();
          ctx.arc(tipX, tipY, pillarW * 1.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
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
            const isBase = segStart === 0;
            const isTip = segStart + segLen >= pillarH - 0.5;
            const grad = ctx.createLinearGradient(segStartX, segStartY, segEndX, segEndY);
            grad.addColorStop(0, isBase ? `${segColor}${tokens.pillarBaseAlpha}` : segColor);
            grad.addColorStop(1, segColor);
            ctx.strokeStyle = grad;
            ctx.lineWidth = pillarW;
            ctx.lineCap = isTip ? "round" : "butt";
            ctx.globalAlpha = segAlpha * visible * sunDim;
            ctx.beginPath();
            ctx.moveTo(segStartX, segStartY);
            ctx.lineTo(segEndX, segEndY);
            ctx.stroke();
            if (isTip) {
              ctx.save();
              ctx.filter = "blur(3px)";
              ctx.globalAlpha = segAlpha * 0.5 * visible * sunDim;
              ctx.fillStyle = segColor;
              ctx.beginPath();
              ctx.arc(segEndX, segEndY, pillarW * 1.6, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
            segStart += segLen;
          }
        }
      }

      ctx.globalAlpha = pillarAlpha * visible;
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
        ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
        ctx.lineWidth = 0.6;
        ctx.stroke();
        if (repDotStyle === "ringed") {
          // Anchored: thin concentric ring around the filled core.
          ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
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

function wrapLongitude(value) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}
