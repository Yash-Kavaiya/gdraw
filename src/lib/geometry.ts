import type { El, Routing } from './types';

export type Pt = [number, number];
export interface Box { x: number; y: number; w: number; h: number }

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const isLinear = (el: El) => el.type === 'arrow' || el.type === 'line';

export function normBox(x1: number, y1: number, x2: number, y2: number): Box {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
}

export function boundsOf(el: El): Box {
  if (isLinear(el) && el.points?.length) return boundsOfPoints(el.points);
  if (el.type === 'freedraw' && el.path?.length) {
    const b = boundsOfPoints(el.path.map(([px, py]) => [px + el.x, py + el.y]));
    return b;
  }
  return { x: el.x, y: el.y, w: el.w, h: el.h };
}

export function boundsOfPoints(pts: Pt[]): Box {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const [x, y] of pts) { x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y); }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function unionBoxes(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const b of boxes) { x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y); x2 = Math.max(x2, b.x + b.w); y2 = Math.max(y2, b.y + b.h); }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export const inBox = (p: Pt, b: Box, pad = 0) =>
  p[0] >= b.x - pad && p[0] <= b.x + b.w + pad && p[1] >= b.y - pad && p[1] <= b.y + b.h + pad;

export const boxContains = (outer: Box, inner: Box) =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;

export function distToSegment(p: Pt, a: Pt, b: Pt) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

export function distToPolyline(p: Pt, pts: Pt[]) {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, distToSegment(p, pts[i], pts[i + 1]));
  return d;
}

/** Point on the boundary of a box in the direction of `toward` from its centre. */
export function boxAnchor(b: Box, toward: Pt, shape: string = 'rect', gap = 6): Pt {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const dx = toward[0] - cx, dy = toward[1] - cy;
  if (dx === 0 && dy === 0) return [cx, cy];
  const hw = b.w / 2 + gap, hh = b.h / 2 + gap;
  if (shape === 'ellipse') {
    const t = 1 / Math.sqrt((dx * dx) / (hw * hw) + (dy * dy) / (hh * hh));
    return [cx + dx * t, cy + dy * t];
  }
  if (shape === 'diamond') {
    const t = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh);
    return [cx + dx * t, cy + dy * t];
  }
  const t = Math.min(hw / Math.abs(dx || 1e-9), hh / Math.abs(dy || 1e-9));
  return [cx + dx * t, cy + dy * t];
}

type Side = 'l' | 'r' | 't' | 'b';
function sideAnchor(b: Box, side: Side, gap = 6): Pt {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  switch (side) {
    case 'l': return [b.x - gap, cy];
    case 'r': return [b.x + b.w + gap, cy];
    case 't': return [cx, b.y - gap];
    case 'b': return [cx, b.y + b.h + gap];
  }
}

/** Compute the rendered route of a connector given optional bound boxes. */
export function routeConnector(
  pts: Pt[], routing: Routing = 'straight', sb?: { box: Box; shape: string } | null, eb?: { box: Box; shape: string } | null,
): Pt[] {
  let a = pts[0], z = pts[pts.length - 1];
  const mids = pts.slice(1, -1);
  if (routing === 'elbow') {
    // choose exit sides by relative position
    const ac: Pt = sb ? [sb.box.x + sb.box.w / 2, sb.box.y + sb.box.h / 2] : a;
    const zc: Pt = eb ? [eb.box.x + eb.box.w / 2, eb.box.y + eb.box.h / 2] : z;
    const dx = zc[0] - ac[0], dy = zc[1] - ac[1];
    const horiz = Math.abs(dx) >= Math.abs(dy);
    let sSide: Side = horiz ? (dx >= 0 ? 'r' : 'l') : (dy >= 0 ? 'b' : 't');
    let eSide: Side = horiz ? (dx >= 0 ? 'l' : 'r') : (dy >= 0 ? 't' : 'b');
    if (sb) a = sideAnchor(sb.box, sSide);
    if (eb) z = sideAnchor(eb.box, eSide);
    if (horiz) {
      if (Math.abs(a[1] - z[1]) < 1) return [a, z];
      const mx = (a[0] + z[0]) / 2;
      return [a, [mx, a[1]], [mx, z[1]], z];
    }
    if (Math.abs(a[0] - z[0]) < 1) return [a, z];
    const my = (a[1] + z[1]) / 2;
    return [a, [a[0], my], [z[0], my], z];
  }
  const nextA = mids[0] ?? (eb ? [eb.box.x + eb.box.w / 2, eb.box.y + eb.box.h / 2] as Pt : z);
  const prevZ = mids[mids.length - 1] ?? (sb ? [sb.box.x + sb.box.w / 2, sb.box.y + sb.box.h / 2] as Pt : a);
  if (sb) a = boxAnchor(sb.box, nextA, sb.shape);
  if (eb) z = boxAnchor(eb.box, prevZ, eb.shape);
  return [a, ...mids, z];
}

export function routeToPath(route: Pt[], routing: Routing = 'straight', radius = 10): string {
  if (route.length < 2) return '';
  if (routing === 'curve') {
    const [a, z] = [route[0], route[route.length - 1]];
    if (route.length === 2) {
      const dx = z[0] - a[0], dy = z[1] - a[1];
      const horiz = Math.abs(dx) >= Math.abs(dy);
      const c1: Pt = horiz ? [a[0] + dx / 2, a[1]] : [a[0], a[1] + dy / 2];
      const c2: Pt = horiz ? [z[0] - dx / 2, z[1]] : [z[0], z[1] - dy / 2];
      return `M${a[0]},${a[1]} C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${z[0]},${z[1]}`;
    }
    let d = `M${a[0]},${a[1]}`;
    for (let i = 1; i < route.length - 1; i++) {
      const m: Pt = [(route[i][0] + route[i + 1][0]) / 2, (route[i][1] + route[i + 1][1]) / 2];
      d += ` Q${route[i][0]},${route[i][1]} ${i === route.length - 2 ? z[0] : m[0]},${i === route.length - 2 ? z[1] : m[1]}`;
    }
    return d;
  }
  if (routing === 'elbow' && route.length > 2) {
    let d = `M${route[0][0]},${route[0][1]}`;
    for (let i = 1; i < route.length - 1; i++) {
      const p = route[i], prev = route[i - 1], next = route[i + 1];
      const r = Math.min(radius, Math.hypot(p[0] - prev[0], p[1] - prev[1]) / 2, Math.hypot(next[0] - p[0], next[1] - p[1]) / 2);
      const u1 = unit(prev, p), u2 = unit(p, next);
      d += ` L${p[0] - u1[0] * r},${p[1] - u1[1] * r} Q${p[0]},${p[1]} ${p[0] + u2[0] * r},${p[1] + u2[1] * r}`;
    }
    const z = route[route.length - 1];
    return d + ` L${z[0]},${z[1]}`;
  }
  return 'M' + route.map((p) => `${p[0]},${p[1]}`).join(' L');
}

function unit(a: Pt, b: Pt): Pt {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
}

/** Midpoint along a polyline (by length) — used for connector labels. */
export function polylineMid(pts: Pt[]): Pt {
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) total += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    if (acc + seg >= total / 2) {
      const t = seg ? (total / 2 - acc) / seg : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t];
    }
    acc += seg;
  }
  return pts[0];
}

/** Smooth SVG path from freehand points. */
export function freehandPath(path: Pt[]): string {
  if (!path.length) return '';
  if (path.length < 3) return `M${path[0][0]},${path[0][1]} ` + path.map((p) => `L${p[0]},${p[1]}`).join(' ');
  let d = `M${path[0][0]},${path[0][1]}`;
  for (let i = 1; i < path.length - 1; i++) {
    const mx = (path[i][0] + path[i + 1][0]) / 2, my = (path[i][1] + path[i + 1][1]) / 2;
    d += ` Q${path[i][0]},${path[i][1]} ${mx},${my}`;
  }
  const l = path[path.length - 1];
  return d + ` L${l[0]},${l[1]}`;
}

export const snap = (v: number, grid: number, on: boolean) => (on ? Math.round(v / grid) * grid : v);
