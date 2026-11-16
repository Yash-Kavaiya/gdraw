import React from 'react';
import type { El } from './types';
import { Palette, resolveFill, resolveStroke, wrapText, DIAGRAM_FONT } from './theme';
import { serviceInfo, ZONE_STYLES, iconUrl } from './services';
import { boundsOf, freehandPath, polylineMid, routeConnector, routeToPath, Pt } from './geometry';

export const ICON_FONT = '"Material Symbols Outlined"';

export function dashFor(style: string | undefined, w: number) {
  if (style === 'dashed') return `${w * 4} ${w * 3}`;
  if (style === 'dotted') return `${w} ${w * 2.5}`;
  return undefined;
}

export function SvgDefs({ p }: { p: Palette }) {
  return (
    <defs>
      <filter id="gd-shadow" x="-20%" y="-20%" width="140%" height="160%">
        <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000" floodOpacity={p.mode === 'dark' ? 0.5 : 0.18} />
        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity={p.mode === 'dark' ? 0.35 : 0.08} />
      </filter>
      <style>{`
        .gd-flow { animation: gd-dash 1.2s linear infinite; }
        @keyframes gd-dash { to { stroke-dashoffset: -24; } }
      `}</style>
    </defs>
  );
}

export function getRoute(el: El, map: Map<string, El>): Pt[] {
  const pts = (el.points ?? [[el.x, el.y], [el.x + el.w, el.y + el.h]]) as Pt[];
  const sEl = el.start ? map.get(el.start.id) : undefined;
  const eEl = el.end ? map.get(el.end.id) : undefined;
  const shapeOf = (e: El) => (e.type === 'ellipse' ? 'ellipse' : e.type === 'diamond' ? 'diamond' : 'rect');
  return routeConnector(
    pts, el.routing ?? 'straight',
    sEl ? { box: boundsOf(sEl), shape: shapeOf(sEl) } : null,
    eEl ? { box: boundsOf(eEl), shape: shapeOf(eEl) } : null,
  );
}

function head(kind: string | undefined, tip: Pt, from: Pt, color: string, sw: number, key: string) {
  if (!kind || kind === 'none') return null;
  const ang = Math.atan2(tip[1] - from[1], tip[0] - from[0]);
  const L = 8 + sw * 2.2;
  if (kind === 'dot') return <circle key={key} cx={tip[0]} cy={tip[1]} r={3 + sw} fill={color} />;
  const a1 = ang + Math.PI - 0.45, a2 = ang + Math.PI + 0.45;
  const p1: Pt = [tip[0] + Math.cos(a1) * L, tip[1] + Math.sin(a1) * L];
  const p2: Pt = [tip[0] + Math.cos(a2) * L, tip[1] + Math.sin(a2) * L];
  if (kind === 'triangle')
    return <path key={key} d={`M${tip[0]},${tip[1]} L${p1[0]},${p1[1]} L${p2[0]},${p2[1]} Z`} fill={color} stroke={color} strokeWidth={1} strokeLinejoin="round" />;
  return <path key={key} d={`M${p1[0]},${p1[1]} L${tip[0]},${tip[1]} L${p2[0]},${p2[1]}`} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />;
}

function TextLines({ lines, x, y, size, color, anchor = 'middle', weight = 400, lh = 1.3 }: {
  lines: string[]; x: number; y: number; size: number; color: string; anchor?: 'start' | 'middle' | 'end'; weight?: number; lh?: number;
}) {
  return (
    <text x={x} y={y} fontFamily={DIAGRAM_FONT} fontSize={size} fill={color} textAnchor={anchor} fontWeight={weight} style={{ whiteSpace: 'pre' }}>
      {lines.map((l, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : size * lh}>{l || ' '}</tspan>
      ))}
    </text>
  );
}

function centeredText(el: El, p: Palette, color: string, padX = 12) {
  if (!el.text) return null;
  const size = el.fontSize ?? 16;
  const lines = wrapText(el.text, Math.max(20, el.w - padX * 2), size);
  const total = lines.length * size * 1.3;
  const y0 = el.y + el.h / 2 - total / 2 + size * 0.95;
  return <TextLines lines={lines} x={el.x + el.w / 2} y={y0} size={size} color={color} />;
}

export function renderElement(el: El, p: Palette, map: Map<string, El>, editingId?: string | null): React.ReactNode {
  const stroke = resolveStroke(el.stroke, p);
  const fill = resolveFill(el.fill, p);
  const sw = el.strokeWidth;
  const dash = dashFor(el.strokeStyle, sw);
  const hideText = editingId === el.id;
  const common = { opacity: el.opacity };
  const shadow = el.shadow ? 'url(#gd-shadow)' : undefined;

  switch (el.type) {
    case 'rect':
      return (
        <g {...common}>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={el.radius ?? 12} fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} filter={shadow} />
          {!hideText && centeredText(el, p, stroke)}
        </g>
      );
    case 'ellipse':
      return (
        <g {...common}>
          <ellipse cx={el.x + el.w / 2} cy={el.y + el.h / 2} rx={el.w / 2} ry={el.h / 2} fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} filter={shadow} />
          {!hideText && centeredText(el, p, stroke, el.w * 0.15)}
        </g>
      );
    case 'diamond': {
      const { x, y, w, h } = el;
      const r = Math.min(w, h) * 0.06;
      const d = `M${x + w / 2},${y + r} L${x + w - r},${y + h / 2} L${x + w / 2},${y + h - r} L${x + r},${y + h / 2} Z`;
      return (
        <g {...common}>
          <path d={d} fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} strokeLinejoin="round" filter={shadow} />
          {!hideText && centeredText(el, p, stroke, el.w * 0.22)}
        </g>
      );
    }
    case 'text': {
      if (hideText) return null;
      const size = el.fontSize ?? 20;
      const lines = (el.text ?? '').split('\n');
      const anchor = el.textAlign === 'center' ? 'middle' : el.textAlign === 'right' ? 'end' : 'start';
      const x = el.textAlign === 'center' ? el.x + el.w / 2 : el.textAlign === 'right' ? el.x + el.w : el.x;
      return <g {...common}><TextLines lines={lines} x={x} y={el.y + size * 0.95} size={size} color={stroke} anchor={anchor} /></g>;
    }
    case 'note': {
      const f = resolveFill(el.fill || '#FFF8C5', p);
      const fold = 18;
      const { x, y, w, h } = el;
      const size = el.fontSize ?? 16;
      const lines = el.text ? wrapText(el.text, w - 28, size) : [];
      return (
        <g {...common}>
          <path d={`M${x + 4},${y} H${x + w - 4} Q${x + w},${y} ${x + w},${y + 4} V${y + h - fold} L${x + w - fold},${y + h} H${x + 4} Q${x},${y + h} ${x},${y + h - 4} V${y + 4} Q${x},${y} ${x + 4},${y} Z`} fill={f} filter="url(#gd-shadow)" />
          <path d={`M${x + w},${y + h - fold} L${x + w - fold},${y + h - fold} L${x + w - fold},${y + h} Z`} fill="#000" opacity={0.08} />
          {!hideText && <TextLines lines={lines} x={x + 14} y={y + 14 + size * 0.95} size={size} color={p.mode === 'dark' ? '#F1E9B8' : '#3C4043'} anchor="start" />}
        </g>
      );
    }
    case 'zone': {
      const z = ZONE_STYLES[el.zoneKind ?? 'group'];
      const zs = el.stroke === 'auto' ? (p.mode === 'dark' && z.stroke === '#5F6368' ? '#9AA0A6' : z.stroke) : stroke;
      const zf = el.fill === 'auto' ? (p.mode === 'dark' ? z.darkFill : z.fill) : fill;
      const label = el.text ?? z.label;
      const size = el.fontSize ?? 13;
      return (
        <g {...common}>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={el.radius ?? 14} fill={zf} stroke={zs} strokeWidth={sw}
            strokeDasharray={dash} />
          <rect x={el.x + 1} y={el.y + 1} width={Math.min(el.w - 2, 28 + size * 0.6 * label.length + 24)} height={30} rx={12} fill={zs} opacity={0.10} />
          <text x={el.x + 12} y={el.y + 22} fontFamily={ICON_FONT} fontSize={18} fill={zs}>{z.icon}</text>
          {!hideText && <text x={el.x + 36} y={el.y + 20.5} fontFamily={DIAGRAM_FONT} fontSize={size} fontWeight={500} fill={zs}>{label}</text>}
        </g>
      );
    }
    case 'service': {
      const { service: s, category: c } = serviceInfo(el.service);
      const label = el.text ?? s.name;
      const sub = el.subtitle ?? '';
      const tint = p.mode === 'dark' ? c.darkTint : c.tint;
      const cardFill = el.fill && el.fill !== 'auto' ? fill : p.card;
      const border = el.stroke && el.stroke !== 'auto' ? stroke : p.cardBorder;
      if (el.variant === 'icon') {
        const t = Math.min(el.w, el.h - 34);
        const tx = el.x + (el.w - t) / 2;
        const lines = wrapText(label, el.w + 40, 13, 500).slice(0, 2);
        return (
          <g {...common}>
            <rect x={tx} y={el.y} width={t} height={t} rx={t * 0.24} fill={cardFill} stroke={border} strokeWidth={1} filter="url(#gd-shadow)" />
            {s.file
              ? <>
                {p.mode === 'dark' && <rect x={tx + t * 0.1} y={el.y + t * 0.1} width={t * 0.8} height={t * 0.8} rx={t * 0.16} fill="#FFFFFF" />}
                <image href={iconUrl(s.file)} x={tx + t * 0.16} y={el.y + t * 0.16} width={t * 0.68} height={t * 0.68} />
              </>
              : <>
                <rect x={tx + t * 0.14} y={el.y + t * 0.14} width={t * 0.72} height={t * 0.72} rx={t * 0.18} fill={tint} />
                <text x={tx + t / 2} y={el.y + t / 2 + t * 0.2} fontFamily={ICON_FONT} fontSize={t * 0.42} fill={c.color} textAnchor="middle">{s.icon}</text>
              </>}
            {!hideText && <TextLines lines={lines} x={el.x + el.w / 2} y={el.y + t + 17} size={13} weight={500} color={p.ink} />}
            {!hideText && sub && <text x={el.x + el.w / 2} y={el.y + t + 17 + lines.length * 16} fontFamily={DIAGRAM_FONT} fontSize={11} fill={p.inkSoft} textAnchor="middle">{sub}</text>}
          </g>
        );
      }
      const tile = Math.min(40, el.h - 16);
      const tx = el.x + 12, ty = el.y + (el.h - tile) / 2;
      const textX = tx + tile + 12;
      const maxW = el.w - (textX - el.x) - 10;
      const lines = wrapText(label, maxW, 14, 500).slice(0, 2);
      const blockH = lines.length * 18 + (sub ? 16 : 0);
      const y0 = el.y + el.h / 2 - blockH / 2 + 13;
      return (
        <g {...common}>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={12} fill={cardFill} stroke={border} strokeWidth={Math.max(1, sw === 2 ? 1 : sw)} filter={el.shadow === false ? undefined : 'url(#gd-shadow)'} />
          <path d={`M${el.x + 12},${el.y + el.h - 0.5} H${el.x + el.w - 12}`} stroke={c.color} strokeWidth={3} strokeLinecap="round" opacity={0.9} />
          {s.file
            ? <>
              {p.mode === 'dark' && <rect x={tx - 2} y={ty - 2} width={tile + 4} height={tile + 4} rx={10} fill="#FFFFFF" />}
              <image href={iconUrl(s.file)} x={tx + 1} y={ty + 1} width={tile - 2} height={tile - 2} />
            </>
            : <>
              <rect x={tx} y={ty} width={tile} height={tile} rx={10} fill={tint} />
              <text x={tx + tile / 2} y={ty + tile / 2 + tile * 0.22} fontFamily={ICON_FONT} fontSize={tile * 0.6} fill={c.color} textAnchor="middle">{s.icon}</text>
            </>}
          {!hideText && <TextLines lines={lines} x={textX} y={y0} size={14} weight={500} color={p.ink} anchor="start" lh={1.28} />}
          {!hideText && sub && <text x={textX} y={y0 + lines.length * 18} fontFamily={DIAGRAM_FONT} fontSize={12} fill={p.inkSoft}>{sub}</text>}
        </g>
      );
    }
    case 'arrow':
    case 'line': {
      const route = getRoute(el, map);
      const d = routeToPath(route, el.routing);
      const n = route.length;
      const label = el.text && !hideText ? el.text : '';
      const mid = polylineMid(route);
      const size = el.fontSize ?? 12;
      const lw = label ? Math.max(...label.split('\n').map((l) => l.length)) * size * 0.56 + 16 : 0;
      const lh = label ? label.split('\n').length * size * 1.3 + 8 : 0;
      const isArrow = el.type === 'arrow';
      const endFrom = el.routing === 'curve' && n === 2 ? curveTangentFrom(route, false) : route[n - 2];
      const startFrom = el.routing === 'curve' && n === 2 ? curveTangentFrom(route, true) : route[1];
      return (
        <g {...common}>
          <path d={d} fill="none" stroke="transparent" strokeWidth={Math.max(12, sw + 10)} />
          <path d={d} fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={el.animated ? `${sw * 4} ${sw * 4}` : dash}
            className={el.animated ? 'gd-flow' : undefined} strokeLinecap="round" strokeLinejoin="round" />
          {head(isArrow ? el.startHead : 'none', route[0], startFrom, stroke, sw, 's')}
          {head(isArrow ? el.endHead ?? 'arrow' : 'none', route[n - 1], endFrom, stroke, sw, 'e')}
          {label && (
            <g>
              <rect x={mid[0] - lw / 2} y={mid[1] - lh / 2} width={lw} height={lh} rx={lh / 2 > 14 ? 8 : lh / 2} fill={p.canvas} stroke={p.cardBorder} strokeWidth={1} />
              <TextLines lines={label.split('\n')} x={mid[0]} y={mid[1] - lh / 2 + 4 + size * 0.95} size={size} color={p.inkSoft} weight={500} />
            </g>
          )}
        </g>
      );
    }
    case 'freedraw':
      return (
        <g {...common} transform={`translate(${el.x},${el.y})`}>
          <path d={freehandPath(el.path ?? [])} fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    case 'image':
      return (
        <g {...common}>
          <image href={el.src} x={el.x} y={el.y} width={el.w} height={el.h} preserveAspectRatio="xMidYMid meet" />
        </g>
      );
  }
  return null;
}

function curveTangentFrom(route: Pt[], atStart: boolean): Pt {
  const [a, z] = [route[0], route[route.length - 1]];
  const dx = z[0] - a[0], dy = z[1] - a[1];
  const horiz = Math.abs(dx) >= Math.abs(dy);
  if (atStart) return horiz ? [a[0] + dx / 2, a[1]] : [a[0], a[1] + dy / 2];
  return horiz ? [z[0] - dx / 2, z[1]] : [z[0], z[1] - dy / 2];
}
