import { describe, expect, it } from 'vitest';
import type { DesignElement, Page } from '../api/types';
import { alignElements, appearOrder, applyKitToPage, copyStyle, distributeElements, expandGroups, groupElements, isOneGroup, newShape, newText, normalizeContent, pasteStyle, ungroupElements } from './model';

const size = { width: 1000, height: 600 };
const box = (id: string, x: number, y: number, w = 100, h = 50): DesignElement => ({ ...newShape(size, 'rect'), id, x, y, w, h });

describe('align', () => {
  it('lines several elements up on the box around them', () => {
    const out = alignElements([box('a', 10, 0), box('b', 200, 100, 50)], 'right', size);
    expect(out.map((e) => e.x + e.w)).toEqual([250, 250]);
  });

  it('centres a single element on the page and leaves locked ones alone', () => {
    expect(alignElements([box('a', 0, 0)], 'hcenter', size)[0].x).toBe(450);
    expect(alignElements([{ ...box('a', 0, 0), locked: true }], 'hcenter', size)[0].x).toBe(0);
  });
});

describe('distribute', () => {
  it('makes the gaps equal and keeps the outer elements still', () => {
    const out = distributeElements([box('a', 0, 0), box('b', 130, 0), box('c', 400, 0)], 'x');
    expect(out.map((e) => e.x)).toEqual([0, 200, 400]);
  });

  it('needs three', () => {
    const two = [box('a', 0, 0), box('b', 300, 0)];
    expect(distributeElements(two, 'y')).toBe(two);
  });
});

describe('groups', () => {
  const page: Page = { id: 'p', background: '#fff', elements: [box('a', 0, 0), box('b', 10, 10), box('c', 20, 20)] };

  it('groups, selects whole groups and ungroups', () => {
    const grouped = groupElements(page, ['a', 'b']);
    expect(grouped.elements[0].groupId).toBeTruthy();
    expect(grouped.elements[0].groupId).toBe(grouped.elements[1].groupId);
    expect(expandGroups(grouped.elements, ['a'])).toEqual(['a', 'b']);
    expect(isOneGroup(grouped.elements, ['a', 'b'])).toBe(true);
    expect(isOneGroup(grouped.elements, ['a', 'b', 'c'])).toBe(false);
    const back = ungroupElements(grouped, ['b']);
    expect(back.elements.every((e) => !e.groupId)).toBe(true);
  });

  it('does not group a single element', () => {
    expect(groupElements(page, ['a'])).toBe(page);
  });
});

describe('style', () => {
  it('copies a text colour onto a shape fill and back', () => {
    const t = { ...newText(size), color: '#ff0000', fontFamily: 'Lora' };
    const shape = pasteStyle(box('a', 0, 0), copyStyle(t));
    expect((shape as { fill: string }).fill).toBe('#ff0000');
    const text = pasteStyle(newText(size), copyStyle({ ...box('b', 0, 0), fill: '#00ff00' } as DesignElement));
    expect((text as { color: string }).color).toBe('#00ff00');
  });
});

describe('kits', () => {
  it('paints text with the darkest colour and shapes with the others', () => {
    const page: Page = { id: 'p', background: '#fff', elements: [{ ...newText(size), color: '#222222' }, box('a', 0, 0), box('b', 0, 0)] };
    const out = applyKitToPage(page, { colors: ['#ff8800', '#101010', '#00aaff'], fonts: ['Sora', 'Lora'] });
    expect((out.elements[0] as { color: string }).color).toBe('#101010');
    expect(out.elements.slice(1).map((e) => (e as { fill: string }).fill)).toEqual(['#ff8800', '#00aaff']);
  });
});

describe('animation settings', () => {
  it('keeps known effects and drops unknown ones, so old content still opens', () => {
    const c = normalizeContent({
      pages: [
        {
          id: 'p',
          background: '#fff',
          transition: 'spin',
          elements: [
            { ...box('a', 0, 0), appear: 'fade', groupId: 'g' },
            { ...box('b', 0, 0), appear: 'explode', groupId: 'g' },
            { ...box('c', 0, 0), groupId: 'lonely' },
          ],
        },
        { id: 'q', background: '#fff', transition: 'slide', elements: [] },
      ],
    });
    expect(c.pages[0].transition).toBeUndefined();
    expect(c.pages[1].transition).toBe('slide');
    expect(c.pages[0].elements.map((e) => e.appear)).toEqual(['fade', undefined, undefined]);
    expect(c.pages[0].elements.map((e) => e.groupId)).toEqual(['g', 'g', undefined]);
    expect(appearOrder(c.pages[0])).toEqual(['a']);
  });
});
