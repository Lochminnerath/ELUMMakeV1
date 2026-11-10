import type {
  Appear,
  DesignContent,
  DesignElement,
  DesignKind,
  ElementType,
  ImageAdjust,
  ImageElement,
  LineElement,
  Page,
  PageTransition,
  PathElement,
  ShapeElement,
  ShapeType,
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
  { id: 'certificate', label: 'Certificate (landscape)', kind: 'poster', width: 1650, height: 1275 },
  { id: 'business-card', label: 'Business card', kind: 'custom', width: 1050, height: 600 },
  { id: 'logo', label: 'Logo', kind: 'custom', width: 1000, height: 1000 },
  { id: 'desktop', label: 'Website (desktop)', kind: 'custom', width: 1440, height: 1024 },
  { id: 'phone', label: 'App screen (phone)', kind: 'custom', width: 390, height: 844 },
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
  { family: 'DM Serif Display', label: 'DM Serif Display' },
  { family: 'Archivo Black', label: 'Archivo Black' },
  { family: 'Pacifico', label: 'Pacifico' },
  { family: 'Montserrat', label: 'Montserrat' },
  { family: 'Fraunces', label: 'Fraunces' },
];

/** Every ready-made shape, in the order the Shapes menu lists them. */
export const SHAPES: { type: ShapeType; label: string }[] = [
  { type: 'rect', label: 'Rectangle' },
  { type: 'ellipse', label: 'Circle' },
  { type: 'triangle', label: 'Triangle' },
  { type: 'diamond', label: 'Diamond' },
  { type: 'pentagon', label: 'Pentagon' },
  { type: 'hexagon', label: 'Hexagon' },
  { type: 'star', label: 'Star' },
  { type: 'burst', label: 'Burst' },
  { type: 'heart', label: 'Heart' },
  { type: 'arrow', label: 'Arrow block' },
  { type: 'bubble', label: 'Speech bubble' },
  { type: 'cross', label: 'Plus' },
];
export const SHAPE_TYPES = SHAPES.map((x) => x.type);
export const isShape = (el: { type: string }): el is ShapeElement => (SHAPE_TYPES as string[]).includes(el.type);

/** Blend modes, named the way design tools name them. */
export const BLENDS = [
  { value: 'normal', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'color-dodge', label: 'Colour dodge' },
  { value: 'color-burn', label: 'Colour burn' },
  { value: 'difference', label: 'Difference' },
  { value: 'luminosity', label: 'Luminosity' },
] as const;

/** A picture as it was taken. */
export const NO_ADJUST: ImageAdjust = { brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0, hue: 0 };

/** Ready-made looks for pictures: plain settings of the same sliders, nothing more. */
export const PHOTO_FILTERS: { id: string; label: string; adjust: ImageAdjust }[] = [
  { id: 'original', label: 'Original', adjust: NO_ADJUST },
  { id: 'mono', label: 'Mono', adjust: { ...NO_ADJUST, grayscale: 100, contrast: 110 } },
  { id: 'warm', label: 'Warm', adjust: { ...NO_ADJUST, sepia: 30, saturate: 120, brightness: 104 } },
  { id: 'cool', label: 'Cool', adjust: { ...NO_ADJUST, hue: 200, saturate: 90, sepia: 10 } },
  { id: 'vivid', label: 'Vivid', adjust: { ...NO_ADJUST, saturate: 150, contrast: 115 } },
  { id: 'fade', label: 'Fade', adjust: { ...NO_ADJUST, contrast: 80, brightness: 110, saturate: 80 } },
  { id: 'noir', label: 'Noir', adjust: { ...NO_ADJUST, grayscale: 100, contrast: 150, brightness: 90 } },
  { id: 'sunlit', label: 'Sunlit', adjust: { ...NO_ADJUST, brightness: 112, sepia: 18, saturate: 115 } },
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

const SHAPE_FILLS: Record<ShapeType, string> = {
  rect: '#7093f8',
  ellipse: '#ec7fa9',
  triangle: '#3fc4a0',
  star: '#e9b949',
  diamond: '#9b84ee',
  pentagon: '#f59a52',
  hexagon: '#3fc4a0',
  heart: '#ec7fa9',
  arrow: '#7093f8',
  bubble: '#eef2ff',
  cross: '#f59a52',
  burst: '#e9b949',
};

export function newShape(page: { width: number; height: number }, type: ShapeType): ShapeElement {
  const size = Math.round(Math.min(page.width, page.height) * 0.3);
  // Arrows and speech bubbles read better wider than tall.
  const w = type === 'arrow' || type === 'bubble' ? Math.round(size * 1.4) : size;
  return {
    ...base(type, Math.round((page.width - w) / 2), Math.round((page.height - size) / 2), w, size),
    type,
    fill: SHAPE_FILLS[type] ?? '#7093f8',
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

/**
 * A vector from points in page pixels, as the pen or the brush leaves them. Its box is the
 * points' bounds, and the points are kept as fractions of it.
 */
export function newPath(points: { x: number; y: number }[], opts: { closed: boolean; smooth: boolean; stroke: string; strokeWidth: number; fill: string }): PathElement {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const w = Math.max(1, Math.max(...xs) - x);
  const h = Math.max(1, Math.max(...ys) - y);
  return {
    ...base('path', Math.round(x), Math.round(y), Math.round(w), Math.round(h)),
    type: 'path',
    points: points.map((p) => [round4((p.x - x) / w), round4((p.y - y) / h)]),
    closed: opts.closed,
    smooth: opts.smooth,
    fill: opts.fill,
    stroke: opts.stroke,
    strokeWidth: opts.strokeWidth,
  };
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;

/**
 * Fewer points along a hand-drawn stroke, keeping its shape (Ramer–Douglas–Peucker): points
 * closer than `tolerance` to the line between their neighbours go.
 */
export function simplifyPoints(points: { x: number; y: number }[], tolerance: number): { x: number; y: number }[] {
  if (points.length < 3) return points;
  const distance = (p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (!len) return Math.hypot(p.x - a.x, p.y - a.y);
    return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
  };
  const keep = (from: number, to: number, out: boolean[]) => {
    let far = -1;
    let most = 0;
    for (let i = from + 1; i < to; i++) {
      const d = distance(points[i], points[from], points[to]);
      if (d > most) {
        most = d;
        far = i;
      }
    }
    if (far !== -1 && most > tolerance) {
      out[far] = true;
      keep(from, far, out);
      keep(far, to, out);
    }
  };
  const out = points.map((_, i) => i === 0 || i === points.length - 1);
  keep(0, points.length - 1, out);
  return points.filter((_, i) => out[i]);
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
      transition: TRANSITIONS.includes(p.transition as PageTransition) && p.transition !== 'none' ? p.transition : undefined,
      elements: (Array.isArray(p.elements) ? p.elements : [])
        .filter((e) => e && typeof e === 'object' && ['text', ...SHAPE_TYPES, 'line', 'image', 'path'].includes(e.type))
        .filter((e) => e.type !== 'path' || (Array.isArray((e as PathElement).points) && (e as PathElement).points.length >= 2))
        .map((e) => ({
          ...e,
          id: e.id || uid(),
          rotation: Number(e.rotation) || 0,
          opacity: e.opacity ?? 1,
          groupId: typeof e.groupId === 'string' && e.groupId ? e.groupId : undefined,
          appear: APPEARS.includes(e.appear as Appear) ? e.appear : undefined,
        })) as DesignElement[],
    }))
    .map((p) => {
      // A group of one is no group.
      const counts = new Map<string, number>();
      for (const e of p.elements) if (e.groupId) counts.set(e.groupId, (counts.get(e.groupId) ?? 0) + 1);
      return { ...p, elements: p.elements.map((e) => (e.groupId && counts.get(e.groupId)! < 2 ? { ...e, groupId: undefined } : e)) };
    });
  return { pages: clean.length ? clean : [newPage()] };
}

export const TRANSITIONS: PageTransition[] = ['none', 'fade', 'slide'];
export const APPEARS: Appear[] = ['fade', 'slide', 'scale'];

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
  const text = el.uppercase ? el.text.toUpperCase() : el.text;
  for (const paragraph of text.split('\n')) {
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

// ------------------------------------------------------------- arranging many

export type AlignHow = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

/**
 * Lines elements up: with two or more, against the box around them all; with one, against the page.
 * Locked elements stay put. Returns new elements, in the same order.
 */
export function alignElements(els: DesignElement[], how: AlignHow, page: { width: number; height: number }): DesignElement[] {
  const target = els.length > 1 ? unionBox(els.map(bounds))! : { x: 0, y: 0, w: page.width, h: page.height };
  return els.map((el) => {
    if (el.locked) return el;
    const b = bounds(el);
    const dx = how === 'left' ? target.x - b.x : how === 'right' ? target.x + target.w - (b.x + b.w) : how === 'hcenter' ? target.x + target.w / 2 - (b.x + b.w / 2) : 0;
    const dy = how === 'top' ? target.y - b.y : how === 'bottom' ? target.y + target.h - (b.y + b.h) : how === 'vcenter' ? target.y + target.h / 2 - (b.y + b.h / 2) : 0;
    return { ...el, x: Math.round(el.x + dx), y: Math.round(el.y + dy) };
  });
}

/** Spaces three or more elements so the gaps between them are equal; the outer two stay put. */
export function distributeElements(els: DesignElement[], axis: 'x' | 'y'): DesignElement[] {
  const items = els.filter((el) => !el.locked).map((el) => ({ el, b: bounds(el) }));
  if (items.length < 3) return els;
  items.sort((a, b) => (axis === 'x' ? a.b.x - b.b.x : a.b.y - b.b.y));
  const first = items[0].b;
  const last = items[items.length - 1].b;
  const total = items.reduce((s, i) => s + (axis === 'x' ? i.b.w : i.b.h), 0);
  const span = axis === 'x' ? last.x + last.w - first.x : last.y + last.h - first.y;
  const gap = (span - total) / (items.length - 1);
  let at = axis === 'x' ? first.x : first.y;
  const moves = new Map<string, number>();
  for (const i of items) {
    moves.set(i.el.id, at - (axis === 'x' ? i.b.x : i.b.y));
    at += (axis === 'x' ? i.b.w : i.b.h) + gap;
  }
  return els.map((el) => {
    const d = moves.get(el.id);
    if (d === undefined) return el;
    return axis === 'x' ? { ...el, x: Math.round(el.x + d) } : { ...el, y: Math.round(el.y + d) };
  });
}

// ------------------------------------------------------------------- groups

/** The selection grown to whole groups: picking one member picks the group. */
export function expandGroups(elements: DesignElement[], ids: string[]): string[] {
  const groups = new Set(elements.filter((el) => ids.includes(el.id) && el.groupId).map((el) => el.groupId));
  if (!groups.size) return ids;
  return elements.filter((el) => ids.includes(el.id) || (el.groupId && groups.has(el.groupId))).map((el) => el.id);
}

/** Groups these elements (two or more) into one new group. */
export function groupElements(page: Page, ids: string[]): Page {
  if (ids.length < 2) return page;
  const groupId = uid();
  return { ...page, elements: page.elements.map((el) => (ids.includes(el.id) ? { ...el, groupId } : el)) };
}

/** Takes these elements, and everyone grouped with them, out of their groups. */
export function ungroupElements(page: Page, ids: string[]): Page {
  const groups = new Set(page.elements.filter((el) => ids.includes(el.id) && el.groupId).map((el) => el.groupId));
  return { ...page, elements: page.elements.map((el) => (el.groupId && groups.has(el.groupId) ? { ...el, groupId: undefined } : el)) };
}

/** True when the selection is exactly one whole group. */
export function isOneGroup(elements: DesignElement[], ids: string[]): boolean {
  const sel = elements.filter((el) => ids.includes(el.id));
  if (sel.length < 2 || !sel[0].groupId) return false;
  const g = sel[0].groupId;
  return sel.every((el) => el.groupId === g) && elements.filter((el) => el.groupId === g).length === sel.length;
}

// --------------------------------------------------------------- copying style

/** The look of an element, without its place, size or content. */
const STYLE_KEYS = [
  'fill', 'stroke', 'strokeWidth', 'radius', 'color', 'fontFamily', 'fontSize', 'fontWeight', 'italic', 'underline', 'align', 'lineHeight', 'letterSpacing', 'opacity', 'dashed',
  'shadow', 'blur', 'blend', 'outline', 'uppercase', 'highlight', 'adjust',
] as const;

export type Style = Partial<Record<(typeof STYLE_KEYS)[number], unknown>>;

export function copyStyle(el: DesignElement): Style {
  const style: Style = {};
  for (const k of STYLE_KEYS) if (k in el) style[k] = (el as unknown as Record<string, unknown>)[k];
  // A text's colour paints a shape's fill and the other way round.
  if (el.type === 'text') style.fill = el.color;
  else if ('fill' in el) style.color = el.fill;
  return style;
}

/** Puts a copied style on an element, only where the element has that property. */
const EFFECT_KEYS = new Set<string>(['shadow', 'blur', 'blend']);

export function pasteStyle(el: DesignElement, style: Style): DesignElement {
  const next = { ...el } as unknown as Record<string, unknown>;
  for (const k of STYLE_KEYS) {
    // Effects suit any element; the rest only where the element already has that property.
    const fits = k in el || EFFECT_KEYS.has(k) || (el.type === 'text' && ['outline', 'uppercase', 'highlight'].includes(k)) || (el.type === 'image' && k === 'adjust');
    if (fits && style[k] !== undefined) next[k] = style[k];
  }
  const out = next as unknown as DesignElement;
  return out.type === 'text' ? { ...out, h: textHeight(out) } : out;
}

// ------------------------------------------------------------------ brand kits

/**
 * Recolours a page with a kit: text takes the darkest kit colour (or the first), shapes and lines
 * take the kit colours in turn, headings and body take the kit's first and second fonts.
 */
export function applyKitToPage(page: Page, kit: { colors: string[]; fonts: string[] }): Page {
  const colors = kit.colors.filter((c) => /^#[0-9a-f]{3,8}$/i.test(c));
  const fonts = kit.fonts.filter(Boolean);
  if (!colors.length && !fonts.length) return page;
  const ink = colors.length ? [...colors].sort((a, b) => luminance(a) - luminance(b))[0] : null;
  const accents = colors.filter((c) => c !== ink);
  const paint = accents.length ? accents : colors;
  let n = 0;
  const texts = page.elements.filter((el): el is TextElement => el.type === 'text');
  const biggest = texts.length ? Math.max(...texts.map((t) => t.fontSize)) : 0;
  return {
    ...page,
    elements: page.elements.map((el) => {
      if (el.locked) return el;
      if (el.type === 'text') {
        const heading = el.fontSize >= biggest * 0.6 || el.fontWeight >= 600;
        const fontFamily = fonts.length ? (heading ? fonts[0] : (fonts[1] ?? fonts[0])) : el.fontFamily;
        const next = { ...el, color: ink && luminance(el.color) < 0.5 ? ink : el.color, fontFamily };
        return { ...next, h: textHeight(next) };
      }
      if (!paint.length) return el;
      if (el.type === 'line') return { ...el, stroke: paint[n++ % paint.length] };
      if (el.type === 'image') return el;
      if (el.type === 'path') return el.fill === 'none' ? { ...el, stroke: paint[n++ % paint.length] } : { ...el, fill: paint[n++ % paint.length] };
      return { ...el, fill: paint[n++ % paint.length] };
    }),
  };
}

/** Relative brightness of a #rgb or #rrggbb colour, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  let v = hex.replace('#', '');
  if (v.length === 3) v = v.split('').map((c) => c + c).join('');
  const n = parseInt(v.slice(0, 6), 16);
  if (!Number.isFinite(n)) return 1;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

// ------------------------------------------------------------- present steps

/** The elements that come in on a click, in the order they come in (bottom layer first). */
export function appearOrder(page: Page): string[] {
  return page.elements.filter((el) => el.appear && !el.hidden).map((el) => el.id);
}

// ------------------------------------------------------------- shapes as paths

const f = (n: number) => Math.round(n * 100) / 100;
const poly = (pts: [number, number][]) => `M${pts.map(([x, y]) => `${f(x)},${f(y)}`).join('L')}Z`;
/** A regular polygon with `n` corners filling a w × h box, one corner at the top. */
function regular(n: number, w: number, h: number): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    pts.push([w / 2 + (Math.cos(a) * w) / 2, h / 2 + (Math.sin(a) * h) / 2]);
  }
  return poly(pts);
}
/** A star with `n` tips; `inner` is how far in the dips reach, as a share of the tips. */
function starry(n: number, inner: number, w: number, h: number): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? 0.5 : 0.5 * inner;
    const a = (Math.PI / n) * i - Math.PI / 2;
    pts.push([w / 2 + Math.cos(a) * r * w, h / 2 + Math.sin(a) * r * h]);
  }
  return poly(pts);
}

/**
 * Every ready-made shape as an SVG path filling its w × h box. The page, thumbnails, presenting
 * and exports all draw shapes from this (exports through Path2D), so they always match.
 */
export function shapePath(type: ShapeType, w: number, h: number, radius = 0): string {
  switch (type) {
    case 'rect': {
      const r = Math.max(0, Math.min(radius, w / 2, h / 2));
      if (!r) return `M0,0H${f(w)}V${f(h)}H0Z`;
      return `M${f(r)},0H${f(w - r)}A${f(r)},${f(r)} 0 0 1 ${f(w)},${f(r)}V${f(h - r)}A${f(r)},${f(r)} 0 0 1 ${f(w - r)},${f(h)}H${f(r)}A${f(r)},${f(r)} 0 0 1 0,${f(h - r)}V${f(r)}A${f(r)},${f(r)} 0 0 1 ${f(r)},0Z`;
    }
    case 'ellipse':
      return `M0,${f(h / 2)}A${f(w / 2)},${f(h / 2)} 0 1 0 ${f(w)},${f(h / 2)}A${f(w / 2)},${f(h / 2)} 0 1 0 0,${f(h / 2)}Z`;
    case 'triangle':
      return poly([[w / 2, 0], [w, h], [0, h]]);
    case 'diamond':
      return poly([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]);
    case 'pentagon':
      return regular(5, w, h);
    case 'hexagon':
      return poly([[w * 0.25, 0], [w * 0.75, 0], [w, h / 2], [w * 0.75, h], [w * 0.25, h], [0, h / 2]]);
    case 'star':
      // The five-pointed star Make has always drawn, so older designs look the same.
      return `M${starPoints(w, h).split(' ').join('L')}Z`;
    case 'burst':
      return starry(12, 0.72, w, h);
    case 'heart':
      return `M${f(w / 2)},${f(h * 0.3)}C${f(w * 0.5)},${f(h * 0.05)} ${f(w * 0.05)},${f(-h * 0.05)} ${f(0)},${f(h * 0.3)}C${f(-w * 0.03)},${f(h * 0.6)} ${f(w * 0.35)},${f(h * 0.8)} ${f(w / 2)},${f(h)}C${f(w * 0.65)},${f(h * 0.8)} ${f(w * 1.03)},${f(h * 0.6)} ${f(w)},${f(h * 0.3)}C${f(w * 0.95)},${f(-h * 0.05)} ${f(w * 0.5)},${f(h * 0.05)} ${f(w / 2)},${f(h * 0.3)}Z`;
    case 'arrow': {
      const head = Math.min(w * 0.45, h);
      return poly([[0, h * 0.28], [w - head, h * 0.28], [w - head, 0], [w, h / 2], [w - head, h], [w - head, h * 0.72], [0, h * 0.72]]);
    }
    case 'bubble': {
      const body = h * 0.78;
      const r = Math.min(w, body) * 0.2;
      return `M${f(r)},0H${f(w - r)}A${f(r)},${f(r)} 0 0 1 ${f(w)},${f(r)}V${f(body - r)}A${f(r)},${f(r)} 0 0 1 ${f(w - r)},${f(body)}H${f(w * 0.4)}L${f(w * 0.2)},${f(h)}L${f(w * 0.24)},${f(body)}H${f(r)}A${f(r)},${f(r)} 0 0 1 0,${f(body - r)}V${f(r)}A${f(r)},${f(r)} 0 0 1 ${f(r)},0Z`;
    }
    case 'cross': {
      const t = Math.min(w, h) / 3;
      const x1 = (w - t) / 2;
      const y1 = (h - t) / 2;
      return poly([[x1, 0], [x1 + t, 0], [x1 + t, y1], [w, y1], [w, y1 + t], [x1 + t, y1 + t], [x1 + t, h], [x1, h], [x1, y1 + t], [0, y1 + t], [0, y1], [x1, y1]]);
    }
  }
}

/**
 * A pen or brush path as SVG, at its box's size. Smooth paths curve through every point
 * (Catmull–Rom turned into cubic Béziers); others go straight from point to point.
 */
export function pathD(el: Pick<PathElement, 'points' | 'closed' | 'smooth' | 'w' | 'h'>): string {
  const pts = el.points.map(([x, y]) => [x * el.w, y * el.h] as [number, number]);
  if (pts.length < 2) return '';
  if (!el.smooth || pts.length < 3) return `M${pts.map(([x, y]) => `${f(x)},${f(y)}`).join('L')}${el.closed ? 'Z' : ''}`;
  const n = pts.length;
  const at = (i: number) => (el.closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  const last = el.closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return el.closed ? `${d}Z` : d;
}

// ------------------------------------------------------------------- effects

/** The CSS filter for an element's blur and shadow, and a picture's adjustments. */
export function filterCss(el: DesignElement): string | undefined {
  const parts: string[] = [];
  if (el.type === 'image' && el.adjust) {
    const a = el.adjust;
    if (a.brightness !== 100) parts.push(`brightness(${a.brightness}%)`);
    if (a.contrast !== 100) parts.push(`contrast(${a.contrast}%)`);
    if (a.saturate !== 100) parts.push(`saturate(${a.saturate}%)`);
    if (a.grayscale) parts.push(`grayscale(${a.grayscale}%)`);
    if (a.sepia) parts.push(`sepia(${a.sepia}%)`);
    if (a.hue) parts.push(`hue-rotate(${a.hue}deg)`);
  }
  if (el.blur && el.blur > 0) parts.push(`blur(${el.blur}px)`);
  if (el.shadow) parts.push(`drop-shadow(${el.shadow.x}px ${el.shadow.y}px ${Math.max(0, el.shadow.blur)}px ${el.shadow.color})`);
  return parts.length ? parts.join(' ') : undefined;
}

/** A paint is a plain colour or a gradient; this says which, the way backgrounds are read. */
export function isGradient(paint: string): boolean {
  return paint.startsWith('linear:');
}

// --------------------------------------------------------- resizing a design

/**
 * Everything on the pages moved and scaled to fit a new page size, keeping the layout's
 * proportions and centring it: what "Resize" does in design tools, done by plain arithmetic.
 */
export function scaleContent(content: DesignContent, from: { width: number; height: number }, to: { width: number; height: number }): DesignContent {
  const s = Math.min(to.width / from.width, to.height / from.height);
  const ox = (to.width - from.width * s) / 2;
  const oy = (to.height - from.height * s) / 2;
  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    pages: content.pages.map((p) => ({
      ...p,
      elements: p.elements.map((el) => {
        const moved = { ...el, x: r(ox + el.x * s), y: r(oy + el.y * s), w: r(el.w * s), h: r(el.h * s) };
        if (el.shadow) moved.shadow = { ...el.shadow, x: r(el.shadow.x * s), y: r(el.shadow.y * s), blur: r(el.shadow.blur * s) };
        if (el.blur) moved.blur = r(el.blur * s);
        switch (moved.type) {
          case 'text': {
            const t = { ...moved, fontSize: r(moved.fontSize * s), letterSpacing: r(moved.letterSpacing * s) };
            if (t.outline) t.outline = { ...t.outline, width: r(t.outline.width * s) };
            return { ...t, h: textHeight(t) };
          }
          case 'line':
          case 'path':
            return { ...moved, strokeWidth: r(moved.strokeWidth * s) };
          case 'image':
            return { ...moved, radius: r(moved.radius * s) };
          default:
            return { ...moved, strokeWidth: r(moved.strokeWidth * s), radius: r(moved.radius * s) } as DesignElement;
        }
      }),
    })),
  };
}
