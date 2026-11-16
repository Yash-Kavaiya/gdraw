import React, { useMemo, useState } from 'react';
import { TEMPLATES, Template } from '../lib/templates';
import { layoutSpec } from '../lib/layout';
import { renderElement, SvgDefs, getRoute } from '../lib/render';
import { PALETTES, ThemeMode } from '../lib/theme';
import { boundsOf, boundsOfPoints, unionBoxes, isLinear } from '../lib/geometry';
import { Dialog, Icon } from './ui';
import type { El } from '../lib/types';

function Preview({ t, mode }: { t: Template; mode: ThemeMode }) {
  const els = useMemo(() => layoutSpec(t.spec), [t]);
  const p = PALETTES[mode];
  const map = new Map(els.map((e) => [e.id, e]));
  const b = unionBoxes(els.map((e) => (isLinear(e) ? boundsOfPoints(getRoute(e, map)) : boundsOf(e))))!;
  const pad = 30;
  return (
    <svg viewBox={`${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`} preserveAspectRatio="xMidYMid meet">
      <SvgDefs p={p} />
      {els.map((e: El) => <g key={e.id}>{renderElement(e, p, map)}</g>)}
    </svg>
  );
}

export default function TemplatesDialog({ open, onClose, onUse, mode, canvasEmpty }: {
  open: boolean; onClose: () => void; onUse: (t: Template, replace: boolean) => void; mode: ThemeMode; canvasEmpty: boolean;
}) {
  const [tag, setTag] = useState('All');
  const tags = ['All', ...new Set(TEMPLATES.map((t) => t.tag))];
  const list = TEMPLATES.filter((t) => tag === 'All' || t.tag === tag);
  return (
    <Dialog open={open} onClose={onClose} title="Architecture templates" icon="dashboard_customize" wide>
      <p className="dialog-sub">Start from a Google Cloud reference architecture. Every node stays fully editable.</p>
      <div className="chips">
        {tags.map((t) => <button key={t} className={`chip ${tag === t ? 'on' : ''}`} onClick={() => setTag(t)}>{tag === t && <Icon name="check" size={18} />}{t}</button>)}
      </div>
      <div className="tpl-grid">
        {list.map((t, i) => (
          <article key={t.id} className="tpl-card" style={{ animationDelay: `${i * 40}ms` }}>
            <div className="tpl-preview"><Preview t={t} mode={mode} /></div>
            <div className="tpl-meta">
              <span className="tpl-tag" style={{ ['--c' as any]: t.color }}>{t.tag}</span>
              <h3>{t.name}</h3>
              <p>{t.desc}</p>
              <div className="tpl-actions">
                <button className="btn filled" onClick={() => onUse(t, true)}><Icon name={canvasEmpty ? 'add' : 'swap_horiz'} size={18} />{canvasEmpty ? 'Use template' : 'Replace canvas'}</button>
                {!canvasEmpty && <button className="btn text" onClick={() => onUse(t, false)}>Add to canvas</button>}
              </div>
            </div>
          </article>
        ))}
      </div>
    </Dialog>
  );
}
