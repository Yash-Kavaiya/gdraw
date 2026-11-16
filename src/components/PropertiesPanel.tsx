import React from 'react';
import type { El, ZoneKind } from '../lib/types';
import { FILLS, STROKES, Palette, resolveFill, resolveStroke } from '../lib/theme';
import { CATEGORIES, SERVICES, ZONE_STYLES } from '../lib/services';
import { Icon, IconButton, Segmented } from './ui';
import { isLinear } from '../lib/geometry';

export type Align = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom' | 'hdist' | 'vdist';

export default function PropertiesPanel({ els, p, update, onLayer, onDuplicate, onDelete, onAlign, onClose }: {
  els: El[]; p: Palette;
  update: (patch: Partial<El> | ((e: El) => Partial<El>)) => void;
  onLayer: (dir: 'front' | 'forward' | 'backward' | 'back') => void;
  onDuplicate: () => void; onDelete: () => void; onAlign: (a: Align) => void; onClose: () => void;
}) {
  if (!els.length) return null;
  const first = els[0];
  const all = (fn: (e: El) => boolean) => els.every(fn);
  const any = (fn: (e: El) => boolean) => els.some(fn);
  const shapeLike = (e: El) => ['rect', 'ellipse', 'diamond'].includes(e.type);
  const hasStroke = any((e) => e.type !== 'image' && e.type !== 'note');
  const hasFill = any((e) => shapeLike(e) || e.type === 'zone' || e.type === 'note');
  const linear = all(isLinear);
  const hasText = any((e) => ['rect', 'ellipse', 'diamond', 'text', 'note', 'arrow', 'zone'].includes(e.type));
  const services = els.filter((e) => e.type === 'service');
  const zones = els.filter((e) => e.type === 'zone');
  const locked = all((e) => !!e.locked);
  const title = els.length > 1 ? `${els.length} selected` : first.type === 'service' ? 'Service' : first.type === 'zone' ? 'Boundary' : first.type === 'freedraw' ? 'Drawing' : first.type[0].toUpperCase() + first.type.slice(1);

  return (
    <aside className="props" onPointerDown={(e) => e.stopPropagation()}>
      <div className="props-head">
        <span>{title}</span>
        <IconButton icon="close" label="Deselect" onClick={onClose} size={18} />
      </div>
      <div className="props-scroll">
        {services.length === 1 && (
          <Section label="Google Cloud service">
            <select className="field" value={services[0].service} onChange={(e) => update((x) => (x.type === 'service' ? { service: e.target.value, text: undefined } : {}))}>
              {CATEGORIES.map((c) => (
                <optgroup key={c.id} label={c.name}>
                  {SERVICES.filter((s) => s.category === c.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </optgroup>
              ))}
            </select>
            <input className="field" placeholder="Subtitle (e.g. PostgreSQL HA)" value={services[0].subtitle ?? ''} onChange={(e) => update({ subtitle: e.target.value || undefined })} />
          </Section>
        )}
        {services.length > 0 && (
          <Section label="Display">
            <Segmented value={services.every((s) => s.variant === 'icon') ? 'icon' : 'card'} onChange={(v) => update((x) => x.type === 'service' ? (v === 'icon' ? { variant: 'icon', w: 96, h: 132 } : { variant: 'card', w: 216, h: 64 }) : {})}
              options={[{ value: 'card', label: 'Card', icon: 'crop_16_9' }, { value: 'icon', label: 'Icon', icon: 'crop_square' }]} />
          </Section>
        )}
        {zones.length === 1 && (
          <Section label="Boundary type">
            <select className="field" value={zones[0].zoneKind} onChange={(e) => update({ zoneKind: e.target.value as ZoneKind, strokeStyle: ZONE_STYLES[e.target.value].dash ? 'dashed' : 'solid', text: undefined })}>
              {Object.entries(ZONE_STYLES).map(([k, z]) => <option key={k} value={k}>{z.label}</option>)}
            </select>
          </Section>
        )}

        {hasStroke && (
          <Section label={linear ? 'Line color' : first.type === 'text' ? 'Text color' : 'Stroke'}>
            <div className="swatches">
              {(first.type === 'zone' || first.type === 'service' ? ['auto', ...STROKES.slice(1)] : STROKES).map((c) => (
                <button key={c} className={`swatch ${first.stroke === c ? 'on' : ''}`} onClick={() => update({ stroke: c })} aria-label={c} data-tip={c === 'auto' ? 'Automatic' : c}>
                  <span style={{ background: c === 'auto' ? `linear-gradient(135deg, ${p.ink} 50%, ${p.canvas} 50%)` : resolveStroke(c, p) }} />
                </button>
              ))}
              <label className="swatch custom" data-tip="Custom color">
                <input type="color" value={first.stroke.startsWith('#') ? first.stroke : '#4285F4'} onChange={(e) => update({ stroke: e.target.value })} />
                <Icon name="palette" size={16} />
              </label>
            </div>
          </Section>
        )}
        {hasFill && (
          <Section label="Fill">
            <div className="swatches">
              {(first.type === 'zone' ? ['auto', ...FILLS] : first.type === 'note' ? ['#FFF8C5', ...FILLS.slice(1)] : FILLS).map((c) => (
                <button key={c} className={`swatch ${first.fill === c ? 'on' : ''}`} onClick={() => update({ fill: c })} aria-label={c} data-tip={c === 'auto' ? 'Automatic' : c === 'transparent' ? 'None' : c}>
                  <span className={c === 'transparent' ? 'none' : ''} style={{ background: c === 'auto' ? 'conic-gradient(#4285F4 0 25%, #EA4335 0 50%, #FBBC04 0 75%, #34A853 0)' : c === 'transparent' ? undefined : resolveFill(c, p) }} />
                </button>
              ))}
            </div>
          </Section>
        )}
        {any((e) => e.type !== 'service' && e.type !== 'image' && e.type !== 'note') && (
          <Section label="Stroke width">
            <Segmented value={first.strokeWidth} onChange={(v) => update({ strokeWidth: v })}
              options={[{ value: 1, tip: 'Thin', icon: 'pen_size_1' }, { value: 2, tip: 'Regular', icon: 'pen_size_2' }, { value: 3.5, tip: 'Bold', icon: 'pen_size_4' }]} />
          </Section>
        )}
        {any((e) => e.type !== 'service' && e.type !== 'image' && e.type !== 'note' && e.type !== 'text' && e.type !== 'freedraw') && (
          <Section label="Line style">
            <Segmented value={first.strokeStyle} onChange={(v) => update({ strokeStyle: v })}
              options={[{ value: 'solid', tip: 'Solid', icon: 'horizontal_rule' }, { value: 'dashed', tip: 'Dashed', icon: 'line_style' }, { value: 'dotted', tip: 'Dotted', icon: 'more_horiz' }]} />
          </Section>
        )}
        {linear && (
          <>
            <Section label="Routing">
              <Segmented value={first.routing ?? 'straight'} onChange={(v) => update({ routing: v })}
                options={[{ value: 'straight', tip: 'Straight', icon: 'trending_flat' }, { value: 'elbow', tip: 'Elbow', icon: 'turn_right' }, { value: 'curve', tip: 'Curved', icon: 'conversion_path' }]} />
            </Section>
            {all((e) => e.type === 'arrow') && (
              <Section label="Arrowheads">
                <div className="row2">
                  <select className="field" value={first.startHead ?? 'none'} onChange={(e) => update({ startHead: e.target.value as El['startHead'] })}>
                    <option value="none">Start: none</option><option value="arrow">Start: arrow</option><option value="triangle">Start: triangle</option><option value="dot">Start: dot</option>
                  </select>
                  <select className="field" value={first.endHead ?? 'arrow'} onChange={(e) => update({ endHead: e.target.value as El['endHead'] })}>
                    <option value="none">End: none</option><option value="arrow">End: arrow</option><option value="triangle">End: triangle</option><option value="dot">End: dot</option>
                  </select>
                </div>
              </Section>
            )}
            <Section label="Data flow">
              <label className="switch-row">
                <span><Icon name="animation" size={18} /> Animate flow</span>
                <input type="checkbox" className="switch" checked={!!first.animated} onChange={(e) => update({ animated: e.target.checked })} />
              </label>
            </Section>
          </>
        )}
        {hasText && (
          <Section label="Font size">
            <Segmented value={sizeBucket(first)} onChange={(v) => update((x) => fontPatch(x, v))}
              options={[{ value: 'S', label: 'S' }, { value: 'M', label: 'M' }, { value: 'L', label: 'L' }, { value: 'XL', label: 'XL' }]} />
          </Section>
        )}
        {any((e) => e.type === 'text') && (
          <Section label="Align">
            <Segmented value={first.textAlign ?? 'left'} onChange={(v) => update({ textAlign: v })}
              options={[{ value: 'left', icon: 'format_align_left', tip: 'Left' }, { value: 'center', icon: 'format_align_center', tip: 'Center' }, { value: 'right', icon: 'format_align_right', tip: 'Right' }]} />
          </Section>
        )}
        {any(shapeLike) && (
          <Section label="Shape">
            <label className="switch-row">
              <span><Icon name="shadow" size={18} /> Elevation shadow</span>
              <input type="checkbox" className="switch" checked={!!first.shadow} onChange={(e) => update({ shadow: e.target.checked })} />
            </label>
            {any((e) => e.type === 'rect') && (
              <Segmented value={(first.radius ?? 12) > 0 ? 'round' : 'sharp'} onChange={(v) => update({ radius: v === 'round' ? 12 : 0 })}
                options={[{ value: 'round', label: 'Rounded', icon: 'rounded_corner' }, { value: 'sharp', label: 'Sharp', icon: 'crop_square' }]} />
            )}
          </Section>
        )}
        <Section label={`Opacity · ${Math.round(first.opacity * 100)}%`}>
          <input type="range" className="slider" min={10} max={100} step={5} value={first.opacity * 100} onChange={(e) => update({ opacity: +e.target.value / 100 })} />
        </Section>

        {els.length > 1 && (
          <Section label="Align & distribute">
            <div className="btn-row">
              <IconButton icon="align_horizontal_left" label="Align left" onClick={() => onAlign('left')} size={18} />
              <IconButton icon="align_horizontal_center" label="Align center" onClick={() => onAlign('hcenter')} size={18} />
              <IconButton icon="align_horizontal_right" label="Align right" onClick={() => onAlign('right')} size={18} />
              <IconButton icon="align_vertical_top" label="Align top" onClick={() => onAlign('top')} size={18} />
              <IconButton icon="align_vertical_center" label="Align middle" onClick={() => onAlign('vcenter')} size={18} />
              <IconButton icon="align_vertical_bottom" label="Align bottom" onClick={() => onAlign('bottom')} size={18} />
              <IconButton icon="horizontal_distribute" label="Distribute horizontally" onClick={() => onAlign('hdist')} size={18} disabled={els.length < 3} />
              <IconButton icon="vertical_distribute" label="Distribute vertically" onClick={() => onAlign('vdist')} size={18} disabled={els.length < 3} />
            </div>
          </Section>
        )}
        <Section label="Layer & actions">
          <div className="btn-row">
            <IconButton icon="flip_to_back" label="Send to back" onClick={() => onLayer('back')} size={18} shortcut="Ctrl Shift [" />
            <IconButton icon="arrow_downward" label="Send backward" onClick={() => onLayer('backward')} size={18} shortcut="Ctrl [" />
            <IconButton icon="arrow_upward" label="Bring forward" onClick={() => onLayer('forward')} size={18} shortcut="Ctrl ]" />
            <IconButton icon="flip_to_front" label="Bring to front" onClick={() => onLayer('front')} size={18} shortcut="Ctrl Shift ]" />
            <IconButton icon="content_copy" label="Duplicate" onClick={onDuplicate} size={18} shortcut="Ctrl D" />
            <IconButton icon={locked ? 'lock' : 'lock_open'} label={locked ? 'Unlock' : 'Lock'} active={locked} onClick={() => update({ locked: !locked })} size={18} shortcut="Ctrl L" />
            <IconButton icon="delete" label="Delete" onClick={onDelete} size={18} className="danger" shortcut="Del" />
          </div>
        </Section>
      </div>
    </aside>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="prop-sec"><div className="prop-label">{label}</div>{children}</div>;
}

const BASE: Record<string, number> = { text: 20, arrow: 12, line: 12, zone: 13, note: 15 };
const SCALE: Record<string, number> = { S: 0.8, M: 1, L: 1.35, XL: 1.9 };
function sizeBucket(e: El) {
  const base = BASE[e.type] ?? 16;
  const r = (e.fontSize ?? base) / base;
  return r < 0.9 ? 'S' : r < 1.2 ? 'M' : r < 1.6 ? 'L' : 'XL';
}
function fontPatch(e: El, b: string): Partial<El> {
  const base = BASE[e.type] ?? 16;
  const fontSize = Math.round(base * SCALE[b]);
  if (e.type === 'text') {
    const ratio = fontSize / (e.fontSize ?? base);
    return { fontSize, w: e.w * ratio, h: e.h * ratio };
  }
  return { fontSize };
}
