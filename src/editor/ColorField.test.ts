import { beforeEach, describe, expect, it } from 'vitest';
import { parseHex, recentColours, rememberColour } from './ColorField';

describe('custom colours', () => {
  beforeEach(() => localStorage.clear());

  it('reads colour codes, short or long, with or without #', () => {
    expect(parseHex('#12AB34')).toBe('#12ab34');
    expect(parseHex('12ab34')).toBe('#12ab34');
    expect(parseHex('#f0a')).toBe('#ff00aa');
    expect(parseHex('red')).toBeNull();
    expect(parseHex('#12ab3')).toBeNull();
  });

  it('remembers the last eight, newest first, without repeats', () => {
    for (let i = 0; i < 10; i++) rememberColour(`#00000${i}`);
    rememberColour('#000003');
    const list = recentColours();
    expect(list).toHaveLength(8);
    expect(list[0]).toBe('#000003');
    expect(new Set(list).size).toBe(8);
  });
});
