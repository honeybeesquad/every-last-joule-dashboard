/**
 * The dark-mode globe: "Horizon". Canvas 2D. Ported from the redesign
 * handoff's reference renderer (reference/horizon-globe.js); its constants
 * and geometry live in src/lib/horizon.ts (renderer_constants.horizon_globe).
 *
 * A large orthographic globe whose centre sits below the viewport, so only a
 * band near its top limb shows. Regions near that limb have beams almost
 * parallel to the screen, so they stand up like light.
 *
 * Built back to front:
 *   1. Backdrop: sky, stars, atmosphere, the body gradient and the rim. It
 *      depends only on the size and the tokens, so it is drawn once into an
 *      offscreen canvas (again on resize or theme change) and blitted.
 *   2. Land dots, 0.42 deg apart, brighter on the day side and away from the
 *      limb. Dots under a curtailing region take its fuel colour: the lit
 *      territory, which globe.js computes with globe-surface.ts (dithered for
 *      mixed regions, recomputed per quarter hour). Batched into alpha
 *      buckets, so the whole field is a few dozen fills.
 *   3. Grids that publish no waste: a faint dashed ring on the ground, as the
 *      light globe draws, so "unpublished" never reads as a measured zero.
 *   4. Beams, additive, smallest first: a wide faint glow, a sheath and a
 *      bright core in the tip colour, with a glow sprite at the ground and a
 *      smaller one at the tip. Brightness carries the quality bucket (1, 0.8,
 *      0.62); an estimated beam also gets a dashed core, and a stale feed a
 *      dashed --quality-warning ring at the base, so both read by shape as
 *      well as brightness (redesign plan 6.1). A beam from just beyond the
 *      horizon is drawn from the point where it clears the limb.
 *   5. Selected: the beam at full brightness, a 1px ink ring at its tip and
 *      the leader to the label card (the card is DOM, placed with
 *      placeSelectionLabel, as in light).
 *
 * Returns { hits: [{ id, x, y, r, bx, by }] (beam tips), label }.
 */
import { camera, smooth } from "./lib/globe-camera.js";
import { placeSelectionLabel } from "./lib/needles.js";
import {
  MIN_GW_BEAM, ESTIMATED_CORE_DASH, beamHeight, beamWidth, beamSpan, beamOpacity, landDotAlpha, tintDotAlpha,
} from "./lib/horizon.js";

const FUELS = ["solar", "wind", "hydro"];

/** "#rrggbb" at an alpha, for gradient stops and fills. */
function hexA(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Deterministic star field: the same stars on every rebuild. */
function starHash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// Land-dot buckets: 21 alphas (0..1 by 0.05) for plain land, then 11 alphas
// (0..1 by 0.1) per fuel for lit territory.
const LAND_BUCKETS = 21;
const TINT_BUCKETS = 11;

export function createHorizonRenderer() {
  let backdrop = null; // { canvas, key }
  let sprites = null;  // { key, byFuel }

  function backdropFor(o) {
    const { w, h, dpr, R, top, cx, t } = o;
    const key = [w, h, dpr, R, top, cx, t.bg, t.atmosphereRGB, t.bodyHi, t.bodyMid, t.bodyLo, t.starRGB].join("|");
    if (backdrop?.key === key) return backdrop.canvas;
    const canvas = backdrop?.canvas ?? document.createElement("canvas");
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cy = top + R;
    g.fillStyle = t.bg;
    g.fillRect(0, 0, w, h);

    // Stars in the sky above the limb; about 260 at 1440 wide.
    const stars = Math.round(260 * Math.max(0.5, w / 1440));
    for (let i = 0; i < stars; i++) {
      g.fillStyle = `rgba(${t.starRGB},${0.12 + starHash(i * 5) * 0.35})`;
      g.beginPath();
      g.arc(starHash(i * 3 + 1) * w, starHash(i * 7 + 2) * (top + 30), 0.25 + starHash(i * 11) * 0.65, 0, Math.PI * 2);
      g.fill();
    }

    const A = t.atmosphereRGB;
    const atmo = g.createRadialGradient(cx, cy, R, cx, cy, R + 170);
    atmo.addColorStop(0, `rgba(${A},0.85)`);
    atmo.addColorStop(0.06, `rgba(${A},0.42)`);
    atmo.addColorStop(0.25, `rgba(${A},0.13)`);
    atmo.addColorStop(0.6, `rgba(${A},0.04)`);
    atmo.addColorStop(1, `rgba(${A},0)`);
    g.fillStyle = atmo;
    g.beginPath();
    g.arc(cx, cy, R + 170, 0, Math.PI * 2);
    g.fill();

    g.save();
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.clip();
    const body = g.createRadialGradient(cx, cy - R * 0.2, R * 0.6, cx, cy, R);
    body.addColorStop(0, t.bodyHi);
    body.addColorStop(0.85, t.bodyMid);
    body.addColorStop(1, t.bodyLo);
    g.fillStyle = body;
    g.fillRect(0, 0, w, h);
    const scatter = g.createRadialGradient(cx, cy, R * 0.93, cx, cy, R);
    scatter.addColorStop(0, `rgba(${A},0)`);
    scatter.addColorStop(1, `rgba(${A},0.3)`);
    g.fillStyle = scatter;
    g.fillRect(0, 0, w, h);
    g.restore();

    // The rim: the atmosphere's hue, lifted toward white.
    const rim = A.split(",").map((c) => Math.min(255, Number(c) + 60)).join(",");
    g.strokeStyle = `rgba(${rim},0.55)`;
    g.lineWidth = 1.25;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.stroke();

    backdrop = { canvas, key };
    return canvas;
  }

  function spritesFor(fuel, tip) {
    const key = FUELS.map((f) => `${fuel[f]}/${tip[f]}`).join("|");
    if (sprites?.key === key) return sprites.byFuel;
    const byFuel = {};
    for (const f of FUELS) {
      const s = document.createElement("canvas");
      s.width = s.height = 128;
      const c = s.getContext("2d");
      const grad = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, hexA(tip[f], 0.9));
      grad.addColorStop(0.2, hexA(fuel[f], 0.5));
      grad.addColorStop(1, hexA(fuel[f], 0));
      c.fillStyle = grad;
      c.fillRect(0, 0, 128, 128);
      byFuel[f] = s;
    }
    sprites = { key, byFuel };
    return byFuel;
  }

  /**
   * o: { ctx, w, h, dpr, R, top, cx, lat0, lon0, sun: { v },
   *      dots: { n, xyz }, territory: { fuel, strength } | null,
   *      beams: [{ id, v, fuel, bucket, stale, gw, offset }],
   *      rings: [{ v, gen }],
   *      t: readGlobeTokens() output, fuel: { solar, wind, hydro } colours,
   *      tip: { solar, wind, hydro } colours,
   *      selectedId, beam (K), widthScale, dotScale, labelBottom }
   * `offset` (px, perpendicular to the beam) separates records that share a
   * location; `labelBottom` keeps the label card clear of the dock.
   */
  function draw(o) {
    const { ctx, w, h, R, top, cx, dots, territory, t, fuel, tip } = o;
    const cy = top + R;
    const cam = camera(o.lat0, o.lon0);
    const [ex, ey, ez] = cam.e, [nx, ny, nz] = cam.n, [fx, fy, fz] = cam.f;
    const [sx0, sy0, sz0] = o.sun.v;
    const dotScale = o.dotScale ?? 1;

    // 1. backdrop
    ctx.drawImage(backdropFor(o), 0, 0, w, h);

    // 2. land dots, one path per alpha bucket
    const paths = new Array(LAND_BUCKETS + FUELS.length * TINT_BUCKETS);
    const xyz = dots.xyz;
    const tintFuel = territory?.fuel;
    const tintStrength = territory?.strength;
    for (let i = 0; i < dots.n; i++) {
      const vx = xyz[i * 3], vy = xyz[i * 3 + 1], vz = xyz[i * 3 + 2];
      const z = vx * fx + vy * fy + vz * fz;
      if (z <= 0) continue;
      const px = cx + (vx * ex + vy * ey + vz * ez) * R;
      const py = cy - (vx * nx + vy * ny + vz * nz) * R;
      if (py < -5 || py > h + 5 || px < -5 || px > w + 5) continue;
      const limb = smooth(0, 0.35, z);
      let b;
      const f = tintFuel ? tintFuel[i] : -1;
      if (f >= 0) {
        const a = Math.round(tintDotAlpha(tintStrength[i], limb) * 10);
        if (a === 0) continue;
        b = LAND_BUCKETS + f * TINT_BUCKETS + a;
      } else {
        const day = smooth(-0.18, 0.2, vx * sx0 + vy * sy0 + vz * sz0);
        b = Math.round(landDotAlpha(day, limb) * 20);
        if (b === 0) continue;
      }
      const r = (0.55 + 0.65 * Math.sqrt(z)) * dotScale;
      const p = paths[b] ?? (paths[b] = new Path2D());
      p.moveTo(px + r, py);
      p.arc(px, py, r, 0, Math.PI * 2);
    }
    for (let b = 0; b < paths.length; b++) {
      if (!paths[b]) continue;
      if (b < LAND_BUCKETS) {
        ctx.fillStyle = `rgba(${t.landRGB},${b / 20})`;
      } else {
        const k = b - LAND_BUCKETS;
        ctx.fillStyle = hexA(fuel[FUELS[Math.floor(k / TINT_BUCKETS)]], (k % TINT_BUCKETS) / 10);
      }
      ctx.fill(paths[b]);
    }

    // 3. grids that publish no waste
    if (o.rings?.length) {
      ctx.save();
      ctx.strokeStyle = `rgba(${t.inkRGB},0.4)`;
      ctx.lineWidth = 0.8;
      ctx.setLineDash([1.5, 1.5]);
      for (const ring of o.rings) {
        const [x, y, z] = [
          ring.v[0] * ex + ring.v[1] * ey + ring.v[2] * ez,
          -(ring.v[0] * nx + ring.v[1] * ny + ring.v[2] * nz),
          ring.v[0] * fx + ring.v[1] * fy + ring.v[2] * fz,
        ];
        if (z <= 0.03) continue;
        const px = cx + x * R, py = cy + y * R;
        if (py < -10 || py > h + 10 || px < -10 || px > w + 10) continue;
        ctx.beginPath();
        ctx.arc(px, py, (1.6 + Math.sqrt(Math.max(0, ring.gen)) * 0.9) * dotScale, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 4. beams, additive, smallest first
    const spr = spritesFor(fuel, tip);
    const K = o.beam ?? 0.1;
    const hits = [];
    const sorted = o.beams.filter((b) => b.gw >= MIN_GW_BEAM).sort((a, b) => a.gw - b.gw);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "butt";
    for (const b of sorted) {
      const bh = beamHeight(b.gw, K);
      const x = b.v[0] * ex + b.v[1] * ey + b.v[2] * ez;
      const y = -(b.v[0] * nx + b.v[1] * ny + b.v[2] * nz);
      const z = b.v[0] * fx + b.v[1] * fy + b.v[2] * fz;
      const span = beamSpan(x, y, z, bh);
      if (!span.visible) continue;
      const rb = Math.hypot(x, y);
      const ux = rb > 1e-6 ? x / rb : 0, uy = rb > 1e-6 ? y / rb : -1;
      const off = b.offset ?? 0;
      const ox = -uy * off, oy = ux * off;
      const bx = cx + x * R * span.k0 + ox, by = cy + y * R * span.k0 + oy;
      const tx = cx + x * R * (1 + bh) + ox, ty = cy + y * R * (1 + bh) + oy;
      if (Math.max(bx, tx) < -30 || Math.min(bx, tx) > w + 30 || Math.max(by, ty) < -30 || Math.min(by, ty) > h + 30) continue;
      const q = beamOpacity(b.bucket, b.id === o.selectedId);
      const bw = beamWidth(b.gw, o.widthScale ?? 1);
      const col = fuel[b.fuel], tipCol = tip[b.fuel];
      const grad = (a) => {
        const g = ctx.createLinearGradient(bx, by, tx, ty);
        g.addColorStop(0, hexA(col, a * q));
        g.addColorStop(1, hexA(col, a * 0.25 * q));
        return g;
      };
      ctx.strokeStyle = grad(0.05);
      ctx.lineWidth = bw * 9;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.strokeStyle = grad(0.16);
      ctx.lineWidth = bw * 3.2;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
      const core = ctx.createLinearGradient(bx, by, tx, ty);
      core.addColorStop(0, hexA(tipCol, 0.75 * q));
      core.addColorStop(1, hexA(tipCol, 0.19 * q));
      ctx.strokeStyle = core;
      ctx.lineWidth = bw * 0.7;
      if (b.bucket === "estimated") ctx.setLineDash(ESTIMATED_CORE_DASH);
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = q;
      if (z > 0) {
        const gr = bw * 7;
        ctx.drawImage(spr[b.fuel], bx - gr, by - gr, gr * 2, gr * 2);
      }
      const gt = bw * 3.5;
      ctx.drawImage(spr[b.fuel], tx - gt, ty - gt, gt * 2, gt * 2);
      ctx.globalAlpha = 1;
      if (b.stale && z > 0) {
        // A broken ring: it reads by shape, not only by hue.
        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = t.qualityWarning;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.arc(bx, by, Math.max(6, bw * 2.6), 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      hits.push({ id: b.id, x: tx, y: ty, r: Math.max(12, gt), bx, by, bw });
    }
    ctx.restore();

    // 5. selected: ring at the tip, leader to the label card. A mixed record
    // draws one beam per fuel under one id; ring the largest (drawn last).
    const sel = o.selectedId ? hits.findLast((hit) => hit.id === o.selectedId) : null;
    let label = null;
    if (sel) {
      ctx.strokeStyle = t.ink;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(sel.x, sel.y, Math.max(7, sel.bw * 1.8), 0, Math.PI * 2); ctx.stroke();
      label = placeSelectionLabel(sel, { w, h: o.labelBottom ?? h, cx });
      ctx.beginPath();
      ctx.moveTo(label.leader[0][0], label.leader[0][1]);
      for (let i = 1; i < label.leader.length; i++) ctx.lineTo(label.leader[i][0], label.leader[i][1]);
      ctx.stroke();
    }
    return { hits, label };
  }

  return {
    draw,
    /** Drop the backdrop and sprite caches (tokens or size changed). */
    reset() { backdrop = null; sprites = null; },
  };
}
