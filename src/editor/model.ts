import type {
  DesignContent,
  DesignElement,
  DesignKind,
  ElementType,
  ImageElement,
  LineElement,
  Page,
  ShapeElement,
  TextElement,
} from '../api/types';

/** The pieces of a design and the geometry the editor needs: sizes, bounds, snapping, text layout. */

export const uid = () => crypto.randomUUID().slice(0, 12);

export interface PageSize {
  id: string;
  label: string;
  kind: DesignKind;
  width: number;
  height: number;
}

export const PAGE_SIZES: PageSize[] = [
  { id: 'slides-16x9', label: 'Presentation (16:9)', kind: 'presentation', width: 1920, height: 1080 },
  { id: 'slides-4x3', label: 'Presentation (4:3)', kind: 'presentation', width: 1600, height: 1200 },
  { id: 'square', label: 'Square post', kind: 'social', width: 1080, height: 1080 },
  { id: 'portrait-post', label: 'Portrait post (4:5)', kind: 'social', width: 1080, height: 1350 },
  { id: 'story', label: 'Story (9:16)', kind: 'social', width: 1080, height: 1920 },
  { id: 'banner', label: 'Banner', kind: 'social', width: 1500, height: 500 },
  { id: 'a4', label: 'Poster (A4)', kind: 'poster', width: 1240, height: 1754 },
  { id: 'letter', label: 'Flyer (US Letter)', kind: 'poster', width: 1275, height: 1650 },
];

export const FONTS = [
  { family: 'Manrope', label: 'Manrope' },
  { family: 'Sora', label: 'Sora' },
  { family: 'Space Grotesk', label: 'Space Grotesk' },
  { family: 'Playfair Display', label: 'Playfair Display' },
  { family: 'Lora', label: 'Lora' },
  { family: 'Bebas Neue', label: 'Bebas Neue' },
  { family: 'Caveat', label: 'Caveat' },
  { family: 'IBM Plex Mono', label: 'IBM Plex Mono' },
];

/** The ELUM palette first, then neutrals: what the colour pickers offer before a custom colour. */
export const SWATCHES = [
  '#7093f8', '#3b5bd6', '#f59a52', '#a84d17', '#3fc4a0', '#187a5f', '#9b84ee', '#604590',
  '#ec7fa9', '#a8335f', '#e9b949', '#7f5c00', '#141a2e', '#5a6178', '#e2e5ee', '#ffffff',
];

export const BACKGROUNDS = [
  '#ffffff', '#f4f5f8', '#141a2e', '#0e1220', '#fdeef4', '#eef2ff', '#fdf0e4', '#e8f8f2',
  'linear:135:#ec7fa9:#9b84ee', 'linear:135:#7093f8:#3fc4a0', 'linear:160:#f59a52:#ec7fa9', 'linear:180:#141a2e:#3b5bd6',
];

// ------------------------------------------------------------------ factories

const base = (type: ElementType, x: number, y: number, w: number, h: number) => ({
  id: uid(),
  type,
  x,
  y,
  w,
  h,
  rotation: 0,
  opacity: 1,
});

export function newText(page: { width: number; height: number }, preset: 'title' | 'heading' | 'body' = 'body'): TextElement {
  const size = preset === 'title' ? Math.round(page.height * 0.09) : preset === 'heading' ? Math.round(page.height * 0.055) : Math.round(page.height * 0.03);
  const w = Math.round(page.width * (preset === 'body' ? 0.5 : 0.7));
  const text = preset === 'title' ? 'Add a title' : preset === 'heading' ? 'Add a heading' : 'Add some text';
  const el: TextElement = {
    ...base('text', 0, 0, w, size * 1.2),
    type: 'text',
    text,
    fontFamily: preset === 'body' ? 'Manrope' : 'Sora',
    fontSize: Math.max(12, size),
    fontWeight: preset === 'body' ? 400 : 700,
    italic: false,
    underline: false,
    align: preset === 'body' ? 'left' : 'center',
    color: '#141a2e',
    lineHeight: 1.25,
    letterSpacing: 0,
  };
  el.h = textHeight(el);
  el.x = Math.round((page.width - el.w) / 2);
  el.y = Math.round((page.height - el.h) / 2);
  return el;
}

export function newShape(page: { width: number; height: number }, type: ShapeElement['type']): ShapeElement {
  const size = Math.round(Math.min(page.width, page.height) * 0.3);
  return {
    ...base(type, Math.round((page.width - size) / 2), Math.round((page.height - size) / 2), size, size),
    type,
    fill: type === 'rect' ? '#7093f8' : type === 'ellipse' ? '#ec7fa9' : type === 'triangle' ? '#3fc4a0' : '#e9b949',
    stroke: '#141a2e',
    strokeWidth: 0,
    radius: 0,
  };
}

export function newLine(page: { width: number; height: number }, arrow = false): LineElement {
  const w = Math.round(page.width * 0.3);
  return {
    ...base('line', Math.round((page.width - w) / 2), Math.round(page.height / 2), w, 0),
    type: 'line',
    stroke: '#141a2e',
    strokeWidth: Math.max(2, Math.round(page.height / 200)),
    arrow,
    dashed: false,
  };
}

export function newImage(page: { width: number; height: number }, src: string, natural: { width: number; height: number }): ImageElement {
  const scale = Math.min((page.width * 0.6) / natural.width, (page.height * 0.6) / natural.height, 1);
  const w = Math.max(20, Math.round(natural.width * scale));
  const h = Math.max(20, Math.round(natural.height * scale));
  return { ...base('image', Math.round((page.width - w) / 2), Math.round((page.height - h) / 2), w, h), type: 'image', src, fit: 'cover', radius: 0 };
}

export function newPage(background = '#ffffff'): Page {
  return { id: uid(), background, elements: [] };
}

/** A deep copy with fresh ids, for duplicating elements and pages. */
export function cloneElement<T extends DesignElement>(el: T, offset = 0): T {
  return { ...structuredClone(el), id: uid(), x: el.x + offset, y: el.y + offset };
}

export function clonePage(page: Page): Page {
  return { ...structuredClone(page), id: uid(), elements: page.elements.map((e) => cloneElement(e)) };
}

/** Old or hand-written content made safe to open: every page and element has what it needs. */
export function normalizeContent(raw: unknown): DesignContent {
  const pages = Array.isArray((raw as DesignContent | null)?.pages) ? (raw as DesignContent).pages : [];
  const clean = pages
    .filter((p) => p && typeof p === 'object')
    .map((p) => ({
      id: typeof p.id === 'string' && p.id ? p.id : uid(),
      background: typeof p.background === 'string' ? p.background : '#ffffff',
      notes: typeof p.notes === 'string' ? p.notes : undefined,
      elements: (Array.isArray(p.elements) ? p.elements : [])
        .filter((e) => e && typeof e === 'object' && ['text', 'rect', 'ellipse', 'triangle', 'star', 'line', 'image'].includes(e.type))
        .map((e) => ({ ...e, id: e.id || uid(), rotation: Number(e.rotation) || 0, opacity: e.opacity ?? 1 })) as DesignElement[],
    }));
  return { pages: clean.length ? clean : [newPage()] };
}

// ------------------------------------------------------------------- geometry

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The axis-aligned box around an element, after rotation. Lines may have negative w or h. */
export function bounds(el: DesignElement): Box {
  if (el.type === 'line') {
    return { x: Math.min(el.x, el.x + el.w), y: Math.min(el.y, el.y + el.h), w: Math.abs(el.w), h: Math.abs(el.h) };
  }
  if (!el.rotation) return { x: el.x, y: el.y, w: el.w, h: el.h };
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  const r = (el.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(r));
  const sin = Math.abs(Math.sin(r));
  const w = el.w * cos + el.h * sin;
  const h = el.w * sin + el.h * cos;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

export function unionBox(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  const x1 = Math.min(...boxes.map((b) => b.x));
  const y1 = Math.min(...boxes.map((b) => b.y));
  const x2 = Math.max(...boxes.map((b) => b.x + b.w));
  const y2 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function intersects(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function rotatePoint(px: number, py: number, cx: number, cy: number, degrees: number) {
  const r = (degrees * Math.PI) / 180;
  const dx = px - cx;
  const dy = py - cy;
  return { x: cx + dx * Math.cos(r) - dy * Math.sin(r), y: cy + dx * Math.sin(r) + dy * Math.cos(r) };
}

// ------------------------------------------------------------------- snapping

export interface Guide {
  axis: 'x' | 'y';
  /** The page coordinate the guide sits on. */
  at: number;
  from: number;
  to: number;
}

/**
 * Pulls a moving box onto nearby edges and centres: the page's, and other elements'.
 * Returns how far to move it, and the guide lines to draw.
 */
export function snap(moving: Box, others: Box[], page: { width: number; height: number }, threshold: number) {
  const targets = [{ x: 0, y: 0, w: page.width, h: page.height }, ...others];
  const xs = targets.flatMap((t) => [t.x, t.x + t.w / 2, t.x + t.w]);
  const ys = targets.flatMap((t) => [t.y, t.y + t.h / 2, t.y + t.h]);
  const mine = { x: [moving.x, moving.x + moving.w / 2, moving.x + moving.w], y: [moving.y, moving.y + moving.h / 2, moving.y + moving.h] };

  const best = (candidates: number[], edges: number[]) => {
    let pick: { delta: number; at: number } | null = null;
    for (const c of candidates) {
      for (const e of edges) {
        const d = c - e;
        if (Math.abs(d) <= threshold && (!pick || Math.abs(d) < Math.abs(pick.delta))) pick = { delta: d, at: c };
      }
    }
    return pick;
  };
  const sx = best(xs, mine.x);
  const sy = best(ys, mine.y);
  const dx = sx?.delta ?? 0;
  const dy = sy?.delta ?? 0;
  const moved = { x: moving.x + dx, y: moving.y + dy, w: moving.w, h: moving.h };
  const guides: Guide[] = [];
  if (sx) {
    const related = targets.filter((t) => [t.x, t.x + t.w / 2, t.x + t.w].some((v) => Math.abs(v - sx.at) < 0.5));
    const span = unionBox([moved, ...related])!;
    guides.push({ axis: 'x', at: sx.at, from: span.y, to: span.y + span.h });
  }
  if (sy) {
    const related = targets.filter((t) => [t.y, t.y + t.h / 2, t.y + t.h].some((v) => Math.abs(v - sy.at) < 0.5));
    const span = unionBox([moved, ...related])!;
    guides.push({ axis: 'y', at: sy.at, from: span.x, to: span.x + span.w });
  }
  return { dx, dy, guides };
}

// ------------------------------------------------------------------ text layout

let measurer: CanvasRenderingContext2D | null | undefined;

function measureContext(): CanvasRenderingContext2D | null {
  if (measurer === undefined) {
    try {
      measurer = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
    } catch {
      measurer = null;
    }
  }
  return measurer;
}

export function fontString(el: Pick<TextElement, 'fontFamily' | 'fontSize' | 'fontWeight' | 'italic'>): string {
  return `${el.italic ? 'italic ' : ''}${el.fontWeight} ${el.fontSize}px "${el.fontFamily}", Manrope, system-ui, sans-serif`;
}

/** How wide a run of text is. Without a canvas (tests), an average glyph width stands in. */
export function textWidth(text: string, el: Pick<TextElement, 'fontFamily' | 'fontSize' | 'fontWeight' | 'italic' | 'letterSpacing'>): number {
  const ctx = measureContext();
  const spacing = el.letterSpacing * text.length;
  if (!ctx) return text.length * el.fontSize * 0.55 + spacing;
  ctx.font = fontString(el);
  return ctx.measureText(text).width + spacing;
}

/**
 * Splits text into the lines it fills at the element's width: words wrap, and a word longer
 * than the line breaks wherever it must. The same layout is used on screen, in thumbnails,
 * when presenting and when exporting, so they always match.
 */
export function layoutText(el: TextElement): string[] {
  const max = Math.max(el.w, el.fontSize);
  const lines: string[] = [];
  for (const paragraph of el.text.split('\n')) {
    const words = paragraph.split(/(\s+)/);
    let line = '';
    for (const word of words) {
      const next = line + word;
      if (line && textWidth(next.trimEnd(), el) > max) {
        lines.push(line.trimEnd());
        line = word.trimStart();
      } else {
        line = next;
      }
      // A single word wider than the box breaks by character.
      while (line && !/\s/.test(line.trim()) && textWidth(line.trimEnd(), el) > max) {
        let cut = line.length - 1;
        while (cut > 1 && textWidth(line.slice(0, cut), el) > max) cut--;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

export function textHeight(el: TextElement): number {
  return Math.ceil(layoutText(el).length * el.fontSize * el.lineHeight);
}

// ------------------------------------------------------------------ backgrounds

export interface Gradient {
  angle: number;
  from: string;
  to: string;
}

export function parseBackground(bg: string): { color: string } | { gradient: Gradient } {
  const m = /^linear:(-?\d+(?:\.\d+)?):(#[0-9a-f]{3,8}):(#[0-9a-f]{3,8})$/i.exec(bg);
  if (m) return { gradient: { angle: Number(m[1]), from: m[2], to: m[3] } };
  return { color: /^#[0-9a-f]{3,8}$/i.test(bg) ? bg : '#ffffff' };
}

export function backgroundCss(bg: string): string {
  const p = parseBackground(bg);
  return 'gradient' in p ? `linear-gradient(${p.gradient.angle}deg, ${p.gradient.from}, ${p.gradient.to})` : p.color;
}

/** Points for a star with five tips inside a w × h box. */
export function starPoints(w: number, h: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 0.5 : 0.2;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(w / 2 + Math.cos(a) * r * w).toFixed(2)},${(h / 2 + Math.sin(a) * r * h * 1.05 + h * 0.03).toFixed(2)}`);
  }
  return pts.join(' ');
}
