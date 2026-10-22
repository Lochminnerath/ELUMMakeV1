import { describe, expect, it } from 'vitest';
import type { TextElement } from '../api/types';
import { bounds, layoutText, newShape, newText, normalizeContent, parseBackground, snap, textHeight } from './model';
import { pdfBytes } from './export';
import { TEMPLATES } from './templates';

const page = { width: 1000, height: 600 };

describe('bounds', () => {
  it('grows to fit a rotated element', () => {
    const el = { ...newShape(page, 'rect'), x: 0, y: 0, w: 100, h: 50, rotation: 90 };
    const b = bounds(el);
    expect(b.w).toBeCloseTo(50);
    expect(b.h).toBeCloseTo(100);
    expect(b.x + b.w / 2).toBeCloseTo(50);
  });
});

describe('snap', () => {
  it('pulls a box onto the page centre and reports the guide', () => {
    const s = snap({ x: 448, y: 100, w: 100, h: 50 }, [], page, 6);
    expect(s.dx).toBe(2);
    expect(s.guides.some((g) => g.axis === 'x' && g.at === 500)).toBe(true);
  });

  it('lines up with another element’s edge', () => {
    const s = snap({ x: 203, y: 397, w: 80, h: 40 }, [{ x: 50, y: 300, w: 150, h: 60 }], page, 6);
    expect(s.dx).toBe(-3);
  });

  it('leaves boxes alone when nothing is close', () => {
    const s = snap({ x: 333, y: 222, w: 80, h: 40 }, [], page, 6);
    expect(s).toEqual({ dx: 0, dy: 0, guides: [] });
  });
});

describe('text layout', () => {
  const el: TextElement = { ...newText(page), text: 'one two three four five six', fontSize: 20, w: 120, letterSpacing: 0 };

  it('wraps words to the box', () => {
    const lines = layoutText(el);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toBe('one two three four five six');
  });

  it('keeps line breaks people typed', () => {
    expect(layoutText({ ...el, w: 1000, text: 'a\nb' })).toEqual(['a', 'b']);
  });

  it('breaks a word longer than the box', () => {
    const lines = layoutText({ ...el, w: 40, text: 'supercalifragilistic' });
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('')).toBe('supercalifragilistic');
  });

  it('measures height from the lines', () => {
    expect(textHeight({ ...el, w: 1000, text: 'a\nb\nc', lineHeight: 1.5 })).toBe(90);
  });
});

describe('content from the database', () => {
  it('always has a page', () => {
    expect(normalizeContent(null).pages).toHaveLength(1);
    expect(normalizeContent({ pages: 'nope' }).pages).toHaveLength(1);
  });

  it('drops unknown elements and fills in what is missing', () => {
    const c = normalizeContent({ pages: [{ elements: [{ type: 'rect', x: 1, y: 2, w: 3, h: 4 }, { type: 'video' }] }] });
    expect(c.pages[0].elements).toHaveLength(1);
    expect(c.pages[0].elements[0].id).toBeTruthy();
    expect(c.pages[0].elements[0].opacity).toBe(1);
    expect(c.pages[0].background).toBe('#ffffff');
  });
});

describe('backgrounds', () => {
  it('reads colours and gradients, and refuses anything else', () => {
    expect(parseBackground('#ec7fa9')).toEqual({ color: '#ec7fa9' });
    expect(parseBackground('linear:135:#ec7fa9:#9b84ee')).toEqual({ gradient: { angle: 135, from: '#ec7fa9', to: '#9b84ee' } });
    expect(parseBackground('url(javascript:alert(1))')).toEqual({ color: '#ffffff' });
  });
});

describe('templates', () => {
  it('build fresh content with unique ids every time', () => {
    for (const t of TEMPLATES) {
      const a = t.build();
      const b = t.build();
      const ids = a.pages.flatMap((p) => [p.id, ...p.elements.map((e) => e.id)]);
      expect(new Set(ids).size).toBe(ids.length);
      expect(a.pages[0].id).not.toBe(b.pages[0].id);
      expect(t.id).not.toMatch(/^slides|^a4|^square/);
      // Nothing hangs off the page edge.
      for (const el of a.pages.flatMap((p) => p.elements)) {
        expect(el.x).toBeGreaterThanOrEqual(0);
        expect(el.x + el.w).toBeLessThanOrEqual(t.width + 1);
      }
    }
  });

  it('keeps the ids Store links to, and has no duplicates', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(['pitch', 'lesson', 'event-poster', 'quote-post']));
    expect(ids.length).toBe(20);
  });
});

describe('PDF export', () => {
  it('writes one page per image with a valid cross-reference table', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const chunks = pdfBytes([jpeg, jpeg], 10, 6, 7.5, 4.5);
    const bytes = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    chunks.reduce((at, c) => (bytes.set(c, at), at + c.length), 0);
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/Count 2');
    expect(text).toContain('/MediaBox [0 0 7.50 4.50]');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    // Every offset in the table points at the object it names.
    const xref = Number(/startxref\n(\d+)/.exec(text)![1]);
    const table = text.slice(xref).split('\n').slice(3);
    for (let id = 1; id <= 8; id++) {
      const offset = Number(table[id - 1].slice(0, 10));
      expect(text.slice(offset, offset + `${id} 0 obj`.length)).toBe(`${id} 0 obj`);
    }
  });
});
