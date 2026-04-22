import * as d3 from "npm:d3";
import * as topojson from "npm:topojson-client";

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

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    ctx.beginPath();
    path({ type: "Sphere" });
    ctx.fillStyle = "#0a1114";
    ctx.fill();

    const gradient = ctx.createRadialGradient(
      width * 0.35,
      height * 0.35,
      size * 0.08,
      width / 2,
      height / 2,
      size * 0.5
    );
    gradient.addColorStop(0, "rgba(30, 55, 60, 0.25)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    path({ type: "Sphere" });
    ctx.fill();

    ctx.fillStyle = "rgba(20, 175, 172, 0.55)";
    for (const [lon, lat] of dots) {
      const dist = d3.geoDistance([lon, lat], center);
      if (dist > Math.PI / 2 - 0.02) continue;
      const point = projection([lon, lat]);
      if (!point) continue;
      const fade = 1 - dist / (Math.PI / 2);
      ctx.globalAlpha = 0.25 + fade * 0.6;
      ctx.fillRect(point[0] - 0.6, point[1] - 0.6, 1.4, 1.4);
    }
    ctx.globalAlpha = 1;

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

    const hour = Math.floor(state.utcHour % 24);
    for (const region of state.regions) {
      const gw = state.regionData[region.id]?.profile?.[hour] ?? 0;
      if (gw <= 0.01) continue;
      const dist = d3.geoDistance([region.lon, region.lat], center);
      if (dist > Math.PI / 2) continue;
      const point = projection([region.lon, region.lat]);
      if (!point) continue;

      const visible = 1 - dist / (Math.PI / 2);
      const color = region.kind === "flare" ? "#f7931a" : "#14afac";
      const weight = Math.sqrt(gw);
      const glowR = 4 + weight * 5;
      const coreR = 1.5 + weight;

      ctx.save();
      ctx.filter = "blur(4px)";
      ctx.globalAlpha = 0.45 * visible;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(point[0], point[1], glowR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.globalAlpha = visible;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(point[0], point[1], coreR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  let activePointerId = null;
  canvas.addEventListener("pointerdown", (event) => {
    state.dragging = true;
    activePointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!state.dragging) return;
    state.rotation[0] += event.movementX * 0.3;
    state.rotation[1] = Math.max(-90, Math.min(90, state.rotation[1] - event.movementY * 0.3));
    render();
  });

  function releasePointer(event) {
    if (activePointerId !== event.pointerId) return;
    state.dragging = false;
    activePointerId = null;
    if (canvas.hasPointerCapture(event.pointerId)) {
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
      if (!state.dragging) state.rotation[0] += 0.03;
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
