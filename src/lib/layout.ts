import dagre from '@dagrejs/dagre';
import type { DiagramSpec, El } from './types';
import { makeEl, makeService, makeZone, connector } from './factory';
import { matchService } from './services';
import { measure } from './theme';

const CARD_W = 216, CARD_H = 64;
const ZONE_PAD = 28, ZONE_TOP = 44;

/** Turn a structured diagram spec into positioned canvas elements using dagre (compound graph). */
export function layoutSpec(spec: DiagramSpec, origin: [number, number] = [0, 0]): El[] {
  const g = new dagre.graphlib.Graph({ compound: true, multigraph: true });
  const groups = spec.groups ?? [];
  const groupIds = new Set(groups.map((x) => x.id));
  // dagre's nesting graph multiplies every edge's rank length by (2·depth + 1) for compound
  // graphs, so scale ranksep down to keep the visual gap between columns consistent.
  const gdepth = (id: string, seen = 0): number => {
    const gr = groups.find((x) => x.id === id);
    return gr?.parent && groupIds.has(gr.parent) && seen < 10 ? 1 + gdepth(gr.parent, seen + 1) : 1;
  };
  const maxDepth = groups.length ? Math.max(...groups.map((x) => gdepth(x.id))) : 0;
  const nestFactor = groups.length ? 2 * maxDepth + 1 : 1;
  const horizontal = (spec.direction ?? 'LR') === 'LR';
  g.setGraph({
    rankdir: spec.direction ?? 'LR', nodesep: horizontal ? 40 : 56, ranksep: (horizontal ? 120 : 90) / nestFactor, edgesep: 20,
    marginx: 0, marginy: 0,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const gr of groups) g.setNode(gr.id, { label: gr.label });
  for (const gr of groups) if (gr.parent && groupIds.has(gr.parent)) g.setParent(gr.id, gr.parent);

  const nodeIds = new Set<string>();
  const nodeInfo = new Map<string, { svc?: string; w: number; h: number }>();
  for (const n of spec.nodes) {
    const svc = n.service && n.service !== 'none' ? (matchService(n.service) ?? matchService(n.label)) : (n.shape ? undefined : matchService(n.label));
    let w = CARD_W, h = CARD_H;
    if (!svc) {
      w = Math.max(140, Math.min(260, measure(n.label, 16) + 40));
      h = n.shape === 'diamond' ? 100 : 64;
      if (n.shape === 'diamond') w = Math.max(w, 150);
    }
    nodeInfo.set(n.id, { svc, w, h });
    nodeIds.add(n.id);
    g.setNode(n.id, { width: w, height: h });
    if (n.group && groupIds.has(n.group)) g.setParent(n.id, n.group);
  }
  // dagre crashes on empty clusters — give them a placeholder
  for (const gr of groups) {
    if (!((g.children(gr.id) as unknown as string[]) ?? []).length) g.setNode(`__ph_${gr.id}`, { width: 120, height: 40 }), g.setParent(`__ph_${gr.id}`, gr.id);
  }

  const edges = (spec.edges ?? []).filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));
  edges.forEach((e, i) => g.setEdge(e.from, e.to, { weight: 1, minlen: 1 }, `e${i}`));

  dagre.layout(g);

  const [ox, oy] = origin;
  const out: El[] = [];
  const idMap = new Map<string, string>();

  // zones: compute bottom-up so every zone encloses its children with padding
  const depth = (id: string): number => { const p = g.parent(id); return p ? 1 + depth(p as string) : 0; };
  const boxes = new Map<string, { x: number; y: number; w: number; h: number }>();
  for (const sn of spec.nodes) {
    const n = g.node(sn.id) as any; const info = nodeInfo.get(sn.id)!;
    boxes.set(sn.id, { x: n.x - info.w / 2, y: n.y - info.h / 2, w: info.w, h: info.h });
  }
  for (const gr of groups) if (!((g.children(gr.id) as unknown as string[]) ?? []).some((c) => !String(c).startsWith('__ph_'))) {
    const n = g.node(`__ph_${gr.id}`) as any; if (n) boxes.set(`__ph_${gr.id}`, { x: n.x - 60, y: n.y - 20, w: 120, h: 40 });
  }
  const byDepthDesc = [...groups].sort((a, b) => depth(b.id) - depth(a.id));
  for (const gr of byDepthDesc) {
    const kids = ((g.children(gr.id) as unknown as string[]) ?? []).map((c) => boxes.get(String(c))).filter(Boolean) as { x: number; y: number; w: number; h: number }[];
    if (!kids.length) continue;
    const x1 = Math.min(...kids.map((k) => k.x)) - ZONE_PAD, y1 = Math.min(...kids.map((k) => k.y)) - ZONE_TOP;
    const x2 = Math.max(...kids.map((k) => k.x + k.w)) + ZONE_PAD, y2 = Math.max(...kids.map((k) => k.y + k.h)) + ZONE_PAD;
    const lw = measure(gr.label, 13, 500) + 64;
    boxes.set(gr.id, { x: x1, y: y1, w: Math.max(x2 - x1, lw), h: y2 - y1 });
  }
  const sortedGroups = [...groups].sort((a, b) => depth(a.id) - depth(b.id));
  for (const gr of sortedGroups) {
    const b = boxes.get(gr.id);
    if (!b) continue;
    out.push(makeZone(gr.kind ?? 'group', ox + b.x, oy + b.y, b.w, b.h, { text: gr.label }));
  }
  const nodeEls: El[] = [];
  for (const sn of spec.nodes) {
    const n = g.node(sn.id) as any;
    const info = nodeInfo.get(sn.id)!;
    const x = ox + n.x - info.w / 2, y = oy + n.y - info.h / 2;
    let el: El;
    if (info.svc) el = makeService(info.svc, x, y, 'card', { text: sn.label, subtitle: sn.subtitle });
    else el = makeEl(sn.shape ?? 'rect', x, y, {}, { w: info.w, h: info.h, text: sn.label, fill: sn.shape === 'diamond' ? '#FEF7E0' : '#E8F0FE', stroke: sn.shape === 'diamond' ? '#F9AB00' : '#4285F4' });
    idMap.set(sn.id, el.id);
    nodeEls.push(el);
  }
  for (const e of edges) {
    out.push(connector(idMap.get(e.from)!, idMap.get(e.to)!, {
      text: e.label || undefined, strokeStyle: e.style ?? 'solid', animated: !!e.animated,
      startHead: e.bidirectional ? 'arrow' : 'none',
    }));
  }
  // connectors are drawn beneath the service cards so lines never cross labels
  out.push(...nodeEls);
  return out;
}
