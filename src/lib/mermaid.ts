import type { DiagramSpec, El, ZoneKind } from './types';
import { matchService, serviceInfo, ZONE_STYLES, CATEGORIES, iconUrl } from './services';
import { boundsOf, boxContains } from './geometry';
import type { ThemeMode } from './theme';

// ---------------------------------------------------------------------------
// Google-flavoured Mermaid theme
// ---------------------------------------------------------------------------
export function mermaidConfig(mode: ThemeMode) {
  const dark = mode === 'dark';
  return {
    startOnLoad: false,
    securityLevel: 'loose' as const,
    theme: 'base' as const,
    fontFamily: '"Google Sans", Roboto, system-ui, sans-serif',
    flowchart: { curve: 'basis' as const, padding: 18, nodeSpacing: 46, rankSpacing: 64, htmlLabels: true },
    themeVariables: {
      fontFamily: '"Google Sans", Roboto, system-ui, sans-serif',
      fontSize: '15px',
      background: dark ? '#131314' : '#FFFFFF',
      primaryColor: dark ? '#1C2B4A' : '#E8F0FE',
      primaryBorderColor: dark ? '#A8C7FA' : '#4285F4',
      primaryTextColor: dark ? '#E3E3E3' : '#202124',
      secondaryColor: dark ? '#183A24' : '#E6F4EA',
      secondaryBorderColor: '#34A853',
      tertiaryColor: dark ? '#3D3215' : '#FEF7E0',
      tertiaryBorderColor: '#F9AB00',
      lineColor: dark ? '#9AA0A6' : '#5F6368',
      textColor: dark ? '#E3E3E3' : '#202124',
      clusterBkg: dark ? '#1B1B1B' : '#F8F9FA',
      clusterBorder: dark ? '#444746' : '#DADCE0',
      edgeLabelBackground: dark ? '#1E1F20' : '#FFFFFF',
      noteBkgColor: dark ? '#4A4416' : '#FEF7E0',
      noteBorderColor: '#F9AB00',
      actorBkg: dark ? '#1C2B4A' : '#E8F0FE',
      actorBorder: '#4285F4',
      signalColor: dark ? '#E3E3E3' : '#3C4043',
      pie1: '#4285F4', pie2: '#EA4335', pie3: '#FBBC04', pie4: '#34A853', pie5: '#A142F4', pie6: '#12B5CB',
      git0: '#4285F4', git1: '#EA4335', git2: '#FBBC04', git3: '#34A853',
      cScale0: '#4285F4', cScale1: '#EA4335', cScale2: '#FBBC04', cScale3: '#34A853',
    },
    themeCSS: `
      .node rect, .node polygon, .node circle, .node path { stroke-width: 1.5px; }
      .node rect { rx: 12px; ry: 12px; }
      .cluster rect { rx: 16px; ry: 16px; stroke-width: 1.5px; stroke-dasharray: 6 4; }
      .cluster-label, .cluster-label span { font-weight: 500; }
      .edgeLabel, .edgeLabel p { border-radius: 8px; padding: 1px 6px; font-size: 12px; font-weight: 500; color: ${dark ? '#C4C7C5' : '#5F6368'}; }
      .flowchart-link { stroke-width: 1.75px; }
      .gd-oi { width: 24px !important; height: 24px !important; vertical-align: -7px; margin-right: 8px; display: inline-block !important; }
      .gd-mi { font-family: 'Material Symbols Outlined'; font-size: 20px; vertical-align: -5px; margin-right: 6px; font-weight: normal; font-style: normal; line-height: 1; letter-spacing: normal; text-transform: none; white-space: nowrap; direction: ltr; -webkit-font-feature-settings: 'liga'; font-feature-settings: 'liga'; }
    `,
  };
}

const NODE_RE = /(^|[\s;&>|-])([A-Za-z_][\w-]*)(\[\[|\[\(|\(\(\(|\(\(|\(\[|\[\/|\[\\|\{\{|\[|\(|\{|>)("?)([^"\]\)\}\n]*?)("?)(\]\]|\)\]|\)\)\)|\)\)|\]\)|\/\]|\\\]|\}\}|\]|\)|\})/g;

/** Inject Google Cloud icons + category colours into a flowchart. Other diagram types pass through. */
export function googleFlavor(code: string, mode: ThemeMode): { code: string; icons: string[] } {
  const first = code.trim().split('\n')[0] ?? '';
  if (!/^\s*(flowchart|graph)\b/i.test(first)) return { code, icons: [] };
  const icons = new Set<string>();
  const assignments: string[] = [];
  const used = new Set<string>();
  const lines = code.split('\n').map((line, i) => {
    if (i === 0 || /^\s*(%%|classDef|class |style |linkStyle|click |subgraph|end\b|direction)/.test(line)) return line;
    return line.replace(NODE_RE, (m, pre, id, open, _q1, label, _q2, close) => {
      const svc = matchService(label);
      if (!svc) return m;
      const { service, category } = serviceInfo(svc);
      if (!used.has(id)) { assignments.push(`class ${id} gcp_${category.id}`); used.add(id); }
      const clean = String(label).replace(/"/g, "'");
      if (service.file) return `${pre}${id}${open}"<img src='${iconUrl(service.file)}' class='gd-oi' width='24' height='24'/>${clean}"${close}`;
      icons.add(service.icon);
      return `${pre}${id}${open}"<span class='gd-mi' style='color:${category.color}'>${service.icon}</span>${clean}"${close}`;
    });
  });
  const dark = mode === 'dark';
  const defs = CATEGORIES.map((c) => `classDef gcp_${c.id} fill:${dark ? c.darkTint : '#FFFFFF'},stroke:${c.color},color:${dark ? '#E3E3E3' : '#202124'},stroke-width:1.5px`);
  return { code: [...lines, ...defs, ...assignments].join('\n'), icons: [...icons] };
}

// ---------------------------------------------------------------------------
// Mermaid flowchart → DiagramSpec (editable canvas elements)
// ---------------------------------------------------------------------------
const SHAPES: [string, string, 'rect' | 'ellipse' | 'diamond'][] = [
  ['(((', ')))', 'ellipse'], ['((', '))', 'ellipse'], ['([', '])', 'rect'], ['[[', ']]', 'rect'], ['[(', ')]', 'rect'],
  ['[/', '/]', 'rect'], ['[\\', '\\]', 'rect'], ['[/', '\\]', 'rect'], ['{{', '}}', 'diamond'], ['[', ']', 'rect'], ['(', ')', 'rect'], ['{', '}', 'diamond'], ['>', ']', 'rect'],
];

export function guessZoneKind(label: string): ZoneKind {
  const l = label.toLowerCase();
  if (/google cloud|\bgcp\b/.test(l)) return 'cloud';
  if (/on-?prem|data ?center/.test(l)) return 'onprem';
  if (/subnet/.test(l)) return 'subnet';
  if (/\bvpc\b|network/.test(l)) return 'vpc';
  if (/agent engine|agent runtime|\bagents?\b|\badk\b|\ba2a\b/.test(l)) return 'agent';
  if (/gke|cluster|kubernetes/.test(l)) return 'cluster';
  if (/region|us-|europe-|asia-|\bemea\b/.test(l)) return 'region';
  if (/\bzone\b|-[a-f]$/.test(l)) return 'zone';
  if (/project/.test(l)) return 'project';
  if (/external|internet|third|saas|client/.test(l)) return 'external';
  return 'group';
}

function cleanLabel(s: string) {
  return s.replace(/^"|"$/g, '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/fa:fa-[\w-]+/g, '').replace(/&nbsp;/g, ' ').trim();
}

export function parseMermaidFlowchart(code: string): DiagramSpec {
  const lines = code.replace(/%%.*$/gm, '').split(/\n|;/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) throw new Error('Empty diagram');
  const head = lines[0].match(/^(flowchart|graph)\s*(TD|TB|LR|RL|BT)?/i);
  if (!head) throw new Error('Only Mermaid flowcharts ("flowchart LR" / "graph TD") can be converted to editable shapes. Use "Insert as image" for other diagram types.');
  const dir = (head[2] ?? 'TB').toUpperCase();
  const spec: DiagramSpec = { direction: dir === 'LR' || dir === 'RL' ? 'LR' : 'TB', groups: [], nodes: [], edges: [] };
  const nodes = new Map<string, DiagramSpec['nodes'][number]>();
  const stack: string[] = [];

  const ensure = (id: string, label?: string, shape?: 'rect' | 'ellipse' | 'diamond') => {
    let n = nodes.get(id);
    if (!n) {
      n = { id, label: label ?? id, group: stack[stack.length - 1] ?? null };
      nodes.set(id, n); spec.nodes.push(n);
    }
    if (label !== undefined) n.label = label;
    if (shape) n.shape = shape;
    return n;
  };

  const parseNode = (s: string, pos: number): { ids: string[]; pos: number } | null => {
    const ids: string[] = [];
    for (;;) {
      while (s[pos] === ' ') pos++;
      const m = /^[A-Za-z0-9_][\w-]*/.exec(s.slice(pos));
      if (!m) return ids.length ? { ids, pos } : null;
      let id = m[0];
      // avoid swallowing an edge operator like "A--"
      const dashAt = id.search(/--|-\./);
      if (dashAt > 0) id = id.slice(0, dashAt);
      pos += id.length;
      let label: string | undefined, shape: 'rect' | 'ellipse' | 'diamond' | undefined;
      for (const [o, c, sh] of SHAPES) {
        if (s.startsWith(o, pos)) {
          let start = pos + o.length, endIdx: number;
          if (s[start] === '"') { const q = s.indexOf('"', start + 1); endIdx = s.indexOf(c, q + 1); }
          else endIdx = s.indexOf(c, start);
          if (endIdx < 0) continue;
          label = cleanLabel(s.slice(start, endIdx));
          shape = sh; pos = endIdx + c.length; break;
        }
      }
      const cls = /^:::[\w-]+/.exec(s.slice(pos)); if (cls) pos += cls[0].length;
      if (!spec.groups!.some((g) => g.id === id)) { ensure(id, label, shape); ids.push(id); }
      while (s[pos] === ' ') pos++;
      if (s[pos] === '&') { pos++; continue; }
      return { ids, pos };
    }
  };

  const EDGE_TEXT = /^(<)?(-\.|--|==)\s*([^>|]+?)\s*(\.->|-->|==>|---|===|\.-)/;
  const EDGE = /^(<)?(-\.+-?>?|={2,}>?|-{2,}[>xo]?|~~~)/;

  for (let li = 1; li < lines.length; li++) {
    const line = lines[li];
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^subgraph\s+(.*)$/i))) {
      const rest = m[1].trim();
      let id: string, label: string;
      const br = rest.match(/^([\w-]+)\s*\[(.*)\]$/);
      if (br) { id = br[1]; label = cleanLabel(br[2]); }
      else if (/^"/.test(rest)) { label = cleanLabel(rest); id = 'sg_' + label.replace(/\W+/g, '_'); }
      else if (/\s/.test(rest)) { label = rest; id = 'sg_' + rest.replace(/\W+/g, '_'); }
      else { id = rest; label = rest; }
      spec.groups!.push({ id, label, kind: guessZoneKind(label), parent: stack[stack.length - 1] ?? null });
      stack.push(id);
      continue;
    }
    if (/^end$/i.test(line)) { stack.pop(); continue; }
    if (/^(classDef|class|style|linkStyle|click|direction|accTitle|accDescr)\b/.test(line)) continue;

    let pos = 0;
    let left = parseNode(line, pos);
    if (!left) continue;
    pos = left.pos;
    while (pos < line.length) {
      while (line[pos] === ' ') pos++;
      const rest = line.slice(pos);
      let em = rest.match(EDGE_TEXT), label: string | undefined, op: string;
      if (em) { op = (em[1] ?? '') + em[2] + em[4]; label = em[3]; pos += em[0].length; }
      else if ((em = rest.match(EDGE))) { op = (em[1] ?? '') + em[2]; pos += em[0].length; }
      else break;
      while (line[pos] === ' ') pos++;
      const pipe = line.slice(pos).match(/^\|([^|]*)\|/);
      if (pipe) { label = cleanLabel(pipe[1]); pos += pipe[0].length; }
      const right = parseNode(line, pos);
      if (!right) break;
      pos = right.pos;
      if (op !== '~~~') {
        for (const a of left.ids) for (const b of right.ids) {
          spec.edges!.push({
            from: a, to: b, label: label || undefined,
            style: op.includes('.') ? 'dashed' : 'solid',
            bidirectional: op.startsWith('<'),
          });
        }
      }
      left = right;
    }
  }
  // annotate service matches
  for (const n of spec.nodes) { const svc = matchService(n.label); if (svc && n.shape !== 'diamond') n.service = svc; else n.service = 'none', n.shape = n.shape ?? 'rect'; }
  return spec;
}

// ---------------------------------------------------------------------------
// Canvas → structured spec / Mermaid
// ---------------------------------------------------------------------------
const NODE_TYPES = new Set(['service', 'rect', 'ellipse', 'diamond', 'note', 'text']);

export function elementsToSpec(elements: El[]): DiagramSpec {
  const zones = elements.filter((e) => e.type === 'zone').sort((a, b) => a.w * a.h - b.w * b.h);
  const nodes = elements.filter((e) => NODE_TYPES.has(e.type) && (e.type !== 'text' || e.text));
  const containing = (el: El) => zones.find((z) => z.id !== el.id && boxContains(boundsOf(z), boundsOf(el)));
  const short = new Map<string, string>();
  let i = 0;
  const sid = (id: string, p: string) => { if (!short.has(id)) short.set(id, `${p}${++i}`); return short.get(id)!; };
  const spec: DiagramSpec = { direction: 'LR', groups: [], nodes: [], edges: [] };
  for (const z of zones) {
    const parent = containing(z);
    spec.groups!.push({ id: sid(z.id, 'g'), label: z.text ?? ZONE_STYLES[z.zoneKind ?? 'group'].label, kind: z.zoneKind, parent: parent ? sid(parent.id, 'g') : null });
  }
  for (const n of nodes) {
    const z = containing(n);
    const label = n.type === 'service' ? (n.text ?? serviceInfo(n.service).service.name) : (n.text || n.type);
    spec.nodes.push({
      id: sid(n.id, 'n'), label: label.replace(/\n/g, ' '), service: n.type === 'service' ? n.service : 'none',
      subtitle: n.subtitle, group: z ? sid(z.id, 'g') : null,
      shape: n.type === 'ellipse' ? 'ellipse' : n.type === 'diamond' ? 'diamond' : n.type === 'service' ? undefined : 'rect',
    });
  }
  for (const a of elements.filter((e) => e.type === 'arrow' || e.type === 'line')) {
    if (!a.start?.id || !a.end?.id || !short.has(a.start.id) || !short.has(a.end.id)) continue;
    spec.edges!.push({ from: short.get(a.start.id)!, to: short.get(a.end.id)!, label: a.text, style: a.strokeStyle, animated: a.animated, bidirectional: a.startHead !== 'none' && !!a.startHead });
  }
  return spec;
}

const esc = (s: string) => s.replace(/"/g, "'").replace(/\n/g, '<br/>');

export function specToMermaid(spec: DiagramSpec): string {
  const out = [`flowchart ${spec.direction ?? 'LR'}`];
  const nodeLine = (n: DiagramSpec['nodes'][number]) => {
    const label = esc(n.label + (n.subtitle ? `<br/><small>${n.subtitle}</small>` : ''));
    if (n.shape === 'diamond') return `${n.id}{"${label}"}`;
    if (n.shape === 'ellipse') return `${n.id}(("${label}"))`;
    if (n.service && n.service !== 'none' && /database|sql|spanner|alloy|firestore|bigtable/.test(n.service)) return `${n.id}[("${label}")]`;
    return `${n.id}["${label}"]`;
  };
  const emit = (parent: string | null, indent: string) => {
    for (const n of spec.nodes.filter((n) => (n.group ?? null) === parent)) out.push(indent + nodeLine(n));
    for (const g of (spec.groups ?? []).filter((g) => (g.parent ?? null) === parent)) {
      out.push(`${indent}subgraph ${g.id}["${esc(g.label)}"]`);
      emit(g.id, indent + '  ');
      out.push(`${indent}end`);
    }
  };
  emit(null, '  ');
  for (const e of spec.edges ?? []) {
    const op = e.style === 'dashed' || e.style === 'dotted' ? '-.->' : e.animated ? '==>' : '-->';
    const fullOp = e.bidirectional ? '<' + op : op;
    out.push(`  ${e.from} ${fullOp}${e.label ? `|${esc(e.label)}|` : ''} ${e.to}`);
  }
  return out.join('\n');
}

export const SAMPLE_MERMAID = `flowchart LR
  users["Users"] --> lb["Cloud Load Balancing"]
  subgraph gcp["Google Cloud"]
    lb --> run["Cloud Run"]
    subgraph data["Data tier · us-central1"]
      sql[("Cloud SQL")]
      cache["Memorystore"]
    end
    run -->|SQL| sql
    run -.->|cache| cache
    run --> ps["Pub/Sub"]
    ps ==> df["Dataflow"] ==> bq["BigQuery"]
    run --> gem["Gemini on Vertex AI"]
  end
  bq --> looker["Looker"]`;
