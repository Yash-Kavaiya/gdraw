import React, { useEffect, useRef, useState } from 'react';
import { Dialog, Icon, Spinner } from './ui';
import { googleFlavor, mermaidConfig, parseMermaidFlowchart, SAMPLE_MERMAID } from '../lib/mermaid';
import type { ThemeMode } from '../lib/theme';
import type { DiagramSpec } from '../lib/types';
import { AISettings, MERMAID_SYSTEM, complete, hasKey, stripFences } from '../lib/ai';

const SAMPLES: Record<string, string> = {
  'GCP flowchart': SAMPLE_MERMAID,
  'Sequence: auth flow': `sequenceDiagram
  autonumber
  actor U as User
  participant W as Web app (Cloud Run)
  participant I as Identity Platform
  participant A as API (Cloud Run)
  participant D as Firestore
  U->>W: Open app
  W->>I: Sign in with Google
  I-->>W: ID token
  W->>A: GET /orders (Bearer token)
  A->>I: Verify token
  A->>D: Query orders
  D-->>A: Documents
  A-->>W: 200 OK
  W-->>U: Render orders`,
  'Data pipeline (TB)': `flowchart TB
  subgraph src["Sources"]
    app["Mobile App"]
    pos["IoT devices"]
  end
  subgraph gcp["Google Cloud"]
    ps["Pub/Sub"] --> df["Dataflow"]
    df --> gcs[("Cloud Storage")]
    df --> bq[("BigQuery")]
    bq --> vx["Vertex AI"]
  end
  app --> ps
  pos --> ps
  bq --> lk["Looker"]`,
  'Cost breakdown (pie)': `pie title Monthly cloud spend
  "Compute" : 42
  "Storage" : 18
  "BigQuery" : 25
  "Networking" : 15`,
  'Migration timeline': `gantt
  title Cloud migration plan
  dateFormat YYYY-MM-DD
  section Foundation
  Landing zone        :a1, 2026-01-05, 21d
  Networking & IAM    :after a1, 14d
  section Workloads
  Lift & shift VMs    :2026-02-10, 30d
  Modernize to Cloud Run :2026-03-01, 45d`,
};

let counter = 0;

export default function MermaidDialog({ open, onClose, mode, initialCode, onConvert, onInsertImage, onExportCanvas, settings, onOpenSettings }: {
  open: boolean; onClose: () => void; mode: ThemeMode; initialCode?: string;
  onConvert: (spec: DiagramSpec) => void;
  onInsertImage: (svg: string, icons: string[], text: string) => void;
  onExportCanvas: () => string;
  settings: AISettings; onOpenSettings: () => void;
}) {
  const [code, setCode] = useState(initialCode || SAMPLE_MERMAID);
  const [flavor, setFlavor] = useState(true);
  const [svg, setSvg] = useState('');
  const [err, setErr] = useState('');
  const [rendering, setRendering] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const lastIcons = useRef<string[]>([]);

  useEffect(() => { if (open && initialCode) setCode(initialCode); }, [open, initialCode]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setRendering(true);
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize(mermaidConfig(mode) as any);
        const flavored = flavor ? googleFlavor(code, mode) : { code, icons: [] };
        lastIcons.current = flavored.icons;
        await mermaid.parse(flavored.code);
        const { svg } = await mermaid.render(`gd-mmd-${++counter}`, flavored.code);
        if (!cancelled) { setSvg(svg); setErr(''); }
      } catch (e: any) {
        if (!cancelled) setErr(String(e?.message ?? e).split('\n').slice(0, 4).join('\n'));
        document.querySelectorAll('[id^="dgd-mmd-"]').forEach((n) => n.remove());
      } finally {
        if (!cancelled) setRendering(false);
      }
    }, 280);
    return () => { cancelled = true; clearTimeout(t); };
  }, [code, flavor, mode, open]);

  const isFlowchart = /^\s*(flowchart|graph)\b/i.test(code);

  const convert = () => {
    try { onConvert(parseMermaidFlowchart(code)); onClose(); }
    catch (e: any) { setErr(e.message); }
  };

  const askAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiBusy(true);
    try { setCode(stripFences(await complete(settings, MERMAID_SYSTEM, aiPrompt))); setAiPrompt(''); }
    catch (e: any) { setErr(e.message); }
    finally { setAiBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Mermaid studio" icon="schema" wide="full" className="mermaid-dialog"
      actions={<>
        <button className="btn text" onClick={() => { setCode(onExportCanvas()); }}><Icon name="output" size={18} />Canvas → Mermaid</button>
        <span className="spacer" />
        <button className="btn outlined" disabled={!svg || !!err} onClick={() => { onInsertImage(svg, lastIcons.current, code); onClose(); }}><Icon name="image" size={18} />Insert as image</button>
        <button className="btn filled" disabled={!isFlowchart} onClick={convert} data-tip={isFlowchart ? '' : 'Only flowcharts can become editable shapes'}><Icon name="transform" size={18} />Convert to editable diagram</button>
      </>}>
      <div className="mmd-layout">
        <div className="mmd-editor">
          <div className="mmd-toolbar">
            <select className="field compact" value="" onChange={(e) => e.target.value && setCode(SAMPLES[e.target.value])}>
              <option value="">Load example…</option>
              {Object.keys(SAMPLES).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <label className="switch-row compact" data-tip="Adds Google Cloud icons and category colours to recognised services">
              <span><Icon name="palette" size={18} /> Google flavor</span>
              <input type="checkbox" className="switch" checked={flavor} onChange={(e) => setFlavor(e.target.checked)} />
            </label>
            <button className="icon-btn" aria-label="Copy code" data-tip={copied ? 'Copied' : 'Copy code'} onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1200); }}>
              <Icon name={copied ? 'check' : 'content_copy'} size={18} />
            </button>
          </div>
          <textarea className="code" value={code} spellCheck={false} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Tab') { e.preventDefault(); const t = e.currentTarget; const s = t.selectionStart; setCode(code.slice(0, s) + '  ' + code.slice(t.selectionEnd)); requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 2; }); }
          }} />
          <div className="mmd-ai">
            <Icon name="auto_awesome" size={18} fill className="spark" />
            {hasKey(settings) ? (
              <>
                <input placeholder="Ask AI to write Mermaid… e.g. “sequence diagram of Pub/Sub push delivery”" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') askAI(); }} />
                <button className="btn tonal sm" onClick={askAI} disabled={aiBusy}>{aiBusy ? <Spinner /> : 'Write'}</button>
              </>
            ) : <button className="btn text sm" onClick={onOpenSettings}>Add an AI key to generate Mermaid</button>}
          </div>
        </div>
        <div className="mmd-preview">
          {rendering && <div className="mmd-status"><Spinner /></div>}
          {err ? (
            <div className="error-card mono"><Icon name="error" size={18} fill /><pre>{err}</pre></div>
          ) : (
            <div className="mmd-svg" dangerouslySetInnerHTML={{ __html: svg }} />
          )}
        </div>
      </div>
    </Dialog>
  );
}
