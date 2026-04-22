import { useEffect, useRef } from "react";
import {
  geoContains,
  geoDistance,
  geoOrthographic,
  geoPath
} from "d3";
import { feature } from "topojson-client";

const WORLD_URL = "https://unpkg.com/world-atlas@2/countries-110m.json";
const ROTATION_PERIOD_MS = 60000;
const INITIAL_ROTATION = [-10, -15, 0];
const DOT_LAT_STEP = 1.8;

function hotspotValue(region, regionData, utcHour) {
  const profile = regionData?.[region.id]?.profile;
  if (!Array.isArray(profile) || profile.length === 0) return 0;
  const hour = ((Math.floor(utcHour) % 24) + 24) % 24;
  return Number(profile[hour]) || 0;
}

function buildLandDots(countries) {
  const dotCandidates = [];
  for (let lat = -80; lat <= 80; lat += DOT_LAT_STEP) {
    const cos = Math.cos((lat * Math.PI) / 180);
    const lonStep = DOT_LAT_STEP / Math.max(cos, 0.2);
    for (let lon = -180; lon <= 180; lon += lonStep) {
      dotCandidates.push([lon, lat]);
    }
  }

  return dotCandidates.filter(([lon, lat]) => {
    for (const country of countries.features) {
      if (geoContains(country, [lon, lat])) return true;
    }
    return false;
  });
}

export default function Globe({
  regions,
  regionData,
  utcHour,
  width = 560,
  height = 560
}) {
  const hourIndex = ((Math.floor(utcHour % 24)) + 24) % 24;
  const activeHotspots = regions.filter(
    (region) => (regionData[region.id]?.profile?.[hourIndex] ?? 0) > 0.05
  );
  const totalGW = activeHotspots.reduce(
    (sum, region) => sum + (regionData[region.id]?.profile?.[hourIndex] ?? 0),
    0
  );
  const hour = String(hourIndex).padStart(2, "0");
  const aria = `Rotating orthographic globe showing ${activeHotspots.length} active waste-energy hotspot${activeHotspots.length === 1 ? "" : "s"}, totalling ${totalGW.toFixed(1)} gigawatts of curtailed or flared energy as of ${hour}:00 UTC.`;
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const canvasRef = useRef(null);
  const frameRef = useRef(0);
  const countriesRef = useRef(null);
  const landDotsRef = useRef(null);
  const loadingRef = useRef(false);
  const dragRef = useRef({
    active: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
    velocityX: 0,
    velocityY: 0
  });
  const rotationRef = useRef({
    lambda: INITIAL_ROTATION[0],
    phi: INITIAL_ROTATION[1],
    gamma: INITIAL_ROTATION[2]
  });
  const autoRotationOffsetRef = useRef(0);
  const lastFrameTimeRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function loadWorld() {
      if (countriesRef.current || loadingRef.current) return;
      loadingRef.current = true;

      try {
        const topology = await fetch(WORLD_URL).then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load world atlas: ${response.status}`);
          }
          return response.json();
        });

        if (cancelled) return;

        const countries = feature(topology, topology.objects.countries);
        countriesRef.current = countries;
        landDotsRef.current = buildLandDots(countries);
      } catch (error) {
        console.error("Globe country data load failed", error);
      } finally {
        loadingRef.current = false;
      }
    }

    loadWorld();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const dpr = globalThis.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext("2d");
    if (!context) return undefined;

    const rootStyle = getComputedStyle(document.documentElement);
    const teal = rootStyle.getPropertyValue("--teal-500").trim() || "#14afac";
    const orange = rootStyle.getPropertyValue("--btc-orange").trim() || "#f7931a";
    const slate900 = rootStyle.getPropertyValue("--slate-900").trim() || "#0b0c0d";

    function renderFrame(timestamp) {
      const lastFrame = lastFrameTimeRef.current || timestamp;
      const delta = timestamp - lastFrame;
      lastFrameTimeRef.current = timestamp;

      const rotation = rotationRef.current;
      const drag = dragRef.current;

      if (!drag.active) {
        const elapsed = ((timestamp % ROTATION_PERIOD_MS) / ROTATION_PERIOD_MS) * 360;
        rotation.lambda = INITIAL_ROTATION[0] + autoRotationOffsetRef.current + elapsed;
        rotation.phi += drag.velocityY * delta * 0.06;
        rotation.phi = Math.max(-70, Math.min(70, rotation.phi));
        drag.velocityY *= 0.94;
        drag.velocityX *= 0.94;
        autoRotationOffsetRef.current += drag.velocityX * delta * 0.06;
      }

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);

      const size = Math.min(width, height);
      const projection = geoOrthographic()
        .scale(size * 0.46)
        .translate([width / 2, height / 2])
        .clipAngle(90)
        .rotate([rotation.lambda, rotation.phi, rotation.gamma]);
      const path = geoPath(projection, context);
      const center = [-rotation.lambda, -rotation.phi];
      const countries = countriesRef.current;
      const landDots = landDotsRef.current;

      context.beginPath();
      path({ type: "Sphere" });
      context.fillStyle = slate900;
      context.fill();

      const gradient = context.createRadialGradient(
        width * 0.35,
        height * 0.35,
        size * 0.1,
        width / 2,
        height / 2,
        size * 0.5
      );
      gradient.addColorStop(0, "rgba(30, 55, 60, 0.25)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = gradient;
      context.beginPath();
      path({ type: "Sphere" });
      context.fill();

      if (landDots) {
        context.fillStyle = teal;
        for (const [lon, lat] of landDots) {
          const distance = geoDistance([lon, lat], center);
          if (distance > Math.PI / 2 - 0.02) continue;
          const point = projection([lon, lat]);
          if (!point) continue;

          const fade = 1 - distance / (Math.PI / 2);
          context.globalAlpha = 0.25 + fade * 0.6;
          context.fillRect(point[0] - 0.6, point[1] - 0.6, 1.4, 1.4);
        }
      }
      context.globalAlpha = 1;

      if (countries) {
        context.beginPath();
        path({
          type: "GeometryCollection",
          geometries: countries.features.map((country) => country.geometry)
        });
        context.strokeStyle = "rgba(20, 175, 172, 0.22)";
        context.lineWidth = 0.4;
        context.stroke();
      }

      context.beginPath();
      path({ type: "Sphere" });
      context.strokeStyle = "rgba(20, 175, 172, 0.25)";
      context.lineWidth = 0.8;
      context.stroke();

      for (const region of regions) {
        const value = hotspotValue(region, regionData, utcHour);
        if (value <= 0) continue;

        const distance = geoDistance([region.lon, region.lat], center);
        if (distance > Math.PI / 2) continue;

        const point = projection([region.lon, region.lat]);
        if (!point) continue;

        const visible = 1 - distance / (Math.PI / 2);
        const color = region.kind === "flare" ? orange : teal;
        const glowRadius = 4 + Math.sqrt(value) * 5;
        const coreRadius = 1.5 + Math.sqrt(value);

        context.save();
        context.filter = "blur(4px)";
        context.globalAlpha = 0.45 * visible;
        context.fillStyle = color;
        context.beginPath();
        context.arc(point[0], point[1], glowRadius, 0, Math.PI * 2);
        context.fill();
        context.restore();

        context.globalAlpha = visible;
        context.fillStyle = color;
        context.beginPath();
        context.arc(point[0], point[1], coreRadius, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = "rgba(255, 255, 255, 0.85)";
        context.lineWidth = 0.6;
        context.stroke();
      }
      context.globalAlpha = 1;

      if (!countries || !landDots) {
        context.beginPath();
        context.fillStyle = "rgba(255,255,255,0.7)";
        context.arc(width / 2, height / 2, 3, 0, Math.PI * 2);
        context.fill();
      }

      if (!prefersReducedMotion) {
        frameRef.current = requestAnimationFrame(renderFrame);
      }
    }

    if (prefersReducedMotion) {
      renderFrame(globalThis.performance?.now?.() ?? 0);
    } else {
      frameRef.current = requestAnimationFrame(renderFrame);
    }

    function onPointerDown(event) {
      const drag = dragRef.current;
      drag.active = true;
      drag.pointerId = event.pointerId;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      drag.velocityX = 0;
      drag.velocityY = 0;
      canvas.setPointerCapture(event.pointerId);
    }

    function onPointerMove(event) {
      const drag = dragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;

      const dx = event.clientX - drag.lastX;
      const dy = event.clientY - drag.lastY;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      drag.velocityX = dx;
      drag.velocityY = dy;
      autoRotationOffsetRef.current += dx * 0.35;
      rotationRef.current.phi = Math.max(-70, Math.min(70, rotationRef.current.phi - dy * 0.25));
    }

    function endDrag(event) {
      const drag = dragRef.current;
      if (drag.pointerId !== event.pointerId) return;
      drag.active = false;
      drag.pointerId = null;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);

    return () => {
      cancelAnimationFrame(frameRef.current);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endDrag);
      canvas.removeEventListener("pointercancel", endDrag);
    };
  }, [height, regionData, regions, utcHour, width]);

  return (
    <canvas
      ref={canvasRef}
      aria-label={aria}
      role="img"
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        cursor: "grab",
        touchAction: "none"
      }}
    />
  );
}
