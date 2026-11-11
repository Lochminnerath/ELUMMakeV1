import { describe, expect, it } from 'vitest';
import type { DesignContent, TextElement } from '../api/types';
import { filterCss, newPath, newShape, newText, normalizeContent, pasteStyle, copyStyle, pathD, scaleContent, SHAPE_TYPES, shapePath, simplifyPoints } from './model';

const page = { width: 1000, height: 600 };

describe('shapes', () => {
  it('draws every shape as a closed path inside its box', () => {
    for (const type of SHAPE_TYPES) {
      const d = shapePath(type, 200, 100, 12);
      expect(d.startsWith('M'), type).toBe(true);
      expect(d.endsWith('Z'), type).toBe(true);
      const numbers = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
      expect(numbers.every(Number.isFinite), type).toBe(true);
    }
  });

  it('gives new shapes a fill and keeps arrows and bubbles wide', () => {
    const arrow = newShape(page, 'arrow');
    expect(arrow.w).toBeGreaterThan(arrow.h);
    expect(newShape(page, 'heart').fill).toMatch(/^#/);
  });
});

describe('the pen and the brush', () => {
  it('keeps points as fractions of the box, so the path stretches with it', () => {
    const p = newPath(
      [
        { x: 100, y: 100 },
        { x: 300, y: 100 },
        { x: 200, y: 300 },
      ],
      { closed: true, smooth: false, stroke: '#141a2e', strokeWidth: 4, fill: '#bacafc' },
    );
    expect([p.x, p.y, p.w, p.h]).toEqual([100, 100, 200, 200]);
    expect(p.points).toEqual([
      [0, 0],
      [1, 0],
      [0.5, 1],
    ]);
    expect(pathD(p)).toBe('M0,0L200,0L100,200Z');
    expect(pathD({ ...p, w: 400 })).toBe('M0,0L400,0L200,200Z');
  });

  it('curves through every point when smooth', () => {
    const p = newPath(
      [
        { x: 0, y: 0 },
        { x: 50, y: 100 },
        { x: 100, y: 0 },
      ],
      { closed: false, smooth: true, stroke: '#000000', strokeWidth: 2, fill: 'none' },
    );
    const d = pathD(p);
    expect(d.match(/C/g)).toHaveLength(2);
    expect(d.endsWith('100,0')).toBe(true);
  });

  it('thins a hand-drawn stroke without losing its corners', () => {
    const straight = Array.from({ length: 50 }, (_, i) => ({ x: i, y: 0 }));
    const corner = [...straight, ...Array.from({ length: 50 }, (_, i) => ({ x: 49, y: i + 1 }))];
    const out = simplifyPoints(corner, 0.5);
    expect(out).toEqual([
      { x: 0, y: 0 },
      { x: 49, y: 0 },
      { x: 49, y: 50 },
    ]);
  });

  it('opens designs with paths, and drops broken ones', () => {
    const content = normalizeContent({
      pages: [
        {
          id: 'p',
          background: '#ffffff',
          elements: [
            { id: 'a', type: 'path', x: 0, y: 0, w: 10, h: 10, points: [[0, 0], [1, 1]], closed: false, smooth: false, fill: 'none', stroke: '#000', strokeWidth: 1 },
            { id: 'b', type: 'path', x: 0, y: 0, w: 10, h: 10, points: [] },
            { id: 'c', type: 'heart', x: 0, y: 0, w: 10, h: 10, fill: '#f00', stroke: '#000', strokeWidth: 0, radius: 0 },
          ],
        },
      ],
    });
    expect(content.pages[0].elements.map((e) => e.id)).toEqual(['a', 'c']);
  });
});

describe('effects', () => {
  it('writes blur, shadow and picture adjustments as one CSS filter', () => {
    const shape = { ...newShape(page, 'rect'), blur: 4, shadow: { x: 0, y: 8, blur: 20, color: '#14182e66' } };
    expect(filterCss(shape)).toBe('blur(4px) drop-shadow(0px 8px 20px #14182e66)');
    expect(filterCss(newShape(page, 'rect'))).toBeUndefined();
    const img = { id: 'i', type: 'image' as const, x: 0, y: 0, w: 1, h: 1, rotation: 0, opacity: 1, src: 'x', fit: 'cover' as const, radius: 0, adjust: { brightness: 110, contrast: 100, saturate: 100, grayscale: 100, sepia: 0, hue: 0 } };
    expect(filterCss(img)).toBe('brightness(110%) grayscale(100%)');
  });

  it('copies effects onto any element, and text effects onto text', () => {
    const from = { ...newText(page, 'title'), shadow: { x: 1, y: 2, blur: 3, color: '#000000' }, uppercase: true, highlight: '#fde68a' } as TextElement;
    const onShape = pasteStyle(newShape(page, 'rect'), copyStyle(from));
    expect(onShape.shadow).toEqual(from.shadow);
    expect('uppercase' in onShape).toBe(false);
    const onText = pasteStyle(newText(page, 'body'), copyStyle(from)) as TextElement;
    expect(onText.uppercase).toBe(true);
    expect(onText.highlight).toBe('#fde68a');
  });
});

describe('resizing a design', () => {
  it('scales and centres everything to fit the new size', () => {
    const rect = { ...newShape(page, 'rect'), x: 0, y: 0, w: 1000, h: 600, strokeWidth: 10, radius: 20 };
    const content: DesignContent = { pages: [{ id: 'p', background: '#ffffff', elements: [rect] }] };
    const out = scaleContent(content, page, { width: 500, height: 500 }).pages[0].elements[0];
    expect([out.x, out.y, out.w, out.h]).toEqual([0, 100, 500, 300]);
    expect((out as typeof rect).strokeWidth).toBe(5);
    expect((out as typeof rect).radius).toBe(10);
  });

  it('scales type, so text keeps its look', () => {
    const t = newText(page, 'title');
    const content: DesignContent = { pages: [{ id: 'p', background: '#ffffff', elements: [t] }] };
    const out = scaleContent(content, page, { width: 2000, height: 1200 }).pages[0].elements[0] as TextElement;
    expect(out.fontSize).toBe(t.fontSize * 2);
  });
});
