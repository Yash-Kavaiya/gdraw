import React, { useState } from 'react';
import { AISettings, PROVIDERS, Provider, complete, modelFor } from '../lib/ai';
import { Dialog, Icon, Spinner } from './ui';

const PROVIDER_ICON: Record<Provider, string> = { gemini: 'auto_awesome', openai: 'psychology', anthropic: 'emoji_objects', custom: 'dns' };

export default function SettingsDialog({ open, onClose, settings, onSave }: {
  open: boolean; onClose: () => void; settings: AISettings; onSave: (s: AISettings) => void;
}) {
  const [s, setS] = useState(settings);
  const [show, setShow] = useState(false);
  const [test, setTest] = useState<{ state: 'idle' | 'busy' | 'ok' | 'err'; msg?: string }>({ state: 'idle' });
  React.useEffect(() => { if (open) { setS(settings); setTest({ state: 'idle' }); } }, [open, settings]);
  const prov = PROVIDERS.find((p) => p.id === s.provider)!;

  const runTest = async () => {
    setTest({ state: 'busy' });
    try {
      const r = await complete(s, 'Reply with the single word: ready', 'ping');
      setTest({ state: 'ok', msg: `Connected · ${modelFor(s)} replied “${r.trim().slice(0, 40)}”` });
    } catch (e: any) {
      setTest({ state: 'err', msg: e.message ?? String(e) });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="AI settings" icon="key"
      actions={<>
        <button className="btn text" onClick={onClose}>Cancel</button>
        <button className="btn filled" onClick={() => { onSave(s); onClose(); }}>Save</button>
      </>}>
      <p className="dialog-sub">Bring your own key. Keys stay in this browser's local storage and are sent only to the provider you pick.</p>
      <div className="provider-grid">
        {PROVIDERS.map((p) => (
          <button key={p.id} className={`provider ${s.provider === p.id ? 'on' : ''}`} onClick={() => { setS({ ...s, provider: p.id }); setTest({ state: 'idle' }); }}>
            <span className={`prov-icon ${p.id}`}><Icon name={PROVIDER_ICON[p.id]} size={20} fill /></span>
            <span className="prov-name">{p.name}</span>
            {(p.id === 'custom' ? !!s.baseUrl && s.keys.custom !== undefined : !!s.keys[p.id]) && <Icon name="check_circle" size={18} fill className="prov-ok" />}
          </button>
        ))}
      </div>

      {s.provider === 'custom' && (
        <label className="ofield">
          <span>Base URL</span>
          <input value={s.baseUrl ?? ''} onChange={(e) => setS({ ...s, baseUrl: e.target.value })} placeholder="http://localhost:11434/v1 or https://openrouter.ai/api/v1" />
        </label>
      )}
      <label className="ofield">
        <span>{prov.name} API key</span>
        <div className="input-row">
          <input type={show ? 'text' : 'password'} value={s.keys[s.provider] ?? ''} placeholder={prov.keyHint} autoComplete="off"
            onChange={(e) => setS({ ...s, keys: { ...s.keys, [s.provider]: e.target.value.trim() } })} />
          <button className="icon-btn sm" onClick={() => setShow(!show)} aria-label="Show key"><Icon name={show ? 'visibility_off' : 'visibility'} size={18} /></button>
        </div>
      </label>
      {prov.keyUrl && <a className="link" href={prov.keyUrl} target="_blank" rel="noreferrer"><Icon name="open_in_new" size={16} /> Get a {prov.name} key</a>}
      <label className="ofield">
        <span>Model</span>
        <input list={`models-${s.provider}`} value={s.models[s.provider] ?? ''} placeholder={prov.defaultModel}
          onChange={(e) => setS({ ...s, models: { ...s.models, [s.provider]: e.target.value } })} />
        <datalist id={`models-${s.provider}`}>{prov.models.map((m) => <option key={m} value={m} />)}</datalist>
      </label>

      <div className="test-row">
        <button className="btn tonal" onClick={runTest} disabled={test.state === 'busy' || (s.provider !== 'custom' && !s.keys[s.provider])}>
          {test.state === 'busy' ? <Spinner /> : <Icon name="network_check" size={18} />} Test connection
        </button>
        {test.msg && <span className={`test-msg ${test.state}`}><Icon name={test.state === 'ok' ? 'check_circle' : 'error'} size={18} fill />{test.msg}</span>}
      </div>
    </Dialog>
  );
}
