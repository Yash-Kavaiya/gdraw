import type { El, ElementType, ZoneKind } from './types';
import { uid } from './geometry';
import { ZONE_STYLES } from './services';

export interface StyleDefaults {
  stroke: string; fill: string; strokeWidth: number; strokeStyle: El['strokeStyle']; opacity: number;
  routing: El['routing']; fontSize: number;
}

export const DEFAULT_STYLE: StyleDefaults = {
  stroke: 'auto', fill: 'transparent', strokeWidth: 2, strokeStyle: 'solid', opacity: 1, routing: 'elbow', fontSize: 16,
};

export function makeEl(type: ElementType, x: number, y: number, s: Partial<StyleDefaults> = {}, extra: Partial<El> = {}): El {
  const st = { ...DEFAULT_STYLE, ...s };
  const base: El = {
    id: uid(), type, x, y, w: 0, h: 0,
    stroke: st.stroke, fill: st.fill, strokeWidth: st.strokeWidth, strokeStyle: st.strokeStyle, opacity: st.opacity,
  };
  if (type === 'arrow') Object.assign(base, { endHead: 'arrow', startHead: 'none', routing: st.routing, points: [[x, y], [x, y]], fontSize: 12 });
  if (type === 'line') Object.assign(base, { routing: 'straight', points: [[x, y], [x, y]] });
  if (type === 'text') Object.assign(base, { text: '', fontSize: st.fontSize + 4, fill: 'transparent' });
  if (type === 'note') Object.assign(base, { fill: '#FFF8C5', w: 200, h: 140, text: '', fontSize: 15 });
  if (type === 'rect' || type === 'ellipse' || type === 'diamond') Object.assign(base, { fontSize: st.fontSize, radius: 12 });
  return { ...base, ...extra };
}

export function makeService(service: string, x: number, y: number, variant: 'card' | 'icon' = 'card', extra: Partial<El> = {}): El {
  const size = variant === 'icon' ? { w: 96, h: 132 } : { w: 216, h: 64 };
  return {
    id: uid(), type: 'service', service, variant, x, y, ...size,
    stroke: 'auto', fill: 'auto', strokeWidth: 1, strokeStyle: 'solid', opacity: 1, ...extra,
  };
}

export function makeZone(kind: ZoneKind, x: number, y: number, w = 480, h = 320, extra: Partial<El> = {}): El {
  const z = ZONE_STYLES[kind];
  return {
    id: uid(), type: 'zone', zoneKind: kind, x, y, w, h,
    stroke: 'auto', fill: 'auto', strokeWidth: 1.5, strokeStyle: z.dash ? 'dashed' : 'solid', opacity: 1, fontSize: 13, ...extra,
  };
}

export function connector(fromId: string, toId: string, extra: Partial<El> = {}): El {
  return {
    id: uid(), type: 'arrow', x: 0, y: 0, w: 0, h: 0, points: [[0, 0], [0, 0]],
    stroke: 'auto', fill: 'transparent', strokeWidth: 1.75, strokeStyle: 'solid', opacity: 1,
    start: { id: fromId }, end: { id: toId }, startHead: 'none', endHead: 'arrow', routing: 'elbow', fontSize: 12, ...extra,
  };
}
