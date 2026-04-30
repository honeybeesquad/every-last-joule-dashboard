import * as d3 from "npm:d3";
import * as topojson from "npm:topojson-client";
import { regionGWAtHour } from "./lib/calc.js";
import { getFuelColor, dominantFuel } from "./lib/fuel.js";
import { readGlobeTokens, isLinearGradientToken } from "./lib/theme-tokens.js";

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
    rotation: [-10, -15, 0],
    dragging: false,
    zoomScale: 1.0,
    showFlare: false
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

  /**
   * Hit-test: given client coords, return the closest rendered hotspot region
   * within `threshold` pixels that sits on the near hemisphere, or null.
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

    let best = null;
    let bestDist2 = threshold * threshold;
    for (const region of state.regions) {
      if (region.kind === "flare" && !state.showFlare) continue;
      const dist = d3.geoDistance([region.lon, region.lat], centerLngLat);
      if (dist > Math.PI / 2) continue; // far side of globe
      const point = projection([region.lon, region.lat]);
      if (!point) continue;
      const dx = point[0] - px;
      const dy = point[1] - py;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist2) {
        bestDist2 = d2;
        best = region;
      }
    }
    return best;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    render();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  function render() {
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
      // Eclipse uses a CSS linear-gradient(135deg, …) which canvas
      // can't consume as a fillStyle string; reproduce it as a canvas
      // gradient spanning the bounding box of the screen.
      // NB: stops here must mirror --night-overlay in :root[data-theme="eclipse"]
      // (in src/style.css). If you change one, change both.
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

    for (const region of state.regions) {
      // Flare regions are renewable-dashboard-excluded: not scored in the
      // headline, not bucketed in hotspot columns. They can be toggled
      // visible via the flare button; hidden by default.
      if (region.kind === "flare" && !state.showFlare) continue;
      const data = state.regionData[region.id];
      const gw = data ? regionGWAtHour(data, hour, state.mode) : 0;
      if (gw <= 0.01) continue;
      const dist = d3.geoDistance([region.lon, region.lat], center);
      if (dist > Math.PI / 2) continue;
      const point = projection([region.lon, region.lat]);
      if (!point) continue;

      const visible = 1 - dist / (Math.PI / 2);
      const color = region.kind === "flare"
        ? getFuelColor("flare")
        : getFuelColor(dominantFuel(region, data));
      const weight = Math.sqrt(gw);
      const glowR = 4 + weight * 5;
      const coreR = 1.5 + weight * 0.8;
      const centreX = width / 2;
      const centreY = height / 2;
      const solarAngle = d3.geoDistance([region.lon, region.lat], [sunLng, sunLat]);
      const sunlit = Math.max(0, Math.cos(solarAngle));
      const sunDim = 0.6 + 0.4 * Math.max(0, sunlit);

      ctx.save();
      ctx.filter = "blur(4px)";
      ctx.globalAlpha = 0.45 * visible;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(point[0], point[1], glowR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      let dx = point[0] - centreX;
      let dy = point[1] - centreY;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0.1) {
        dx /= len;
        dy /= len;
        const pillarH = 3 + weight * 48;
        const pillarW = 3;
        const tipX = point[0] + dx * pillarH;
        const tipY = point[1] + dy * pillarH;
        const pillarGradient = ctx.createLinearGradient(point[0], point[1], tipX, tipY);
        // Base of pillar (at the hotspot) used to be 0x66 = 40% alpha, which
        // made the lower half of every spike fade out — pillars read as too
        // dim across all three themes. Bump to a theme-scoped --pillar-base-alpha
        // (sunfire/eclipse 0x99 ≈ 60%, vellum 0xee ≈ 93%) so each theme tunes its
        // own pillar boldness against its own day-side gradient. globalAlpha is
        // pinned to 1.0 so tips render at full token brightness.
        pillarGradient.addColorStop(0, `${color}${tokens.pillarBaseAlpha}`);
        pillarGradient.addColorStop(1, color);
        ctx.strokeStyle = pillarGradient;
        ctx.lineWidth = pillarW;
        ctx.lineCap = "round";
        ctx.globalAlpha = 1.0 * visible * sunDim;
        ctx.beginPath();
        ctx.moveTo(point[0], point[1]);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();

        ctx.save();
        ctx.filter = "blur(3px)";
        ctx.globalAlpha = 0.5 * visible * sunDim;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(tipX, tipY, pillarW * 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.globalAlpha = visible;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(point[0], point[1], coreR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 0.6;
      ctx.stroke();
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
  const CLICK_MAX_TRAVEL_PX = 5; // pointer travel threshold below which we treat as click, not drag

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

  // Mobile/battery optimisations:
  // - Skip rendering when the tab is backgrounded (visibilitychange).
  // - Throttle auto-rotation to ~30 FPS on narrow viewports. Rotating 0.06°
  //   per 33ms looks identical to 0.03° per 16ms but halves CPU/GPU work.
  //   On touch devices where every joule of battery counts this matters.
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const mobileMQ = window.matchMedia?.("(max-width: 900px), (hover: none)");
  let targetFrameMs = mobileMQ?.matches ? 33 : 16;
  mobileMQ?.addEventListener?.("change", (e) => {
    targetFrameMs = e.matches ? 33 : 16;
  });

  let rafId = null;
  let lastFrameTs = 0;

  const tick = (now) => {
    rafId = null;
    if (document.hidden) return; // visibilitychange will resume us
    if (now - lastFrameTs >= targetFrameMs) {
      if (!state.dragging && now >= autoResumeAt) {
        // Scale rotation step so visual speed is frame-rate-independent.
        const step = 0.03 * ((now - lastFrameTs) / 16);
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
      document.removeEventListener("visibilitychange", onVisibility);
      resizeObserver.disconnect();
      canvas.removeEventListener("wheel", onWheel);
    }
  };
}

function wrapLongitude(value) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}
