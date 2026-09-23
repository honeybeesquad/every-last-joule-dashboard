/**
 * The light-mode globe: "Almanac", an engraved atlas. Canvas 2D, vector only
 * (no per-pixel work). Ported from the redesign handoff's reference renderer
 * (reference/engraved-globe.js); constants are the handoff's
 * `renderer_constants.engraved_globe`.
 *
 * Built back to front:
 *   1. Sea: parallels every 1.5 deg as a line screen. Each short segment's
 *      width is a fraction ("tone") of the local on-screen spacing between
 *      parallels, so lines thicken toward the limb and on the night side.
 *      Segments are bucketed to quarter-pixel widths, one stroke per bucket.
 *   2. Night cross-hatch: meridians on the night side only, same method.
 *      Layers 1-2 depend only on the camera and the sun, so they are cached
 *      in an offscreen canvas and redrawn when either moves by more than
 *      0.25 deg (exactly, once motion settles).
 *   3. Land knock-out in --globe-paper, and the coastline keyline.
 *   4. Land stipple: the dot field; dot radius carries the shade.
 *   5. Limb keyline.
 *   6. Grids that publish no waste: a dashed ink ring, as the G1 globe drew,
 *      so "unpublished" never reads as a measured zero.
 *   7. Needles: screen-radial, length from sqrt(GW), with a paper halo so
 *      they read over the stipple, smallest first. Line and head carry the
 *      data quality (redesign plan 6.1): measured = solid line, solid head;
 *      anchored = solid line, hollow head; estimated = dashed line; a stale
 *      feed adds a dashed --quality-warning ring round the head.
 *   8. Selected: an ink ring round the head and the leader line to the label
 *      card (the card itself is DOM, placed by placeSelectionLabel).
 *
 * Returns hit targets [{ id, x, y, r, bx, by }] (needle heads) for picking.
 */
import * as d3 from "npm:d3";
import { D2R, dot, ortho, smooth, camera } from "./lib/globe-camera.js";
import { MIN_GW_DRAWN, needleLength, headRadius, needleStyle, placeSelectionLabel } from "./lib/needles.js";

/** Tuned at R = 345 CSS px, as the reference was. */
const K_BASE = 345;

const wq = (w) => Math.max(0.25, Math.round(w * 4) / 4); // quarter-pixel buckets

function bucketed() {
  const m = new Map();
  return {
    path(key) {
      let p = m.get(key);
      if (!p) { p = new Path2D(); m.set(key, p); }
      return p;
    },
    entries() { return m.entries(); },
  };
}

function lonDelta(a, b) {
  return Math.abs(((((a - b) + 180) % 360) + 360) % 360 - 180);
}

export function createEngravedRenderer() {
  // Offscreen line-screen cache (layers 1-2).
  let sea = null; // { canvas, key: { lat0, lon0, sunLat, sunLon, ... } }

  function seaUsable(want, exact) {
    if (!sea) return false;
    const k = sea.key;
    if (k.w !== want.w || k.h !== want.h || k.dpr !== want.dpr || k.R !== want.R ||
        k.cx !== want.cx || k.cy !== want.cy || k.fast !== want.fast || k.ink !== want.ink) return false;
    const tol = exact ? 1e-9 : 0.25;
    return Math.abs(k.lat0 - want.lat0) <= tol && lonDelta(k.lon0, want.lon0) <= tol &&
      Math.abs(k.sunLat - want.sunLat) <= tol && lonDelta(k.sunLon, want.sunLon) <= tol;
  }

  function drawSea(o, key) {
    const { cx, cy, R, sun, lat0, lon0, inkRGB, fast, w, h, dpr } = o;
    let canvas = sea?.canvas;
    if (!canvas) canvas = document.createElement("canvas");
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);

    const cam = camera(lat0, lon0);
    const SP = fast ? 2.25 : 1.5;  // line-screen pitch, degrees
    const STEP = fast ? 4 : 2;     // segment length along a line, degrees
    const P = (lat, lon) => {
      const a = lat * D2R, b = lon * D2R;
      const v = [Math.cos(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.sin(a)];
      const [x, y, z] = ortho(cam, v);
      return { x: cx + x * R, y: cy + y * R, z, v };
    };
    const lines = bucketed();
    for (let lat = -88.5; lat <= 88.5; lat += SP) {
      let prev = P(lat, -180);
      for (let lon = -180 + STEP; lon <= 180; lon += STEP) {
        const cur = P(lat, lon);
        if (prev.z > 0 && cur.z > 0) {
          const mid = P(lat, lon - STEP / 2);
          const nxt = P(lat + SP, lon - STEP / 2);
          const spacing = Math.hypot(nxt.x - mid.x, nxt.y - mid.y);
          const night = smooth(0.12, -0.2, dot(mid.v, sun));
          const tone = 0.05 + 0.26 * night + 0.12 * (1 - mid.z);
          const p = lines.path(wq(Math.max(0.3, tone * spacing)));
          p.moveTo(prev.x, prev.y);
          p.lineTo(cur.x, cur.y);
        }
        prev = cur;
      }
    }
    for (let lon = -180; lon < 180; lon += SP) {
      let prev = P(-80, lon);
      for (let lat = -80 + STEP; lat <= 80; lat += STEP) {
        const cur = P(lat, lon);
        if (prev.z > 0 && cur.z > 0) {
          const mid = P(lat - STEP / 2, lon);
          const night = smooth(0.12, -0.2, dot(mid.v, sun));
          if (night > 0.05) {
            const nxt = P(lat - STEP / 2, lon + SP);
            const spacing = Math.hypot(nxt.x - mid.x, nxt.y - mid.y);
            const p = lines.path(wq(Math.max(0.25, 0.22 * night * spacing)));
            p.moveTo(prev.x, prev.y);
            p.lineTo(cur.x, cur.y);
          }
        }
        prev = cur;
      }
    }
    g.save();
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.clip();
    g.strokeStyle = `rgba(${inkRGB},0.78)`;
    g.lineCap = "butt";
    for (const [width, p] of lines.entries()) {
      g.lineWidth = width;
      g.stroke(p);
    }
    g.restore();
    sea = { canvas, key };
  }

  /**
   * o: { ctx, w, h, dpr, cx, cy, R, lat0, lon0, sun: {lat, lon, v},
   *      land, dots: { n, xyz }, needles, rings, inkRGB, paper, warn,
   *      selectedId, fast, exact }
   * needles: [{ id, v, color, bucket, stale, gw, offset }] (offset: px,
   *   perpendicular to the needle, for records that share a location)
   * rings:   [{ v, gen }] grids that publish no waste
   */
  function draw(o) {
    const { ctx, cx, cy, R, lat0, lon0, land, dots, inkRGB, paper, warn } = o;
    const sunV = o.sun.v;
    const cam = camera(lat0, lon0);
    const k = R / K_BASE;
    const sk = Math.max(0.6, Math.sqrt(k));
    const ink = `rgb(${inkRGB})`;

    // 1-2. line screen, cached
    const key = {
      w: o.w, h: o.h, dpr: o.dpr, R, cx, cy, fast: Boolean(o.fast), ink: inkRGB,
      lat0, lon0, sunLat: o.sun.lat, sunLon: o.sun.lon,
    };
    if (!seaUsable(key, o.exact)) drawSea({ ...o, sun: sunV, fast: Boolean(o.fast) }, key);
    ctx.drawImage(sea.canvas, 0, 0, o.w, o.h);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();

    // 3. land knock-out and coastline
    const proj = d3.geoOrthographic().rotate([-lon0, -lat0]).scale(R).translate([cx, cy]).clipAngle(90);
    const landPath = new Path2D(d3.geoPath(proj)(land));
    ctx.fillStyle = paper;
    ctx.fill(landPath);
    ctx.strokeStyle = `rgba(${inkRGB},0.85)`;
    ctx.lineWidth = 0.75 * Math.sqrt(k);
    ctx.stroke(landPath);

    // 4. stipple, bucketed by radius
    const st = bucketed();
    const every = o.fast ? 2 : 1;
    const xyz = dots.xyz;
    for (let i = 0; i < dots.n; i += every) {
      const v = [xyz[i * 3], xyz[i * 3 + 1], xyz[i * 3 + 2]];
      const [x, y, z] = ortho(cam, v);
      if (z <= 0.02) continue;
      const night = smooth(0.12, -0.2, dot(v, sunV));
      const tone = 0.42 + 0.45 * night;
      const r = Math.round((0.45 + 1.1 * tone) * (0.6 + 0.4 * z) * Math.sqrt(k) * 8) / 8;
      const sx = cx + x * R, sy = cy + y * R;
      const path = st.path(r);
      path.moveTo(sx + r, sy);
      path.arc(sx, sy, r, 0, Math.PI * 2);
    }
    ctx.fillStyle = `rgba(${inkRGB},0.92)`;
    for (const [, p] of st.entries()) ctx.fill(p);
    ctx.restore();

    // 5. limb
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, R - 0.6, 0, Math.PI * 2);
    ctx.stroke();

    // 6. grids that publish no waste
    if (o.rings?.length) {
      ctx.save();
      ctx.strokeStyle = `rgba(${inkRGB},0.55)`;
      ctx.lineWidth = 0.9 * sk;
      ctx.setLineDash([1.6 * sk, 1.6 * sk]);
      for (const ring of o.rings) {
        const [x, y, z] = ortho(cam, ring.v);
        if (z <= 0.05) continue;
        ctx.beginPath();
        ctx.arc(cx + x * R, cy + y * R, (2 + Math.sqrt(Math.max(0, ring.gen)) * 1.1) * sk, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 7. needles, smallest first so the big ones sit on top
    const hits = [];
    const sorted = o.needles.filter((n) => n.gw >= MIN_GW_DRAWN).sort((a, b) => a.gw - b.gw);
    for (const n of sorted) {
      const [x, y, z] = ortho(cam, n.v);
      if (z <= 0.05) continue;
      let dx = x, dy = y;
      const len = Math.hypot(dx, dy);
      if (len < 0.02) { dx = 0; dy = -1; } else { dx /= len; dy /= len; }
      const off = (n.offset ?? 0) * sk;
      const bx = cx + x * R - dy * off, by = cy + y * R + dx * off;
      const H = needleLength(n.gw, k, len);
      const tx = bx + dx * H, ty = by + dy * H;
      const style = needleStyle(n.bucket, n.stale);
      ctx.lineCap = "round";
      ctx.strokeStyle = paper;
      ctx.lineWidth = 3.25 * sk;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.strokeStyle = n.color;
      ctx.lineWidth = 1.3 * sk;
      ctx.setLineDash(style.dashed ? [2 * sk, 2 * sk] : []);
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.setLineDash([]);
      const hr = headRadius(n.gw, sk);
      ctx.fillStyle = paper;
      ctx.beginPath(); ctx.arc(tx, ty, hr + 1.2 * sk, 0, Math.PI * 2); ctx.fill();
      if (style.hollowHead) {
        ctx.strokeStyle = n.color;
        ctx.lineWidth = 1.2 * sk;
        ctx.beginPath(); ctx.arc(tx, ty, hr - 0.6 * sk, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.fillStyle = n.color;
        ctx.beginPath(); ctx.arc(tx, ty, hr, 0, Math.PI * 2); ctx.fill();
      }
      if (style.staleRing) {
        // Dashed so it reads by shape: the warning colour alone sits too
        // close to solar orange on paper.
        ctx.strokeStyle = warn;
        ctx.lineWidth = 1.2 * sk;
        ctx.lineCap = "butt";
        ctx.setLineDash([1.6 * sk, 1.4 * sk]);
        ctx.beginPath(); ctx.arc(tx, ty, hr + 2.6 * sk, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineCap = "round";
      }
      ctx.fillStyle = n.color;
      ctx.beginPath(); ctx.arc(bx, by, 1.3 * sk, 0, Math.PI * 2); ctx.fill();
      hits.push({ id: n.id, x: tx, y: ty, r: Math.max(hr + 4, 10), bx, by });
    }
    ctx.lineCap = "butt";

    // 8. selected: ring round the head, and the leader to the label card
    // A mixed record draws one needle per fuel under one id; ring the
    // largest, which was drawn last.
    const sel = o.selectedId ? hits.findLast((hit) => hit.id === o.selectedId) : null;
    let label = null;
    if (sel) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(sel.x, sel.y, 8.5 * sk, 0, Math.PI * 2); ctx.stroke();
      label = placeSelectionLabel(sel, { w: o.w, h: o.h, cx });
      ctx.beginPath();
      ctx.moveTo(label.leader[0][0], label.leader[0][1]);
      for (let i = 1; i < label.leader.length; i++) ctx.lineTo(label.leader[i][0], label.leader[i][1]);
      ctx.stroke();
    }
    return { hits, label };
  }

  return {
    draw,
    /** Drop the line-screen cache (tokens or size changed). */
    reset() { sea = null; },
  };
}
