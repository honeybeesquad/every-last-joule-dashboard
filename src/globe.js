import * as d3 from "npm:d3";
import * as topojson from "npm:topojson-client";
import { regionGWAtHour } from "./lib/calc.js";
import { FUEL_COLOR, dominantFuel } from "./lib/fuel.js";

const FLARE_COLOR = "#f7931a";

const WORLD_TOPOLOGY_URL = "https://unpkg.com/world-atlas@2/countries-110m.json";
let countriesPromise;
let landDots;

async function loadCountries() {
  if (!countriesPromise) {
    countriesPromise = fetch(WORLD_TOPOLOGY_URL)
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
  const countries = await loadCountries();
  const dots = precomputeLandDots(countries);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const state = {
    regions: initial.regions,
    regionData: initial.regionData,
    utcHour: initial.utcHour,
    mode: initial.mode ?? "avg30d",
    rotation: [-10, -15, 0],
    dragging: false
  };

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
      .scale(size * 0.46)
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
    ctx.fillStyle = "#0a1114";
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
      gradient.addColorStop(0, "rgba(90, 150, 160, 0.75)");
      gradient.addColorStop(0.45, "rgba(40, 80, 90, 0.35)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      path({ type: "Sphere" });
      ctx.fill();
    }

    ctx.beginPath();
    path(d3.geoCircle().center([antiSolarLng, -sunLat]).radius(90)());
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fill();

    for (const [lon, lat] of dots) {
      const dist = d3.geoDistance([lon, lat], center);
      if (dist > Math.PI / 2 - 0.02) continue;
      const point = projection([lon, lat]);
      if (!point) continue;
      const fade = 1 - dist / (Math.PI / 2);
      const solarAngle = d3.geoDistance([lon, lat], [sunLng, sunLat]);
      const sunlit = Math.max(0, Math.cos(solarAngle));
      const brightness = 0.05 + fade * 0.12 + Math.pow(sunlit, 0.7) * 0.85;
      ctx.fillStyle = `rgba(20, 175, 172, ${brightness})`;
      ctx.fillRect(point[0] - 0.6, point[1] - 0.6, 1.4, 1.4);
    }

    ctx.beginPath();
    path({
      type: "GeometryCollection",
      geometries: countries.features.map((feature) => feature.geometry)
    });
    ctx.strokeStyle = "rgba(20, 175, 172, 0.22)";
    ctx.lineWidth = 0.4;
    ctx.stroke();

    ctx.beginPath();
    path({ type: "Sphere" });
    ctx.strokeStyle = "rgba(20, 175, 172, 0.25)";
    ctx.lineWidth = 0.8;
    ctx.stroke();

    for (const region of state.regions) {
      const data = state.regionData[region.id];
      const gw = data ? regionGWAtHour(data, hour, state.mode) : 0;
      if (gw <= 0.01) continue;
      const dist = d3.geoDistance([region.lon, region.lat], center);
      if (dist > Math.PI / 2) continue;
      const point = projection([region.lon, region.lat]);
      if (!point) continue;

      const visible = 1 - dist / (Math.PI / 2);
      const color = region.kind === "flare" ? FLARE_COLOR : FUEL_COLOR[dominantFuel(region)];
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
        pillarGradient.addColorStop(0, `${color}66`);
        pillarGradient.addColorStop(1, color);
        ctx.strokeStyle = pillarGradient;
        ctx.lineWidth = pillarW;
        ctx.lineCap = "round";
        ctx.globalAlpha = 0.95 * visible * sunDim;
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
  let lastMoveAt = 0;
  let autoResumeAt = 0;
  const DRAG_SENSITIVITY = 0.55;
  const AUTO_RESUME_DELAY_MS = 2500;

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    state.dragging = true;
    activePointerId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    lastMoveAt = event.timeStamp;
    canvas.classList.add("is-dragging");
    try { canvas.setPointerCapture(event.pointerId); } catch {}
  });

  canvas.addEventListener("pointermove", (event) => {
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
    if (activePointerId !== event.pointerId) return;
    state.dragging = false;
    activePointerId = null;
    autoResumeAt = performance.now() + AUTO_RESUME_DELAY_MS;
    canvas.classList.remove("is-dragging");
    if (canvas.hasPointerCapture?.(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);
  canvas.addEventListener("pointerleave", (event) => {
    if (state.dragging && event.buttons === 0) {
      releasePointer(event);
    }
  });

  resize();

  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (!prefersReducedMotion) {
    const tick = () => {
      const now = performance.now();
      if (!state.dragging && now >= autoResumeAt) {
        state.rotation[0] = wrapLongitude(state.rotation[0] + 0.03);
      }
      render();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  } else {
    render();
  }

  return {
    update(next) {
      Object.assign(state, next);
      render();
    },
    destroy() {
      resizeObserver.disconnect();
    }
  };
}

function wrapLongitude(value) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}
