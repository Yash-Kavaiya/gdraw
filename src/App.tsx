import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Canvas, { insertIndexFor } from './components/Canvas';
import Toolbar, { TOOLS } from './components/Toolbar';
import LibraryPanel from './components/LibraryPanel';
import PropertiesPanel, { Align } from './components/PropertiesPanel';
import TemplatesDialog from './components/TemplatesDialog';
import SettingsDialog from './components/SettingsDialog';
import AIPanel from './components/AIPanel';
import MermaidDialog from './components/MermaidDialog';
import { Dialog, Icon, IconButton } from './components/ui';
import type { DiagramSpec, Doc, El, Tool, Viewport } from './lib/types';
import { useHistory, listDocs, saveDoc, deleteDoc, loadCurrent, newDoc } from './lib/store';
import { PALETTES, ThemeMode, textBlockSize } from './lib/theme';
import { DEFAULT_STYLE, makeEl, makeService, makeZone } from './lib/factory';
import { layoutSpec } from './lib/layout';
import { boundsOf, isLinear, uid, Pt } from './lib/geometry';
import { download, exportSvg, sceneBounds, svgToPngBlob, standaloneMermaidSvg } from './lib/export';
import { elementsToSpec, parseMermaidFlowchart, specToMermaid } from './lib/mermaid';
import { AISettings, loadAISettings, saveAISettings } from './lib/ai';
import { TEMPLATES, type Template } from './lib/templates';

const CLIP_MARK = 'gdraw/elements';

function loadTheme(): ThemeMode {
  try { const t = localStorage.getItem('gdraw.theme'); if (t === 'light' || t === 'dark') return t; } catch { /* */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function App() {
  const initialDoc = useMemo(() => loadCurrent() ?? newDoc(), []);
  const [doc, setDoc] = useState<Doc>(initialDoc);
  const hist = useHistory(initialDoc.elements);
  const { elements, commit, setLive, endLive, undo, redo, reset } = hist;

  const [tool, setTool] = useState<Tool>('select');
  const [toolLocked, setToolLocked] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [vp, setVp] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [mode, setMode] = useState<ThemeMode>(loadTheme);
  const [grid, setGrid] = useState(true);
  const [snapOn, setSnapOn] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [libOpen, setLibOpen] = useState(() => window.innerWidth > 900);
  const [aiOpen, setAiOpen] = useState(false);
  const [dialog, setDialog] = useState<null | 'templates' | 'settings' | 'mermaid' | 'docs' | 'help'>(null);
  const [mermaidSeed, setMermaidSeed] = useState<string | undefined>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [aiSettings, setAiSettings] = useState<AISettings>(loadAISettings);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const clipboard = useRef<El[]>([]);
  const toastTimer = useRef<number>();
  const palette = PALETTES[mode];

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 3200);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    try { localStorage.setItem('gdraw.theme', mode); } catch { /* */ }
  }, [mode]);

  // autosave
  useEffect(() => {
    const t = setTimeout(() => saveDoc({ ...doc, elements, updated: Date.now() }), 400);
    return () => clearTimeout(t);
  }, [elements, doc]);

  // ---------- viewport helpers ----------
  const viewSize = () => {
    const left = libOpen && window.innerWidth > 700 ? 312 : 0;
    const right = aiOpen ? 380 : 0;
    return { left, w: window.innerWidth - left - right, h: window.innerHeight - 64 };
  };
  const zoomToFit = useCallback((els: El[] = hist.elements) => {
    const b = sceneBounds(els);
    const { left, w, h } = viewSize();
    if (!b) { setVp({ x: left + 40, y: 40, zoom: 1 }); return; }
    const pad = 80;
    const zoom = Math.min(1.4, Math.max(0.1, Math.min((w - pad * 2) / (b.w || 1), (h - pad * 2) / (b.h || 1))));
    setVp({ zoom, x: left + w / 2 - (b.x + b.w / 2) * zoom, y: h / 2 + 30 - (b.y + b.h / 2) * zoom });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libOpen, aiOpen, hist.elements]);

  useEffect(() => { setTimeout(() => zoomToFit(initialDoc.elements), 50); /* first load */ }, []); // eslint-disable-line

  const zoomBy = (f: number) => setVp((v) => {
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2 - 32;
    const zoom = Math.min(4, Math.max(0.1, v.zoom * f));
    return { zoom, x: cx - ((cx - v.x) / v.zoom) * zoom, y: cy - ((cy - v.y) / v.zoom) * zoom };
  });
  const viewCenter = (): Pt => {
    const { left, w, h } = viewSize();
    return [(left + w / 2 - vp.x) / vp.zoom, (h / 2 - vp.y) / vp.zoom];
  };

  // ---------- element operations ----------
  const selectedEls = useMemo(() => selected.map((id) => elements.find((e) => e.id === id)).filter(Boolean) as El[], [selected, elements]);

  const updateSelected = (patch: Partial<El> | ((e: El) => Partial<El>)) => {
    const ids = new Set(selected);
    commit((prev) => prev.map((e) => (ids.has(e.id) ? { ...e, ...(typeof patch === 'function' ? patch(e) : patch) } : e)));
  };

  const deleteSelected = () => {
    if (!selected.length) return;
    const ids = new Set(selected.filter((id) => !elements.find((e) => e.id === id)?.locked));
    commit((prev) => prev.filter((e) => !ids.has(e.id) && !(isLinear(e) && ((e.start && ids.has(e.start.id)) || (e.end && ids.has(e.end.id))))));
    setSelected([]);
  };

  const cloneEls = (src: El[], dx: number, dy: number) => {
    const idMap = new Map<string, string>();
    src.forEach((e) => idMap.set(e.id, uid()));
    return src.map((e) => ({
      ...e, id: idMap.get(e.id)!, x: e.x + dx, y: e.y + dy, locked: false,
      points: e.points?.map(([x, y]) => [x + dx, y + dy] as Pt),
      start: e.start && idMap.has(e.start.id) ? { id: idMap.get(e.start.id)! } : null,
      end: e.end && idMap.has(e.end.id) ? { id: idMap.get(e.end.id)! } : null,
    }));
  };

  const addEls = (els: El[], select = true) => {
    commit((prev) => {
      const zones = els.filter((e) => e.type === 'zone'), rest = els.filter((e) => e.type !== 'zone');
      const n = [...prev];
      n.splice(insertIndexFor(prev, { type: 'zone' } as El), 0, ...zones);
      return [...n, ...rest];
    });
    if (select) setSelected(els.map((e) => e.id));
  };

  const duplicate = () => { if (selectedEls.length) addEls(cloneEls(selectedEls, 24, 24)); };

  const layer = (dir: 'front' | 'forward' | 'backward' | 'back') => {
    const ids = new Set(selected);
    commit((prev) => {
      const sel = prev.filter((e) => ids.has(e.id)), rest = prev.filter((e) => !ids.has(e.id));
      if (dir === 'front') return [...rest, ...sel];
      if (dir === 'back') return [...sel, ...rest];
      const arr = [...prev];
      const order = dir === 'forward' ? [...arr.keys()].reverse() : [...arr.keys()];
      for (const i of order) {
        if (!ids.has(arr[i].id)) continue;
        const j = dir === 'forward' ? i + 1 : i - 1;
        if (j < 0 || j >= arr.length || ids.has(arr[j].id)) continue;
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    });
  };

  const align = (a: Align) => {
    const els = selectedEls.filter((e) => !isLinear(e));
    if (els.length < 2) return;
    const bs = els.map(boundsOf);
    const minX = Math.min(...bs.map((b) => b.x)), maxX = Math.max(...bs.map((b) => b.x + b.w));
    const minY = Math.min(...bs.map((b) => b.y)), maxY = Math.max(...bs.map((b) => b.y + b.h));
    const pos = new Map<string, { x: number; y: number }>();
    if (a === 'hdist' || a === 'vdist') {
      const key = a === 'hdist' ? 'x' : 'y', size = a === 'hdist' ? 'w' : 'h';
      const sorted = els.map((e, i) => ({ e, b: bs[i] })).sort((p, q) => p.b[key] - q.b[key]);
      const total = sorted.reduce((s, x) => s + x.b[size], 0);
      const span = (a === 'hdist' ? maxX - minX : maxY - minY) - total;
      const gap = span / (sorted.length - 1);
      let cur = a === 'hdist' ? minX : minY;
      for (const { e, b } of sorted) { pos.set(e.id, a === 'hdist' ? { x: cur, y: e.y } : { x: e.x, y: cur }); cur += b[size] + gap; }
    } else {
      els.forEach((e, i) => {
        const b = bs[i];
        const x = a === 'left' ? minX : a === 'right' ? maxX - b.w : a === 'hcenter' ? (minX + maxX) / 2 - b.w / 2 : e.x;
        const y = a === 'top' ? minY : a === 'bottom' ? maxY - b.h : a === 'vcenter' ? (minY + maxY) / 2 - b.h / 2 : e.y;
        pos.set(e.id, { x, y });
      });
    }
    commit((prev) => prev.map((e) => (pos.has(e.id) ? { ...e, ...pos.get(e.id)! } : e)));
  };

  const addFromLibrary = (item: { kind: 'service' | 'zone' | 'shape'; id: string; variant?: 'card' | 'icon' }) => {
    const [cx, cy] = viewCenter();
    const jitter = () => (Math.random() - 0.5) * 60;
    let el: El;
    if (item.kind === 'service') { el = makeService(item.id, 0, 0, item.variant); el.x = cx - el.w / 2 + jitter(); el.y = cy - el.h / 2 + jitter(); }
    else if (item.kind === 'zone') el = makeZone(item.id as any, cx - 240, cy - 160);
    else el = makeEl(item.id as 'rect', cx - 90 + jitter(), cy - 45 + jitter(), DEFAULT_STYLE, { w: 180, h: 90, fill: '#E8F0FE', stroke: '#4285F4' });
    addEls([el]);
    setTool('select');
  };

  const placeSpec = (spec: DiagramSpec, replace: boolean) => {
    let origin: [number, number] = [0, 0];
    const b = sceneBounds(elements);
    if (!replace && b) origin = [b.x + b.w + 160, b.y];
    const els = layoutSpec(spec, origin);
    if (replace) {
      commit(els.filter((e) => e.type === 'zone').concat(els.filter((e) => e.type !== 'zone')));
      setSelected([]);
      if (spec.title && /^Untitled/.test(doc.name)) setDoc((d) => ({ ...d, name: spec.title! }));
      setTimeout(() => zoomToFit(els), 30);
    } else {
      addEls(els);
      setTimeout(() => zoomToFit([...elements, ...els]), 30);
    }
  };

  const useTemplate = (t: Template, replace: boolean) => {
    placeSpec(t.spec, replace || elements.length === 0);
    if (replace || elements.length === 0) setDoc((d) => ({ ...d, name: t.name }));
    setDialog(null);
    toast(`Template “${t.name}” added`);
  };

  const insertMermaidImage = async (svg: string, icons: string[], text: string) => {
    const vb = svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/);
    const w = vb ? +vb[3] : 600, h = vb ? +vb[4] : 400;
    let full = svg.replace(/<svg([^>]*?)width="100%"/, `<svg$1width="${w}"`).replace(/style="max-width:[^"]*"/, `height="${h}"`);
    full = await standaloneMermaidSvg(full, icons, text);
    const src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(full)));
    const [cx, cy] = viewCenter();
    addEls([makeEl('image', cx - w / 2, cy - h / 2, DEFAULT_STYLE, { w, h, src })]);
    toast('Mermaid diagram inserted as image');
  };

  const openFile = async (file: File, at?: Pt) => {
    if (file.type.startsWith('image/')) {
      const src = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(file); });
      const img = new Image();
      await new Promise((res) => { img.onload = res; img.onerror = res; img.src = src; });
      let w = img.naturalWidth || 300, h = img.naturalHeight || 200;
      const s = Math.min(1, 600 / Math.max(w, h)); w *= s; h *= s;
      const [cx, cy] = at ?? viewCenter();
      addEls([makeEl('image', cx - w / 2, cy - h / 2, DEFAULT_STYLE, { w, h, src })]);
      return;
    }
    const text = await file.text();
    if (/\.(mmd|mermaid)$/i.test(file.name)) { setMermaidSeed(text); setDialog('mermaid'); return; }
    try {
      const data = JSON.parse(text);
      const els: El[] = Array.isArray(data) ? data : data.elements;
      if (!Array.isArray(els)) throw new Error();
      const d = { ...newDoc(data.name ?? file.name.replace(/\.\w+$/, '')), elements: els };
      setDoc(d); reset(els); setSelected([]);
      setTimeout(() => zoomToFit(els), 30);
      toast(`Opened ${file.name}`);
    } catch { toast('That file is not a Gdraw diagram'); }
  };

  const openPicker = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,.gdraw,.mmd,.mermaid,image/*';
    inp.onchange = () => inp.files?.[0] && openFile(inp.files[0]);
    inp.click();
  };

  const fileBase = () => doc.name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'diagram';
  const exportEls = () => (selectedEls.length ? selectedEls : elements);

  const doExport = async (kind: 'png' | 'svg' | 'json' | 'mmd' | 'copy') => {
    setExportOpen(false); setMenuOpen(false);
    if (!elements.length) { toast('Canvas is empty'); return; }
    try {
      if (kind === 'json') { download(`${fileBase()}.gdraw.json`, JSON.stringify({ type: 'gdraw', version: 1, name: doc.name, elements }, null, 2), 'application/json'); return; }
      if (kind === 'mmd') { download(`${fileBase()}.mmd`, specToMermaid(elementsToSpec(elements)), 'text/plain'); return; }
      toast('Preparing export…');
      const svg = await exportSvg(exportEls(), mode);
      if (kind === 'svg') { download(`${fileBase()}.svg`, svg, 'image/svg+xml'); toast('SVG exported'); return; }
      const png = await svgToPngBlob(svg, 2);
      if (kind === 'png') { download(`${fileBase()}.png`, png); toast('PNG exported'); return; }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      toast('Copied PNG to clipboard');
    } catch (e: any) { toast(`Export failed: ${e.message ?? e}`); }
  };

  // ---------- keyboard ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]') || editingId || dialog) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && k === 'y') { e.preventDefault(); redo(); return; }
      if (mod && k === 'a') { e.preventDefault(); setSelected(elements.map((x) => x.id)); return; }
      if (mod && k === 'd') { e.preventDefault(); duplicate(); return; }
      if (mod && k === 'c' || mod && k === 'x') {
        if (!selectedEls.length) return;
        clipboard.current = selectedEls;
        // include connectors between copied nodes
        const ids = new Set(selected);
        const extra = elements.filter((x) => isLinear(x) && !ids.has(x.id) && x.start && x.end && ids.has(x.start.id) && ids.has(x.end.id));
        clipboard.current = [...selectedEls, ...extra];
        navigator.clipboard?.writeText(JSON.stringify({ type: CLIP_MARK, elements: clipboard.current })).catch(() => {});
        if (k === 'x') deleteSelected();
        e.preventDefault();
        return;
      }
      if (mod && k === 's') { e.preventDefault(); doExport('json'); return; }
      if (mod && k === 'k') { e.preventDefault(); setAiOpen(true); return; }
      if (mod && k === 'o') { e.preventDefault(); openPicker(); return; }
      if (mod && k === 'l') { e.preventDefault(); updateSelected({ locked: !selectedEls.every((x) => x.locked) }); return; }
      if (mod && (k === '=' || k === '+')) { e.preventDefault(); zoomBy(1.2); return; }
      if (mod && k === '-') { e.preventDefault(); zoomBy(1 / 1.2); return; }
      if (mod && k === '0') { e.preventDefault(); setVp((v) => ({ ...v, zoom: 1 })); return; }
      if (mod && (k === ']' || k === '[')) { e.preventDefault(); layer(k === ']' ? (e.shiftKey ? 'front' : 'forward') : (e.shiftKey ? 'back' : 'backward')); return; }
      if (e.shiftKey && (e.code === 'Digit1')) { e.preventDefault(); zoomToFit(); return; }
      if (mod) return;
      if (k === 'delete' || k === 'backspace') { e.preventDefault(); deleteSelected(); return; }
      if (k === 'escape') { setSelected([]); setTool('select'); setMenuOpen(false); setExportOpen(false); return; }
      if (k === 'enter' && selected.length === 1) { e.preventDefault(); setEditingId(selected[0]); return; }
      if (k.startsWith('arrow') && selected.length) {
        e.preventDefault();
        const s = e.shiftKey ? 20 : 2;
        const [dx, dy] = k === 'arrowleft' ? [-s, 0] : k === 'arrowright' ? [s, 0] : k === 'arrowup' ? [0, -s] : [0, s];
        updateSelected((x) => (x.locked ? {} : { x: x.x + dx, y: x.y + dy, points: x.points?.map(([a, b]) => [a + dx, b + dy] as Pt) }));
        return;
      }
      if (k === '?' ) { setDialog('help'); return; }
      if (k === 'g') { setGrid((g) => !g); return; }
      const toolHit = TOOLS.find((x) => x.key.toLowerCase() === k) ?? (k === '1' ? TOOLS[1] : undefined);
      if (toolHit) { setTool(toolHit.id); if (toolHit.id !== 'select') setSelected([]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---------- paste ----------
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest?.('input, textarea, [contenteditable]') || editingId || dialog) return;
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) { e.preventDefault(); files.forEach((f) => openFile(f)); return; }
      const text = e.clipboardData?.getData('text/plain') ?? '';
      e.preventDefault();
      let src: El[] | null = null;
      try { const d = JSON.parse(text); if (d.type === CLIP_MARK) src = d.elements; } catch { /* not ours */ }
      if (!src && !text && clipboard.current.length) src = clipboard.current;
      if (src) {
        const b = sceneBounds(src)!;
        const [cx, cy] = viewCenter();
        addEls(cloneEls(src, cx - (b.x + b.w / 2), cy - (b.y + b.h / 2)));
        return;
      }
      if (/^\s*(flowchart|graph)\s+(TD|TB|LR|RL|BT)/i.test(text)) {
        try { placeSpec(parseMermaidFlowchart(text), elements.length === 0); toast('Converted pasted Mermaid to an editable diagram'); return; }
        catch { /* fallthrough */ }
      }
      if (/^\s*(sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|journey|mindmap|timeline|gitGraph)/.test(text)) {
        setMermaidSeed(text); setDialog('mermaid'); return;
      }
      if (text.trim()) {
        const [cx, cy] = viewCenter();
        const s = textBlockSize(text, 20);
        addEls([makeEl('text', cx - s.w / 2, cy - s.h / 2, DEFAULT_STYLE, { text, w: s.w, h: s.h })]);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  const switchDoc = (d: Doc) => {
    saveDoc({ ...doc, elements, updated: Date.now() });
    setDoc(d); reset(d.elements); setSelected([]); setDialog(null);
    setTimeout(() => zoomToFit(d.elements), 30);
  };

  const empty = elements.length === 0;

  return (
    <div className="app">
      <div className="brand-bar" aria-hidden />
      <header className="topbar">
        <div className="tb-left">
          <div className="menu-wrap">
            <IconButton icon="menu" label="Menu" onClick={() => setMenuOpen((m) => !m)} />
            {menuOpen && (
              <div className="menu" onPointerLeave={() => setMenuOpen(false)}>
                <button onClick={() => { switchDoc(newDoc()); setMenuOpen(false); }}><Icon name="note_add" />New diagram</button>
                <button onClick={() => { setDialog('docs'); setMenuOpen(false); }}><Icon name="folder_open" />My diagrams</button>
                <button onClick={() => { openPicker(); setMenuOpen(false); }}><Icon name="upload_file" />Open file…<kbd>Ctrl O</kbd></button>
                <button onClick={() => doExport('json')}><Icon name="save" />Save to file<kbd>Ctrl S</kbd></button>
                <hr />
                <button onClick={() => { setDialog('templates'); setMenuOpen(false); }}><Icon name="dashboard_customize" />Templates</button>
                <button onClick={() => { setMermaidSeed(undefined); setDialog('mermaid'); setMenuOpen(false); }}><Icon name="schema" />Mermaid studio</button>
                <button onClick={() => { setDialog('settings'); setMenuOpen(false); }}><Icon name="key" />AI keys & models</button>
                <hr />
                <button onClick={() => { setGrid(!grid); }}><Icon name={grid ? 'check_box' : 'check_box_outline_blank'} />Show dot grid<kbd>G</kbd></button>
                <button onClick={() => { setSnapOn(!snapOn); }}><Icon name={snapOn ? 'check_box' : 'check_box_outline_blank'} />Snap to grid</button>
                <button onClick={() => { setDialog('help'); setMenuOpen(false); }}><Icon name="keyboard" />Keyboard shortcuts<kbd>?</kbd></button>
                <hr />
                <button className="danger" onClick={() => { if (elements.length) { commit([]); setSelected([]); toast('Canvas cleared — Ctrl Z to undo'); } setMenuOpen(false); }}><Icon name="delete_sweep" />Clear canvas</button>
              </div>
            )}
          </div>
          <div className="logo" aria-label="Gdraw">
            <svg viewBox="0 0 48 48" width="30" height="30" aria-hidden>
              <path d="M13 33a8 8 0 0 1-1.2-15.9A12 12 0 0 1 34.6 15 8.5 8.5 0 0 1 36 33Z" fill="#4285F4" />
              <path d="M13 33h11v-7H12.3A8 8 0 0 0 13 33Z" fill="#34A853" />
              <path d="M24 26h11.9A8.5 8.5 0 0 1 36 33H24Z" fill="#FBBC04" />
              <circle cx="31" cy="19" r="3.4" fill="#EA4335" />
              <path d="M17 39h14" stroke="#4285F4" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <span className="logo-text"><b>Gdraw</b></span>
          </div>
          <input className="doc-name" value={doc.name} onChange={(e) => setDoc({ ...doc, name: e.target.value })} aria-label="Diagram name" />
          <span className="saved"><Icon name="cloud_done" size={18} /> Saved locally</span>
        </div>
        <div className="tb-right">
          <button className="btn tonal" onClick={() => setDialog('templates')}><Icon name="dashboard_customize" size={18} /><span className="hide-sm">Templates</span></button>
          <button className="btn outlined" onClick={() => { setMermaidSeed(undefined); setDialog('mermaid'); }}><Icon name="schema" size={18} /><span className="hide-sm">Mermaid</span></button>
          <button className="btn gemini" onClick={() => setAiOpen((o) => !o)}><Icon name="auto_awesome" size={18} fill /><span className="hide-sm">Ask AI</span></button>
          <div className="menu-wrap">
            <button className="btn filled" onClick={() => setExportOpen((o) => !o)}><Icon name="ios_share" size={18} /><span className="hide-sm">Export</span></button>
            {exportOpen && (
              <div className="menu right" onPointerLeave={() => setExportOpen(false)}>
                <div className="menu-note">{selectedEls.length ? `Exporting ${selectedEls.length} selected` : 'Exporting whole canvas'}</div>
                <button onClick={() => doExport('png')}><Icon name="image" />PNG image (2×)</button>
                <button onClick={() => doExport('svg')}><Icon name="polyline" />SVG vector</button>
                <button onClick={() => doExport('copy')}><Icon name="content_paste" />Copy PNG to clipboard</button>
                <hr />
                <button onClick={() => doExport('mmd')}><Icon name="schema" />Mermaid code (.mmd)</button>
                <button onClick={() => doExport('json')}><Icon name="data_object" />Gdraw file (.json)</button>
              </div>
            )}
          </div>
          <IconButton icon={mode === 'dark' ? 'light_mode' : 'dark_mode'} label="Toggle theme" onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')} />
          <IconButton icon="settings" label="AI settings" onClick={() => setDialog('settings')} />
        </div>
      </header>

      <main className="stage">
        <Canvas
          elements={elements} commit={commit} setLive={setLive} endLive={endLive}
          tool={tool} setTool={setTool} toolLocked={toolLocked}
          selected={selected} setSelected={setSelected}
          vp={vp} setVp={setVp} palette={palette} style={DEFAULT_STYLE} grid={grid} snapOn={snapOn}
          editingId={editingId} setEditingId={setEditingId}
          onDropFiles={(files, at) => files.forEach((f) => openFile(f, at))}
        />

        <LibraryPanel open={libOpen} onToggle={() => setLibOpen(!libOpen)} onAdd={addFromLibrary} />
        <Toolbar tool={tool} setTool={(t) => { setTool(t); if (t !== 'select') setSelected([]); }} locked={toolLocked} setLocked={setToolLocked} onAI={() => setAiOpen(true)} />

        {!aiOpen && selectedEls.length > 0 && !editingId && (
          <PropertiesPanel els={selectedEls} p={palette} update={updateSelected} onLayer={layer} onDuplicate={duplicate}
            onDelete={deleteSelected} onAlign={align} onClose={() => setSelected([])} />
        )}
        <AIPanel open={aiOpen} onClose={() => setAiOpen(false)} settings={aiSettings} elements={elements}
          onOpenSettings={() => setDialog('settings')} onResult={placeSpec} toast={toast}
          onMermaid={(code) => { setMermaidSeed(code); setDialog('mermaid'); }} />

        <div className={`bottom-left ${libOpen ? 'shifted' : ''}`}>
          <div className="pill">
            <IconButton icon="remove" label="Zoom out" onClick={() => zoomBy(1 / 1.2)} size={18} shortcut="Ctrl −" />
            <button className="zoom-val" onClick={() => setVp((v) => ({ ...v, zoom: 1 }))} data-tip="Reset zoom">{Math.round(vp.zoom * 100)}%</button>
            <IconButton icon="add" label="Zoom in" onClick={() => zoomBy(1.2)} size={18} shortcut="Ctrl +" />
            <IconButton icon="fit_screen" label="Zoom to fit" onClick={() => zoomToFit()} size={18} shortcut="Shift 1" />
          </div>
          <div className="pill">
            <IconButton icon="undo" label="Undo" onClick={undo} size={18} shortcut="Ctrl Z" />
            <IconButton icon="redo" label="Redo" onClick={redo} size={18} shortcut="Ctrl Shift Z" />
          </div>
        </div>
        <button className="help-fab" onClick={() => setDialog('help')} data-tip="Shortcuts & help"><Icon name="help" size={20} /></button>

        {empty && (
          <div className="welcome">
            <div className="welcome-mark">
              <span style={{ background: '#4285F4' }} /><span style={{ background: '#EA4335' }} /><span style={{ background: '#FBBC04' }} /><span style={{ background: '#34A853' }} />
            </div>
            <h1>Welcome to <span className="brand-word">Gdraw</span></h1>
            <p>Design Google Cloud architectures with official icons. Drag services from the library, draw freely, or let AI sketch the first draft.</p>
            <div className="welcome-actions">
              <button className="welcome-card" onClick={() => setDialog('templates')}>
                <span className="wc-icon blue"><Icon name="dashboard_customize" size={24} /></span>
                <strong>Start from a template</strong><span>{TEMPLATES.length} reference architectures</span>
              </button>
              <button className="welcome-card" onClick={() => setAiOpen(true)}>
                <span className="wc-icon gemini"><Icon name="auto_awesome" size={24} fill /></span>
                <strong>Generate with AI</strong><span>Gemini, OpenAI, Claude</span>
              </button>
              <button className="welcome-card" onClick={() => { setMermaidSeed(undefined); setDialog('mermaid'); }}>
                <span className="wc-icon green"><Icon name="schema" size={24} /></span>
                <strong>Import Mermaid</strong><span>Google-flavored rendering</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {toastMsg && <div className="snackbar" role="status">{toastMsg}</div>}

      <TemplatesDialog open={dialog === 'templates'} onClose={() => setDialog(null)} onUse={useTemplate} mode={mode} canvasEmpty={empty} />
      <SettingsDialog open={dialog === 'settings'} onClose={() => setDialog(null)} settings={aiSettings}
        onSave={(s) => { setAiSettings(s); saveAISettings(s); toast('AI settings saved'); }} />
      <MermaidDialog open={dialog === 'mermaid'} onClose={() => setDialog(null)} mode={mode} initialCode={mermaidSeed}
        onConvert={(spec) => { placeSpec(spec, elements.length === 0); toast(`Converted ${spec.nodes.length} nodes to editable shapes`); }}
        onInsertImage={insertMermaidImage}
        onExportCanvas={() => specToMermaid(elementsToSpec(elements))}
        settings={aiSettings} onOpenSettings={() => setDialog('settings')} />
      <DocsDialog open={dialog === 'docs'} onClose={() => setDialog(null)} current={doc.id} onOpen={switchDoc} onNew={() => switchDoc(newDoc())} />
      <HelpDialog open={dialog === 'help'} onClose={() => setDialog(null)} />
    </div>
  );
}

function DocsDialog({ open, onClose, current, onOpen, onNew }: { open: boolean; onClose: () => void; current: string; onOpen: (d: Doc) => void; onNew: () => void }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  useEffect(() => { if (open) setDocs(listDocs()); }, [open]);
  return (
    <Dialog open={open} onClose={onClose} title="My diagrams" icon="folder_open"
      actions={<button className="btn filled" onClick={onNew}><Icon name="add" size={18} />New diagram</button>}>
      <p className="dialog-sub">Diagrams are saved automatically in this browser.</p>
      <div className="doc-list">
        {docs.map((d) => (
          <div key={d.id} className={`doc-row ${d.id === current ? 'on' : ''}`}>
            <button className="doc-open" onClick={() => onOpen(d)}>
              <Icon name="architecture" size={22} />
              <span><strong>{d.name}</strong><small>{d.elements.length} elements · {new Date(d.updated).toLocaleString()}</small></span>
            </button>
            {d.id !== current && <IconButton icon="delete" label="Delete" className="danger" onClick={() => { deleteDoc(d.id); setDocs(listDocs()); }} size={18} />}
          </div>
        ))}
        {!docs.length && <p className="empty-note">No saved diagrams yet.</p>}
      </div>
    </Dialog>
  );
}

const SHORTCUTS: [string, string][] = [
  ['V / 1', 'Select'], ['H or Space-drag', 'Pan'], ['R  O  D', 'Rectangle, ellipse, decision'], ['A / L', 'Connector / line'],
  ['P', 'Pen'], ['T / N', 'Text / sticky note'], ['B', 'Boundary (VPC, project…)'], ['E', 'Eraser'],
  ['Double-click', 'Edit label / add text'], ['Enter', 'Edit selected'], ['Shift-drag', 'Keep proportions / snap angle'], ['Alt-drag boundary', 'Move boundary without contents'],
  ['Ctrl Z / Ctrl Shift Z', 'Undo / redo'], ['Ctrl C / X / V', 'Copy / cut / paste'], ['Ctrl D', 'Duplicate'], ['Ctrl L', 'Lock / unlock'],
  ['Ctrl [ / ]', 'Send backward / forward'], ['Ctrl wheel', 'Zoom'], ['Shift 1', 'Zoom to fit'], ['Ctrl K', 'Ask AI'],
  ['Ctrl S / Ctrl O', 'Save / open file'], ['G', 'Toggle grid'], ['Paste Mermaid', 'Converts to editable diagram'], ['Delete', 'Remove selection'],
];

function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts" icon="keyboard" wide>
      <div className="shortcut-grid">
        {SHORTCUTS.map(([k, d]) => <div key={k} className="shortcut"><kbd>{k}</kbd><span>{d}</span></div>)}
      </div>
    </Dialog>
  );
}
