import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { El, Tool, Viewport, ZoneKind } from '../lib/types';
import type { Palette } from '../lib/theme';
import { textBlockSize, DIAGRAM_FONT } from '../lib/theme';
import { renderElement, SvgDefs, getRoute } from '../lib/render';
import {
  boundsOf, boundsOfPoints, distToPolyline, inBox, isLinear, normBox, Pt, snap, uid, boxContains, unionBoxes, polylineMid, Box,
} from '../lib/geometry';
import { makeEl, makeService, makeZone, StyleDefaults } from '../lib/factory';
import { ZONE_STYLES } from '../lib/services';

export interface CanvasProps {
  elements: El[];
  commit: (n: El[] | ((p: El[]) => El[])) => void;
  setLive: (n: El[] | ((p: El[]) => El[])) => void;
  endLive: () => void;
  tool: Tool; setTool: (t: Tool) => void; toolLocked: boolean;
  selected: string[]; setSelected: (ids: string[]) => void;
  vp: Viewport; setVp: (v: Viewport | ((p: Viewport) => Viewport)) => void;
  palette: Palette; style: StyleDefaults; grid: boolean; snapOn: boolean;
  editingId: string | null; setEditingId: (id: string | null) => void;
  onDropFiles: (files: File[], at: Pt) => void;
}

const GRID = 20;
const HANDLE = 9;

type Drag =
  | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number }
  | { kind: 'marquee'; x0: number; y0: number; x1: number; y1: number; base: string[] }
  | { kind: 'move'; start: Pt; orig: Map<string, El>; moved: boolean }
  | { kind: 'resize'; id: string; handle: string; orig: El; start: Pt }
  | { kind: 'create'; id: string; start: Pt; box?: Box }
  | { kind: 'arrow'; id: string; start: Pt; end?: Pt; endId?: string | null }
  | { kind: 'endpoint'; id: string; which: 'start' | 'end'; orig: El }
  | { kind: 'draw'; id: string; start: Pt }
  | { kind: 'erase'; ids: Set<string> };

const ElView = memo(function ElView({ el, p, s, e, editing }: { el: El; p: Palette; s?: El; e?: El; editing: boolean }) {
  const map = new Map<string, El>();
  if (s) map.set(s.id, s);
  if (e) map.set(e.id, e);
  return <>{renderElement(el, p, map, editing ? el.id : null)}</>;
});

function translated(o: El, dx: number, dy: number): El {
  return { ...o, x: o.x + dx, y: o.y + dy, points: o.points?.map(([x, y]) => [x + dx, y + dy] as Pt) };
}

export function hitTest(pt: Pt, els: El[], zoom: number, map: Map<string, El>, filter?: (e: El) => boolean): El | undefined {
  const tol = 6 / zoom;
  for (let i = els.length - 1; i >= 0; i--) {
    const el = els[i];
    if (filter && !filter(el)) continue;
    if (hitEl(el, pt, tol, map)) return el;
  }
  return undefined;
}

function hitEl(el: El, pt: Pt, tol: number, map: Map<string, El>): boolean {
  const b = boundsOf(el);
  switch (el.type) {
    case 'arrow': case 'line': {
      const r = getRoute(el, map);
      if (distToPolyline(pt, r) < tol + el.strokeWidth + 2) return true;
      if (el.text) { const m = polylineMid(r); return Math.abs(pt[0] - m[0]) < 40 && Math.abs(pt[1] - m[1]) < 12; }
      return false;
    }
    case 'freedraw':
      return distToPolyline([pt[0] - el.x, pt[1] - el.y], el.path ?? []) < tol + el.strokeWidth;
    case 'zone': {
      if (!inBox(pt, b, tol)) return false;
      const nearEdge = pt[0] < b.x + tol * 2 || pt[0] > b.x + b.w - tol * 2 || pt[1] < b.y + tol * 2 || pt[1] > b.y + b.h - tol * 2;
      const inLabel = pt[1] < b.y + 32 && pt[0] < b.x + 260;
      return nearEdge || inLabel;
    }
    case 'rect': case 'ellipse': case 'diamond': {
      if (!inBox(pt, b, tol)) return false;
      if (el.fill !== 'transparent' || el.text) return true;
      return pt[0] < b.x + tol * 2 || pt[0] > b.x + b.w - tol * 2 || pt[1] < b.y + tol * 2 || pt[1] > b.y + b.h - tol * 2;
    }
    default:
      return inBox(pt, b, tol);
  }
}

const bindable = (e: El) => !isLinear(e) && e.type !== 'freedraw' && e.type !== 'text';

/** Connector target under a point: whole shape area counts (zones only by edge/label). */
export function bindTargetAt(pt: Pt, els: El[], zoom: number, map: Map<string, El>, exclude?: string): El | undefined {
  const tol = 6 / zoom;
  for (let i = els.length - 1; i >= 0; i--) {
    const el = els[i];
    if (!bindable(el) || el.id === exclude) continue;
    if (el.type === 'zone' ? hitEl(el, pt, tol, map) : inBox(pt, boundsOf(el), tol)) return el;
  }
  return undefined;
}

function handlesFor(b: Box): [string, Pt][] {
  const { x, y, w, h } = b;
  return [
    ['nw', [x, y]], ['n', [x + w / 2, y]], ['ne', [x + w, y]], ['e', [x + w, y + h / 2]],
    ['se', [x + w, y + h]], ['s', [x + w / 2, y + h]], ['sw', [x, y + h]], ['w', [x, y + h / 2]],
  ];
}

const CURSORS: Record<string, string> = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };

export function insertIndexFor(els: El[], el: El) {
  if (el.type !== 'zone') return els.length;
  let idx = 0;
  els.forEach((e, i) => { if (e.type === 'zone') idx = i + 1; });
  return idx;
}

export default function Canvas(props: CanvasProps) {
  const { elements, commit, setLive, endLive, tool, setTool, toolLocked, selected, setSelected, vp, setVp, palette: p, style, grid, snapOn, editingId, setEditingId, onDropFiles } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const [marquee, setMarquee] = useState<Box | null>(null);
  const [bindTarget, setBindTarget] = useState<string | null>(null);
  const [erasing, setErasing] = useState<Set<string>>(new Set());
  const [hoverCursor, setHoverCursor] = useState<string | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const vpRef = useRef(vp); vpRef.current = vp;
  const elRef = useRef(elements); elRef.current = elements;
  const selRef = useRef(selected); selRef.current = selected;

  const map = useMemo(() => new Map(elements.map((e) => [e.id, e])), [elements]);
  const mapRef = useRef(map); mapRef.current = map;

  const toWorld = useCallback((cx: number, cy: number): Pt => {
    const r = svgRef.current!.getBoundingClientRect();
    const v = vpRef.current;
    return [(cx - r.left - v.x) / v.zoom, (cy - r.top - v.y) / v.zoom];
  }, []);

  // space-to-pan
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !(e.target as HTMLElement).closest('input,textarea,[contenteditable]')) { setSpaceDown(true); e.preventDefault(); } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceDown(false); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // wheel: pan, ctrl+wheel zoom (non-passive)
  useEffect(() => {
    const svg = svgRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0025));
        setVp((v) => {
          const zoom = Math.min(4, Math.max(0.1, v.zoom * factor));
          const mx = e.clientX - r.left, my = e.clientY - r.top;
          return { zoom, x: mx - ((mx - v.x) / v.zoom) * zoom, y: my - ((my - v.y) / v.zoom) * zoom };
        });
      } else {
        const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX, dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
        setVp((v) => ({ ...v, x: v.x - dx, y: v.y - dy }));
      }
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [setVp]);

  const sn = (v: number) => snap(v, GRID, snapOn);

  const finishCreate = (id: string) => {
    endLive();
    setSelected([id]);
    if (!toolLocked) setTool('select');
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (editingId) return;
    const svg = svgRef.current!;
    svg.setPointerCapture(e.pointerId);
    const pt = toWorld(e.clientX, e.clientY);
    const v = vpRef.current;

    if (e.button === 1 || tool === 'hand' || spaceDown) {
      drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: v.x, vy: v.y };
      return;
    }
    if (e.button !== 0) return;

    if (tool === 'select') {
      // handles first
      if (selected.length === 1) {
        const el = map.get(selected[0]);
        if (el && !el.locked) {
          const hs = HANDLE / v.zoom;
          if (isLinear(el)) {
            const r = getRoute(el, map);
            for (const [which, q] of [['start', r[0]], ['end', r[r.length - 1]]] as const) {
              if (Math.abs(pt[0] - q[0]) < hs && Math.abs(pt[1] - q[1]) < hs) {
                drag.current = { kind: 'endpoint', id: el.id, which, orig: el };
                return;
              }
            }
          } else if (el.type !== 'freedraw') {
            for (const [h, q] of handlesFor(boundsOf(el))) {
              if (Math.abs(pt[0] - q[0]) < hs && Math.abs(pt[1] - q[1]) < hs) {
                drag.current = { kind: 'resize', id: el.id, handle: h, orig: el, start: pt };
                return;
              }
            }
          }
        }
      }
      const hit = hitTest(pt, elements, v.zoom, map);
      if (hit) {
        let sel = selected;
        if (e.shiftKey) sel = selected.includes(hit.id) ? selected.filter((i) => i !== hit.id) : [...selected, hit.id];
        else if (!selected.includes(hit.id)) sel = [hit.id];
        setSelected(sel);
        // collect move set (zones carry their contents unless Alt held)
        const ids = new Set(sel.filter((id) => !map.get(id)?.locked));
        if (!e.altKey) {
          for (const id of [...ids]) {
            const z = map.get(id);
            if (z?.type === 'zone') {
              const zb = boundsOf(z);
              for (const o of elements) if (o.id !== z.id && !isLinear(o) && boxContains(zb, boundsOf(o)) && !o.locked) ids.add(o.id);
            }
          }
          // unbound arrow points move along when both ends are inside the moved set
          for (const o of elements) if (isLinear(o) && !ids.has(o.id) && !o.start && !o.end) { /* free arrows stay unless selected */ }
        }
        const orig = new Map<string, El>();
        for (const id of ids) orig.set(id, map.get(id)!);
        drag.current = { kind: 'move', start: pt, orig, moved: false };
      } else {
        const base = e.shiftKey ? selected : [];
        if (!e.shiftKey) setSelected([]);
        drag.current = { kind: 'marquee', x0: pt[0], y0: pt[1], x1: pt[0], y1: pt[1], base };
      }
      return;
    }

    if (tool === 'eraser') {
      drag.current = { kind: 'erase', ids: new Set() };
      const hit = hitTest(pt, elements, v.zoom, map, (x) => !x.locked);
      if (hit) { drag.current.ids.add(hit.id); setErasing(new Set(drag.current.ids)); }
      return;
    }

    const [x, y] = [sn(pt[0]), sn(pt[1])];
    if (tool === 'text' || tool === 'note') {
      const hit = tool === 'text' ? hitTest(pt, elements, v.zoom, map, (x) => ['rect', 'ellipse', 'diamond', 'note'].includes(x.type)) : undefined;
      if (hit) { setSelected([hit.id]); setEditingId(hit.id); if (!toolLocked) setTool('select'); return; }
      const el = tool === 'text'
        ? makeEl('text', x, y - (style.fontSize + 4) * 0.6, style, { w: 10, h: (style.fontSize + 4) * 1.3 })
        : makeEl('note', x - 100, y - 70, style);
      commit((prev) => [...prev, el]);
      setSelected([el.id]);
      setEditingId(el.id);
      if (!toolLocked) setTool('select');
      return;
    }
    if (tool === 'arrow' || tool === 'line') {
      const target = bindTargetAt(pt, elements, v.zoom, map);
      const el = makeEl(tool, x, y, style, { start: target && tool === 'arrow' ? { id: target.id } : null, strokeWidth: tool === 'arrow' ? Math.max(1.5, style.strokeWidth - 0.25) : style.strokeWidth });
      setLive((prev) => [...prev, el]);
      drag.current = { kind: 'arrow', id: el.id, start: [x, y] };
      return;
    }
    if (tool === 'pen') {
      const el = makeEl('freedraw', pt[0], pt[1], style, { path: [[0, 0]] });
      setLive((prev) => [...prev, el]);
      drag.current = { kind: 'draw', id: el.id, start: pt };
      return;
    }
    // shapes & zone
    const el = tool === 'zone'
      ? makeZone('group', x, y, 0, 0)
      : makeEl(tool as 'rect', x, y, style, { fill: style.fill });
    setLive((prev) => { const n = [...prev]; n.splice(insertIndexFor(prev, el), 0, el); return n; });
    drag.current = { kind: 'create', id: el.id, start: [x, y] };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const pt = toWorld(e.clientX, e.clientY);
    if (!d) {
      // hover cursor for handles
      if (tool === 'select' && selected.length === 1) {
        const el = map.get(selected[0]);
        if (el && !isLinear(el) && el.type !== 'freedraw' && !el.locked) {
          const hs = HANDLE / vp.zoom;
          const h = handlesFor(boundsOf(el)).find(([, q]) => Math.abs(pt[0] - q[0]) < hs && Math.abs(pt[1] - q[1]) < hs);
          setHoverCursor(h ? CURSORS[h[0]] : null);
          return;
        }
      }
      if (hoverCursor) setHoverCursor(null);
      return;
    }
    switch (d.kind) {
      case 'pan':
        setVp((v) => ({ ...v, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy }));
        break;
      case 'marquee': {
        d.x1 = pt[0]; d.y1 = pt[1];
        const b = normBox(d.x0, d.y0, d.x1, d.y1);
        setMarquee(b);
        const inside = elRef.current.filter((el) => {
          const eb = isLinear(el) ? boundsOfPoints(getRoute(el, mapRef.current)) : boundsOf(el);
          return boxContains(b, eb);
        }).map((el) => el.id);
        setSelected([...new Set([...d.base, ...inside])]);
        break;
      }
      case 'move': {
        let dx = pt[0] - d.start[0], dy = pt[1] - d.start[1];
        if (!d.moved && Math.hypot(dx, dy) * vpRef.current.zoom < 3) return;
        d.moved = true;
        if (snapOn) {
          const first = [...d.orig.values()].find((o) => !isLinear(o));
          if (first) { dx = sn(first.x + dx) - first.x; dy = sn(first.y + dy) - first.y; }
        }
        setLive((prev) => prev.map((el) => { const o = d.orig.get(el.id); return o ? translated(o, dx, dy) : el; }));
        break;
      }
      case 'resize': {
        const o = d.orig;
        let { x, y, w, h } = boundsOf(o);
        const [px, py] = [sn(pt[0]), sn(pt[1])];
        const hd = d.handle;
        let x2 = x + w, y2 = y + h;
        if (hd.includes('w')) x = Math.min(px, x2 - 10);
        if (hd.includes('e')) x2 = Math.max(px, x + 10);
        if (hd.includes('n')) y = Math.min(py, y2 - 10);
        if (hd.includes('s')) y2 = Math.max(py, y + 10);
        let nw = x2 - x, nh = y2 - y;
        if ((e.shiftKey || o.type === 'text' || o.type === 'image') && hd.length === 2) {
          const ratio = o.w / (o.h || 1);
          if (nw / nh > ratio) nw = nh * ratio; else nh = nw / ratio;
          if (hd.includes('w')) x = x2 - nw;
          if (hd.includes('n')) y = y2 - nh;
        }
        const patch: Partial<El> = { x, y, w: nw, h: nh };
        if (o.type === 'text') patch.fontSize = Math.max(6, (o.fontSize ?? 20) * (nh / (o.h || 1)));
        if (o.type === 'service' && o.variant !== 'icon') { patch.w = Math.max(120, nw); patch.h = Math.max(48, nh); }
        setLive((prev) => prev.map((el) => (el.id === d.id ? { ...el, ...patch } : el)));
        break;
      }
      case 'create': {
        let [px, py] = [sn(pt[0]), sn(pt[1])];
        if (e.shiftKey) { const s = Math.max(Math.abs(px - d.start[0]), Math.abs(py - d.start[1])); px = d.start[0] + Math.sign(px - d.start[0] || 1) * s; py = d.start[1] + Math.sign(py - d.start[1] || 1) * s; }
        const b = normBox(d.start[0], d.start[1], px, py);
        d.box = b;
        setLive((prev) => prev.map((el) => (el.id === d.id ? { ...el, ...b } : el)));
        break;
      }
      case 'arrow': {
        const target = bindTargetAt(pt, elRef.current, vpRef.current.zoom, mapRef.current, d.id);
        const isArrow = mapRef.current.get(d.id)?.type === 'arrow';
        setBindTarget(isArrow ? target?.id ?? null : null);
        let end: Pt = [sn(pt[0]), sn(pt[1])];
        if (e.shiftKey) {
          const dx = end[0] - d.start[0], dy = end[1] - d.start[1];
          const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
          const len = Math.hypot(dx, dy);
          end = [d.start[0] + Math.cos(ang) * len, d.start[1] + Math.sin(ang) * len];
        }
        d.end = end; d.endId = isArrow && target ? target.id : null;
        setLive((prev) => prev.map((el) => (el.id === d.id ? { ...el, points: [el.points![0], end], end: isArrow && target ? { id: target.id } : null } : el)));
        break;
      }
      case 'endpoint': {
        const target = d.orig.type === 'arrow' ? bindTargetAt(pt, elRef.current, vpRef.current.zoom, mapRef.current, d.id) : undefined;
        setBindTarget(target?.id ?? null);
        const q: Pt = [sn(pt[0]), sn(pt[1])];
        setLive((prev) => prev.map((el) => {
          if (el.id !== d.id) return el;
          const pts = [...(el.points ?? [])] as Pt[];
          if (d.which === 'start') pts[0] = q; else pts[pts.length - 1] = q;
          return { ...el, points: pts, [d.which]: target ? { id: target.id } : null };
        }));
        break;
      }
      case 'draw': {
        setLive((prev) => prev.map((el) => (el.id === d.id ? { ...el, path: [...(el.path ?? []), [pt[0] - el.x, pt[1] - el.y] as Pt] } : el)));
        break;
      }
      case 'erase': {
        const hit = hitTest(pt, elRef.current, vpRef.current.zoom, mapRef.current, (x) => !x.locked);
        if (hit && !d.ids.has(hit.id)) { d.ids.add(hit.id); setErasing(new Set(d.ids)); }
        break;
      }
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setBindTarget(null);
    if (!d) return;
    switch (d.kind) {
      case 'marquee': setMarquee(null); break;
      case 'move': if (d.moved) endLive(); break;
      case 'resize': case 'endpoint': endLive(); break;
      case 'create': {
        const el = elRef.current.find((x) => x.id === d.id);
        if (el && (!d.box || (d.box.w < 6 && d.box.h < 6))) {
          const size = el.type === 'zone' ? { w: 480, h: 320 } : el.type === 'ellipse' ? { w: 140, h: 100 } : el.type === 'diamond' ? { w: 160, h: 110 } : { w: 180, h: 90 };
          setLive((prev) => prev.map((x) => (x.id === d.id ? { ...x, x: x.x - size.w / 2, y: x.y - size.h / 2, ...size } : x)));
        }
        finishCreate(d.id);
        break;
      }
      case 'arrow': {
        const el = elRef.current.find((x) => x.id === d.id);
        if (el) {
          const a = d.start, b = d.end ?? d.start;
          const tiny = Math.hypot(b[0] - a[0], b[1] - a[1]) < 8;
          if (tiny && !(el.start && d.endId && el.start.id !== d.endId)) {
            setLive((prev) => prev.filter((x) => x.id !== d.id));
            endLive();
            return;
          }
        }
        finishCreate(d.id);
        break;
      }
      case 'draw': {
        setLive((prev) => prev.map((el) => {
          if (el.id !== d.id || !el.path) return el;
          const b = boundsOfPoints(el.path);
          return { ...el, x: el.x + b.x, y: el.y + b.y, w: b.w, h: b.h, path: el.path.map(([x, y]) => [x - b.x, y - b.y] as Pt) };
        }));
        endLive();
        if (!toolLocked) { /* keep pen active — drawing usually continues */ }
        break;
      }
      case 'erase': {
        if (d.ids.size) commit((prev) => prev.filter((x) => !d.ids.has(x.id) && !(isLinear(x) && ((x.start && d.ids.has(x.start.id)) || (x.end && d.ids.has(x.end.id))))));
        setErasing(new Set());
        break;
      }
    }
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (tool !== 'select') return;
    const pt = toWorld(e.clientX, e.clientY);
    const hit = hitTest(pt, elements, vp.zoom, map);
    if (hit && hit.type !== 'freedraw' && hit.type !== 'image') {
      setSelected([hit.id]);
      setEditingId(hit.id);
      return;
    }
    const el = makeEl('text', pt[0], pt[1] - (style.fontSize + 4) * 0.6, style, { w: 10, h: (style.fontSize + 4) * 1.3 });
    commit((prev) => [...prev, el]);
    setSelected([el.id]);
    setEditingId(el.id);
  };

  // drag & drop from the library or from the OS
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const pt = toWorld(e.clientX, e.clientY);
    const raw = e.dataTransfer.getData('application/x-gdraw');
    if (raw) {
      const item = JSON.parse(raw) as { kind: 'service' | 'zone' | 'shape'; id: string; variant?: 'card' | 'icon' };
      let el: El;
      if (item.kind === 'service') {
        el = makeService(item.id, 0, 0, item.variant ?? 'card');
        el.x = sn(pt[0] - el.w / 2); el.y = sn(pt[1] - el.h / 2);
      } else if (item.kind === 'zone') {
        el = makeZone(item.id as ZoneKind, sn(pt[0] - 240), sn(pt[1] - 160));
      } else {
        el = makeEl(item.id as 'rect', sn(pt[0] - 90), sn(pt[1] - 45), style, { w: 180, h: 90, fill: style.fill });
      }
      commit((prev) => { const n = [...prev]; n.splice(insertIndexFor(prev, el), 0, el); return n; });
      setSelected([el.id]);
      return;
    }
    if (e.dataTransfer.files.length) onDropFiles([...e.dataTransfer.files], pt);
  };

  // selection overlay
  const selEls = selected.map((id) => map.get(id)).filter(Boolean) as El[];
  const hs = HANDLE / vp.zoom;
  const overlay = (
    <g pointerEvents="none">
      {selEls.map((el) => {
        if (isLinear(el)) {
          const r = getRoute(el, map);
          return (
            <g key={el.id}>
              <path d={'M' + r.map((q) => q.join(',')).join(' L')} fill="none" stroke={p.selection} strokeWidth={1 / vp.zoom} strokeDasharray={`${4 / vp.zoom} ${3 / vp.zoom}`} />
              {selEls.length === 1 && [r[0], r[r.length - 1]].map((q, i) => (
                <circle key={i} cx={q[0]} cy={q[1]} r={hs * 0.6} fill={p.canvas} stroke={p.selection} strokeWidth={1.5 / vp.zoom} />
              ))}
            </g>
          );
        }
        const b = boundsOf(el);
        const pad = 4 / vp.zoom;
        return (
          <g key={el.id}>
            <rect x={b.x - pad} y={b.y - pad} width={b.w + pad * 2} height={b.h + pad * 2} rx={6 / vp.zoom} fill="none" stroke={p.selection} strokeWidth={1.5 / vp.zoom} />
            {selEls.length === 1 && !el.locked && el.type !== 'freedraw' && handlesFor(b).map(([h, q]) => (
              <rect key={h} x={q[0] - hs / 2} y={q[1] - hs / 2} width={hs} height={hs} rx={hs / 3} fill={p.canvas} stroke={p.selection} strokeWidth={1.5 / vp.zoom} />
            ))}
            {el.locked && <text x={b.x + b.w - 14 / vp.zoom} y={b.y - 8 / vp.zoom} fontFamily='"Material Symbols Outlined"' fontSize={14 / vp.zoom} fill={p.selection}>lock</text>}
          </g>
        );
      })}
      {selEls.length > 1 && (() => {
        const u = unionBoxes(selEls.map((el) => (isLinear(el) ? boundsOfPoints(getRoute(el, map)) : boundsOf(el))));
        return u && <rect x={u.x - 8 / vp.zoom} y={u.y - 8 / vp.zoom} width={u.w + 16 / vp.zoom} height={u.h + 16 / vp.zoom} rx={8 / vp.zoom} fill="none" stroke={p.selection} strokeWidth={1 / vp.zoom} strokeDasharray={`${5 / vp.zoom} ${4 / vp.zoom}`} />;
      })()}
      {bindTarget && map.get(bindTarget) && (() => {
        const b = boundsOf(map.get(bindTarget)!);
        const pad = 6 / vp.zoom;
        return <rect x={b.x - pad} y={b.y - pad} width={b.w + pad * 2} height={b.h + pad * 2} rx={14 / vp.zoom} fill={p.selectionFill} stroke={p.selection} strokeWidth={2 / vp.zoom} />;
      })()}
      {marquee && <rect x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h} fill={p.selectionFill} stroke={p.selection} strokeWidth={1 / vp.zoom} rx={2 / vp.zoom} />}
    </g>
  );

  const cursor = drag.current?.kind === 'pan' || spaceDown ? 'grabbing'
    : tool === 'hand' ? 'grab'
      : tool === 'select' ? hoverCursor ?? 'default'
        : tool === 'eraser' ? 'cell'
          : tool === 'text' ? 'text' : 'crosshair';

  const gs = GRID * vp.zoom * (vp.zoom < 0.5 ? 5 : 1);

  return (
    <div className="canvas-wrap" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <svg
        ref={svgRef}
        className="canvas-svg"
        style={{ cursor, background: p.canvas }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        <SvgDefs p={p} />
        {grid && (
          <>
            <defs>
              <pattern id="gd-grid" width={gs} height={gs} patternUnits="userSpaceOnUse" x={vp.x % gs} y={vp.y % gs}>
                <circle cx={1} cy={1} r={vp.zoom < 0.5 ? 1 : Math.max(0.6, Math.min(1.4, vp.zoom))} fill={p.grid} />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#gd-grid)" />
          </>
        )}
        <g transform={`translate(${vp.x},${vp.y}) scale(${vp.zoom})`}>
          {elements.map((el) => (
            <g key={el.id} className={erasing.has(el.id) ? 'erasing' : undefined}>
              <ElView el={el} p={p} s={el.start ? map.get(el.start.id) : undefined} e={el.end ? map.get(el.end.id) : undefined} editing={editingId === el.id} />
            </g>
          ))}
          {overlay}
        </g>
      </svg>
      {editingId && map.get(editingId) && (
        <TextEditor key={editingId} el={map.get(editingId)!} vp={vp} p={p} map={map}
          onDone={(text) => {
            const el = map.get(editingId)!;
            setEditingId(null);
            if (el.type === 'text' && !text.trim()) { commit((prev) => prev.filter((x) => x.id !== el.id)); setSelected([]); return; }
            if ((el.text ?? '') === text && el.type !== 'text') return;
            commit((prev) => prev.map((x) => {
              if (x.id !== el.id) return x;
              if (x.type === 'text') { const s = textBlockSize(text, x.fontSize ?? 20); return { ...x, text, w: s.w, h: s.h }; }
              if (x.type === 'service' && !text.trim()) return { ...x, text: undefined };
              return { ...x, text: text || undefined };
            }));
          }} />
      )}
    </div>
  );
}

function TextEditor({ el, vp, p, map, onDone }: { el: El; vp: Viewport; p: Palette; map: Map<string, El>; onDone: (t: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const initial = el.text ?? (el.type === 'zone' ? ZONE_STYLES[el.zoneKind ?? 'group'].label : el.type === 'service' ? '' : '');
  const [val, setVal] = useState(initial);
  const done = useRef(false);
  const finish = () => { if (done.current) return; done.current = true; onDone(val); };

  useLayoutEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

  const z = vp.zoom;
  const toScreen = (x: number, y: number) => [x * z + vp.x, y * z + vp.y];
  let box: { left: number; top: number; width: number; height?: number }, size: number, align: 'left' | 'center' = 'center', color = p.ink, weight = 400;
  if (el.type === 'text') {
    size = (el.fontSize ?? 20) * z; align = 'left';
    const [l, t] = toScreen(el.x, el.y);
    box = { left: l, top: t, width: Math.max(40, (textBlockSize(val || ' ', el.fontSize ?? 20).w + 20) * z) };
  } else if (el.type === 'note') {
    size = (el.fontSize ?? 15) * z; align = 'left';
    const [l, t] = toScreen(el.x + 14, el.y + 12);
    box = { left: l, top: t, width: (el.w - 28) * z, height: (el.h - 28) * z };
    color = p.mode === 'dark' ? '#F1E9B8' : '#3C4043';
  } else if (el.type === 'zone') {
    size = (el.fontSize ?? 13) * z; align = 'left'; weight = 500;
    const [l, t] = toScreen(el.x + 34, el.y + 6);
    box = { left: l, top: t, width: Math.max(160, 260 * z) };
  } else if (el.type === 'arrow' || el.type === 'line') {
    size = (el.fontSize ?? 12) * z;
    const m = polylineMid(getRoute(el, map));
    const [l, t] = toScreen(m[0], m[1]);
    box = { left: l - 90, top: t - size, width: 180 };
  } else if (el.type === 'service') {
    size = 14 * z; weight = 500;
    const [l, t] = toScreen(el.x, el.y + el.h + 6);
    box = { left: l, top: t, width: Math.max(160, el.w * z) };
  } else {
    size = (el.fontSize ?? 16) * z;
    const [l, t] = toScreen(el.x, el.y);
    box = { left: l, top: t, width: el.w * z, height: el.h * z };
  }
  const centered = box.height !== undefined && el.type !== 'note';
  const lines = Math.max(1, val.split('\n').length);

  return (
    <div className={`text-editor ${el.type === 'service' || el.type === 'arrow' || el.type === 'line' ? 'boxed' : ''}`}
      style={{ left: box.left, top: box.top, width: box.width, height: box.height, alignItems: centered ? 'center' : 'flex-start' }}>
      <textarea
        ref={ref}
        value={val}
        placeholder={el.type === 'service' ? 'Label' : el.type === 'arrow' || el.type === 'line' ? 'Label' : ''}
        rows={lines}
        spellCheck={false}
        onChange={(e) => setVal(e.target.value)}
        onBlur={finish}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); finish(); }
          if (e.key === 'Enter' && !e.shiftKey && (el.type === 'zone' || el.type === 'service' || el.type === 'arrow' || el.type === 'line')) { e.preventDefault(); finish(); }
        }}
        style={{ fontSize: size, lineHeight: 1.3, textAlign: align, color, fontWeight: weight, fontFamily: DIAGRAM_FONT, width: '100%' }}
      />
    </div>
  );
}

export { uid };
