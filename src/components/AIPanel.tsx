import React, { useRef, useState } from 'react';
import { AISettings, ARCH_SYSTEM, MERMAID_SYSTEM, REVIEW_SYSTEM, PROVIDERS, complete, extractJSON, hasKey, modelFor, stripFences, validateSpec } from '../lib/ai';
import type { DiagramSpec, El } from '../lib/types';
import { elementsToSpec } from '../lib/mermaid';
import { Icon, IconButton, Markdown, Segmented, Spinner } from './ui';

const EXAMPLES = [
  'E-commerce site on Cloud Run with Cloud SQL, Memorystore and a global load balancer with Cloud Armor',
  'Real-time clickstream analytics: Pub/Sub → Dataflow → BigQuery with Looker dashboards',
  'RAG chatbot using Gemini, Vector Search and Document AI over PDFs in Cloud Storage',
  'GKE microservices across two regions with Spanner and Cloud Deploy CI/CD',
];

type Mode = 'generate' | 'review';
type Output = 'architecture' | 'mermaid';

export default function AIPanel({ open, onClose, settings, elements, onOpenSettings, onResult, onMermaid, toast }: {
  open: boolean; onClose: () => void; settings: AISettings; elements: El[]; onOpenSettings: () => void;
  onResult: (spec: DiagramSpec, replace: boolean) => void; onMermaid: (code: string) => void; toast: (m: string) => void;
}) {
  const [mode, setMode] = useState<Mode>('generate');
  const [output, setOutput] = useState<Output>('architecture');
  const [prompt, setPrompt] = useState('');
  const [modify, setModify] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [review, setReview] = useState('');
  const abort = useRef<AbortController | null>(null);
  if (!open) return null;

  const ready = hasKey(settings);
  const prov = PROVIDERS.find((p) => p.id === settings.provider)!;
  const hasCanvas = elements.length > 0;

  const run = async () => {
    setErr(''); setBusy(true);
    abort.current = new AbortController();
    try {
      if (mode === 'review') {
        const spec = elementsToSpec(elements);
        const txt = await complete(settings, REVIEW_SYSTEM, `Architecture (JSON):\n${JSON.stringify(spec)}\n\n${prompt ? `Focus: ${prompt}` : ''}`, false, abort.current.signal);
        setReview(txt);
        return;
      }
      if (!prompt.trim()) { setErr('Describe the architecture you want.'); return; }
      const current = modify && hasCanvas ? `\n\nCurrent diagram to modify (keep what is not asked to change):\n${JSON.stringify(elementsToSpec(elements))}` : '';
      if (output === 'mermaid') {
        const txt = await complete(settings, MERMAID_SYSTEM, prompt + current, false, abort.current.signal);
        onMermaid(stripFences(txt));
      } else {
        const txt = await complete(settings, ARCH_SYSTEM, prompt + current, true, abort.current.signal);
        const spec = validateSpec(extractJSON(txt));
        onResult(spec, modify || !hasCanvas);
        toast(`Generated ${spec.nodes.length} services with ${prov.name}`);
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') setErr(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="ai-panel" onPointerDown={(e) => e.stopPropagation()}>
      <div className="ai-head">
        <span className="ai-spark"><Icon name="auto_awesome" size={20} fill /></span>
        <div>
          <div className="ai-title">AI architect</div>
          <button className="ai-model" onClick={onOpenSettings}>{prov.name} · {modelFor(settings)} <Icon name="expand_more" size={16} /></button>
        </div>
        <IconButton icon="close" label="Close" onClick={onClose} />
      </div>
      <div className="ai-body">
        <Segmented value={mode} onChange={(v) => { setMode(v); setErr(''); }} options={[{ value: 'generate', label: 'Generate', icon: 'draw' }, { value: 'review', label: 'Review', icon: 'fact_check' }]} />

        {!ready && (
          <div className="ai-empty">
            <Icon name="key" size={28} />
            <p>Add a Gemini, OpenAI, Anthropic or OpenAI-compatible key to generate diagrams.</p>
            <button className="btn filled" onClick={onOpenSettings}><Icon name="add" size={18} />Add API key</button>
          </div>
        )}

        {ready && mode === 'generate' && (
          <>
            <label className="ai-prompt">
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5}
                placeholder="Describe your system, e.g. “A serverless image pipeline that tags uploads with Vision AI and stores results in Firestore”"
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) run(); e.stopPropagation(); }} />
            </label>
            <div className="ai-examples">
              {EXAMPLES.map((x) => <button key={x} className="chip sm" onClick={() => setPrompt(x)}>{x.split(':')[0].split(' with ')[0].slice(0, 42)}</button>)}
            </div>
            <div className="prop-label">Output</div>
            <Segmented value={output} onChange={setOutput} options={[{ value: 'architecture', label: 'GCP diagram', icon: 'cloud' }, { value: 'mermaid', label: 'Mermaid', icon: 'schema' }]} />
            {hasCanvas && (
              <label className="switch-row">
                <span><Icon name="edit_note" size={18} /> Modify current diagram</span>
                <input type="checkbox" className="switch" checked={modify} onChange={(e) => setModify(e.target.checked)} />
              </label>
            )}
            <button className={`btn gemini ${busy ? 'busy' : ''}`} onClick={busy ? () => abort.current?.abort() : run}>
              {busy ? <><Spinner /> Generating… <span className="cancel">Cancel</span></> : <><Icon name="auto_awesome" size={18} fill /> Generate</>}
            </button>
            <p className="hint">Ctrl + Enter to generate. Output is laid out automatically and fully editable.</p>
          </>
        )}

        {ready && mode === 'review' && (
          <>
            <p className="hint">Get a Well-Architected review of the diagram on your canvas: security, reliability, cost, performance and operations.</p>
            <input className="field" placeholder="Optional focus, e.g. “cost” or “multi-region DR”" value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
            <button className={`btn gemini ${busy ? 'busy' : ''}`} onClick={busy ? () => abort.current?.abort() : run} disabled={!hasCanvas}>
              {busy ? <><Spinner /> Reviewing…</> : <><Icon name="fact_check" size={18} /> Review architecture</>}
            </button>
            {!hasCanvas && <p className="hint">Draw or generate a diagram first.</p>}
            {review && <div className="review-card"><Markdown text={review} /></div>}
          </>
        )}
        {err && <div className="error-card"><Icon name="error" size={18} fill /> <span>{err}</span></div>}
      </div>
    </aside>
  );
}
