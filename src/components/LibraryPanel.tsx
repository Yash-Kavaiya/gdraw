import React, { useMemo, useState } from 'react';
import { CATEGORIES, SERVICES, ZONE_STYLES, iconUrl } from '../lib/services';
import { Icon, Segmented } from './ui';
import type { ZoneKind } from '../lib/types';

type Tab = 'services' | 'zones' | 'shapes';

const SHAPES = [
  { id: 'rect', name: 'Rectangle', icon: 'rectangle' },
  { id: 'ellipse', name: 'Ellipse', icon: 'circle' },
  { id: 'diamond', name: 'Decision', icon: 'diamond' },
];

export default function LibraryPanel({ onAdd, open, onToggle }: {
  onAdd: (item: { kind: 'service' | 'zone' | 'shape'; id: string; variant?: 'card' | 'icon' }) => void;
  open: boolean; onToggle: () => void;
}) {
  const [tab, setTab] = useState<Tab>('services');
  const [q, setQ] = useState('');
  const [variant, setVariant] = useState<'card' | 'icon'>('card');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ management: true, categories: true });

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return SERVICES;
    return SERVICES.filter((s) => s.name.toLowerCase().includes(t) || s.desc.toLowerCase().includes(t) || s.aliases?.some((a) => a.includes(t)));
  }, [q]);

  const dragStart = (e: React.DragEvent, item: object) => {
    e.dataTransfer.setData('application/x-gdraw', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'copy';
  };

  if (!open) {
    return (
      <button className="library-fab" onClick={onToggle} data-tip="Open Google Cloud library">
        <Icon name="widgets" size={22} />
      </button>
    );
  }

  return (
    <aside className="library">
      <div className="library-head">
        <div className="library-title">
          <Icon name="widgets" size={20} />
          <span>Library</span>
        </div>
        <button className="icon-btn" onClick={onToggle} aria-label="Collapse library"><Icon name="left_panel_close" /></button>
      </div>
      <div className="tabs">
        {(['services', 'zones', 'shapes'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t === 'services' ? 'Services' : t === 'zones' ? 'Boundaries' : 'Shapes'}
          </button>
        ))}
      </div>

      {tab === 'services' && (
        <>
          <div className="search">
            <Icon name="search" size={20} />
            <input placeholder="Search Google Cloud services" value={q} onChange={(e) => setQ(e.target.value)} />
            {q && <button className="icon-btn sm" onClick={() => setQ('')} aria-label="Clear"><Icon name="close" size={18} /></button>}
          </div>
          <div className="lib-variant">
            <span className="official-badge"><Icon name="verified" size={16} fill /> {SERVICES.filter((x) => x.file && !x.file.startsWith('ai-icons/')).length} official Google Cloud icons <span className="thirdparty-count">+ {SERVICES.filter((x) => x.file?.startsWith('ai-icons/')).length} AI tools</span></span>
          </div>
          <div className="lib-variant">
            <span>Style</span>
            <Segmented value={variant} onChange={setVariant} options={[{ value: 'card', label: 'Card', icon: 'crop_16_9' }, { value: 'icon', label: 'Icon', icon: 'crop_square' }]} />
          </div>
          <div className="library-scroll">
            {CATEGORIES.map((c) => {
              const items = filtered.filter((s) => s.category === c.id);
              if (!items.length) return null;
              const isCollapsed = collapsed[c.id] && !q;
              return (
                <section key={c.id} className="lib-cat">
                  <button className="lib-cat-head" onClick={() => setCollapsed((s) => ({ ...s, [c.id]: !s[c.id] }))}>
                    <span className="cat-dot" style={{ background: c.color }} />
                    <span>{c.name}</span>
                    {c.thirdParty && <span className="tp-chip" data-tip="Third-party brand logo">3rd-party</span>}
                    <span className="count">{items.length}</span>
                    <Icon name={isCollapsed ? 'expand_more' : 'expand_less'} size={18} />
                  </button>
                  {!isCollapsed && (
                    <div className="lib-grid">
                      {items.map((s) => (
                        <button
                          key={s.id}
                          className="lib-item"
                          draggable
                          onDragStart={(e) => dragStart(e, { kind: 'service', id: s.id, variant })}
                          onClick={() => onAdd({ kind: 'service', id: s.id, variant })}
                          data-tip={s.desc}
                        >
                          <span className={`lib-tile ${s.file ? 'official' : ''}`} style={{ ['--c' as any]: c.color, ['--t' as any]: c.tint }}>
                            {s.file ? <img src={iconUrl(s.file)} alt="" width={30} height={30} draggable={false} loading="lazy" /> : <Icon name={s.icon} size={22} />}
                          </span>
                          <span className="lib-name">{s.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
            {!filtered.length && <p className="empty-note">No services match “{q}”.</p>}
          </div>
        </>
      )}

      {tab === 'zones' && (
        <div className="library-scroll">
          <p className="hint">Boundaries group services. Moving a boundary moves everything inside it (hold Alt to move it alone).</p>
          <div className="zone-list">
            {(Object.keys(ZONE_STYLES) as ZoneKind[]).map((k) => {
              const z = ZONE_STYLES[k];
              return (
                <button key={k} className="zone-item" draggable onDragStart={(e) => dragStart(e, { kind: 'zone', id: k })} onClick={() => onAdd({ kind: 'zone', id: k })}>
                  <span className="zone-swatch" style={{ borderColor: z.stroke, background: z.fill, borderStyle: z.dash ? 'dashed' : 'solid' }}>
                    <Icon name={z.icon} size={18} />
                  </span>
                  <span>{z.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'shapes' && (
        <div className="library-scroll">
          <div className="lib-grid">
            {SHAPES.map((s) => (
              <button key={s.id} className="lib-item" draggable onDragStart={(e) => dragStart(e, { kind: 'shape', id: s.id })} onClick={() => onAdd({ kind: 'shape', id: s.id })}>
                <span className="lib-tile" style={{ ['--c' as any]: '#4285F4', ['--t' as any]: '#E8F0FE' }}><Icon name={s.icon} size={22} /></span>
                <span className="lib-name">{s.name}</span>
              </button>
            ))}
          </div>
          <p className="hint">Tip: use the toolbar for arrows, freehand pen, text and sticky notes. Paste Mermaid code anywhere on the canvas to convert it.</p>
        </div>
      )}
    </aside>
  );
}
