import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import type { El } from './types';
import { PALETTES, ThemeMode } from './theme';
import { renderElement, SvgDefs, getRoute } from './render';
import { boundsOf, boundsOfPoints, unionBoxes } from './geometry';
import { serviceInfo, ZONE_STYLES } from './services';

const fontCache = new Map<string, string>();

const iconCache = new Map<string, string>();

/** Replace every reference to an official icon (/gcp-icons/*.svg) with an inline data URI. */
export async function inlineOfficialIcons(markup: string): Promise<string> {
  const refs = [...new Set([...markup.matchAll(/(?:href|src)=["']([^"']*(?:gcp|agentic|ai)-icons\/[\w.-]+\.(?:svg|png))["']/g)].map((m) => m[1]))];
  for (const ref of refs) {
    if (!iconCache.has(ref)) {
      try {
        if (ref.endsWith('.png')) iconCache.set(ref, await toDataUrl(new URL(ref, location.href).href));
        else {
          const txt = await (await fetch(ref)).text();
          iconCache.set(ref, 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(txt))));
        }
      } catch { continue; }
    }
    markup = markup.split(`"${ref}"`).join(`"${iconCache.get(ref)}"`).split(`'${ref}'`).join(`'${iconCache.get(ref)}'`);
  }
  return markup;
}

async function toDataUrl(url: string) {
  const blob = await (await fetch(url)).blob();
  return await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(blob); });
}

/** Fetch a Google Fonts CSS2 stylesheet and inline every font file as base64. */
async function inlineFontCss(cssUrl: string): Promise<string> {
  if (fontCache.has(cssUrl)) return fontCache.get(cssUrl)!;
  try {
    let css = await (await fetch(cssUrl)).text();
    const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]))];
    for (const u of urls) css = css.split(u).join(await toDataUrl(u));
    fontCache.set(cssUrl, css);
    return css;
  } catch {
    return '';
  }
}

export async function fontStyleFor(icons: string[], text: string): Promise<string> {
  const parts: string[] = [];
  if (icons.length) {
    const names = [...new Set(icons)].sort().join(',');
    parts.push(await inlineFontCss(`https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0,0&icon_names=${names}&display=block`));
  }
  const chars = [...new Set(text.replace(/\s/g, ''))].join('') + ' ';
  if (chars.trim()) {
    const t = encodeURIComponent(chars);
    parts.push(await inlineFontCss(`https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500&text=${t}&display=block`));
    parts.push(await inlineFontCss(`https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&text=${t}&display=block`));
  }
  return parts.join('\n');
}

function collect(elements: El[]) {
  const icons: string[] = [];
  let text = '';
  for (const e of elements) {
    if (e.type === 'service') { const { service } = serviceInfo(e.service); if (!service.file) icons.push(service.icon); text += (e.text ?? service.name) + (e.subtitle ?? ''); }
    if (e.type === 'zone') { const z = ZONE_STYLES[e.zoneKind ?? 'group']; icons.push(z.icon); text += e.text ?? z.label; }
    else if (e.text) text += e.text;
  }
  return { icons, text };
}

export function sceneBounds(elements: El[]) {
  const map = new Map(elements.map((e) => [e.id, e]));
  const boxes = elements.map((e) => (e.type === 'arrow' || e.type === 'line') ? boundsOfPoints(getRoute(e, map)) : boundsOf(e));
  return unionBoxes(boxes);
}

export async function exportSvg(elements: El[], mode: ThemeMode, opts: { background?: boolean; padding?: number } = {}): Promise<string> {
  const p = PALETTES[mode];
  const pad = opts.padding ?? 40;
  const b = sceneBounds(elements) ?? { x: 0, y: 0, w: 100, h: 100 };
  const map = new Map(elements.map((e) => [e.id, e]));
  const W = Math.ceil(b.w + pad * 2), H = Math.ceil(b.h + pad * 2);
  const markup = renderToStaticMarkup(
    React.createElement('svg', {
      xmlns: 'http://www.w3.org/2000/svg', width: W, height: H, viewBox: `${b.x - pad} ${b.y - pad} ${W} ${H}`,
    },
      React.createElement(SvgDefs, { p }),
      opts.background !== false ? React.createElement('rect', { x: b.x - pad, y: b.y - pad, width: W, height: H, fill: p.canvas }) : null,
      ...elements.map((e) => React.createElement('g', { key: e.id }, renderElement(e, p, map))),
    ),
  );
  const { icons, text } = collect(elements);
  const fonts = await fontStyleFor(icons, text);
  const withIcons = await inlineOfficialIcons(markup);
  return withIcons.replace(/<defs>/, `<defs><style>${fonts}</style>`).replace(/<svg /, '<svg xmlns:xlink="http://www.w3.org/1999/xlink" ');
}

export async function svgToPngBlob(svg: string, scale = 2): Promise<Blob> {
  const m = svg.match(/width="(\d+)" height="(\d+)"/);
  const w = m ? +m[1] : 800, h = m ? +m[2] : 600;
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  // give embedded fonts a moment to decode
  await new Promise((r) => setTimeout(r, 60));
  const c = document.createElement('canvas');
  c.width = w * scale; c.height = h * scale;
  const ctx = c.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(url);
  return await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/png'));
}

export function download(name: string, data: Blob | string, type = 'application/octet-stream') {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Make a Mermaid-rendered SVG self-contained (fonts + icons) so it can live on the canvas as an image. */
export async function standaloneMermaidSvg(svg: string, icons: string[], text: string) {
  const fonts = await fontStyleFor(icons, text);
  return (await inlineOfficialIcons(svg)).replace(/<style>/, `<style>${fonts}\n`);
}
