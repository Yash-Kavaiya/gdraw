export type ThemeMode = 'light' | 'dark';

export interface Palette {
  mode: ThemeMode;
  canvas: string;
  grid: string;
  ink: string;      // 'auto' stroke
  inkSoft: string;  // secondary text
  card: string;     // service card surface
  cardBorder: string;
  selection: string;
  selectionFill: string;
}

export const PALETTES: Record<ThemeMode, Palette> = {
  light: {
    mode: 'light', canvas: '#FFFFFF', grid: '#E3E6EA', ink: '#1F1F1F', inkSoft: '#5F6368',
    card: '#FFFFFF', cardBorder: '#DADCE0', selection: '#1A73E8', selectionFill: 'rgba(26,115,232,0.08)',
  },
  dark: {
    mode: 'dark', canvas: '#131314', grid: '#2A2C2E', ink: '#E3E3E3', inkSoft: '#9AA0A6',
    card: '#1E1F20', cardBorder: '#3C4043', selection: '#A8C7FA', selectionFill: 'rgba(168,199,250,0.10)',
  },
};

/** Stroke swatches (Google palette) */
export const STROKES = ['auto', '#4285F4', '#EA4335', '#F9AB00', '#34A853', '#A142F4', '#12B5CB', '#5F6368'];
/** Fill swatches: tints of the Google palette */
export const FILLS = ['transparent', '#E8F0FE', '#FCE8E6', '#FEF7E0', '#E6F4EA', '#F3E8FD', '#E4F7FB', '#F1F3F4', '#FFFFFF'];

const DARK_FILL: Record<string, string> = {
  '#E8F0FE': '#1C2B4A', '#FCE8E6': '#47201C', '#FEF7E0': '#3D3215', '#E6F4EA': '#183A24',
  '#F3E8FD': '#33204A', '#E4F7FB': '#133A40', '#F1F3F4': '#2D2F31', '#FFFFFF': '#1E1F20',
  '#FFF8C5': '#4A4416',
};

export function resolveStroke(c: string, p: Palette) {
  if (c === 'auto') return p.ink;
  if (p.mode === 'dark' && c === '#5F6368') return '#9AA0A6';
  return c;
}

export function resolveFill(c: string, p: Palette) {
  if (!c || c === 'transparent') return 'none';
  if (p.mode === 'dark') return DARK_FILL[c.toUpperCase()] ?? c;
  return c;
}

// ---- text measurement & wrapping ----
let ctx: CanvasRenderingContext2D | null = null;
export const DIAGRAM_FONT = '"Google Sans", "Google Sans Text", Roboto, system-ui, sans-serif';

export function measure(text: string, size: number, weight = 400) {
  if (!ctx) ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return text.length * size * 0.55;
  ctx.font = `${weight} ${size}px ${DIAGRAM_FONT}`;
  return ctx.measureText(text).width;
}

export function wrapText(text: string, maxWidth: number, size: number, weight = 400): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    if (!para) { out.push(''); continue; }
    const words = para.split(/(\s+)/);
    let line = '';
    for (const w of words) {
      const test = line + w;
      if (measure(test, size, weight) > maxWidth && line.trim()) {
        out.push(line.trimEnd());
        line = w.trimStart();
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

export function textBlockSize(text: string, size: number) {
  const lines = (text || ' ').split('\n');
  const w = Math.max(...lines.map((l) => measure(l || ' ', size)));
  return { w: Math.ceil(w) + 4, h: Math.ceil(lines.length * size * 1.3) };
}
