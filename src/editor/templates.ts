import type { DesignContent, DesignKind, Page, TextElement } from '../api/types';
import { newPage, newShape, newText, PAGE_SIZES, textHeight, uid } from './model';

/** Starting points on the home page. Each builds fresh content (new ids) every time. */

export interface Template {
  id: string;
  name: string;
  description: string;
  kind: DesignKind;
  width: number;
  height: number;
  build(): DesignContent;
}

type Size = { width: number; height: number };

function text(size: Size, preset: 'title' | 'heading' | 'body', changes: Partial<TextElement>): TextElement {
  const el = { ...newText(size, preset), ...changes };
  el.h = textHeight(el);
  return el;
}

function titleSlide(size: Size, title: string, subtitle: string, dark: boolean): Page {
  const page = newPage(dark ? 'linear:135:#141a2e:#3b5bd6' : '#ffffff');
  const ink = dark ? '#ffffff' : '#141a2e';
  const t = text(size, 'title', { text: title, color: ink, w: size.width * 0.8, x: size.width * 0.1 });
  t.y = size.height * 0.36;
  const s = text(size, 'body', { text: subtitle, color: dark ? '#bacafc' : '#5a6178', align: 'center', w: size.width * 0.7, x: size.width * 0.15 });
  s.y = t.y + t.h + size.height * 0.03;
  const accent = newShape(size, 'rect');
  Object.assign(accent, { w: size.width * 0.08, h: size.height * 0.012, fill: '#ec7fa9', radius: 8 });
  accent.x = (size.width - accent.w) / 2;
  accent.y = t.y - size.height * 0.06;
  return { ...page, elements: [accent, t, s] };
}

function contentSlide(size: Size, heading: string, body: string): Page {
  const page = newPage('#ffffff');
  const h = text(size, 'heading', { text: heading, align: 'left', w: size.width * 0.84, x: size.width * 0.08, y: size.height * 0.1 });
  const b = text(size, 'body', { text: body, w: size.width * 0.6, x: size.width * 0.08, y: size.height * 0.1 + h.h + size.height * 0.05, lineHeight: 1.5 });
  const shape = newShape(size, 'ellipse');
  const d = size.height * 0.42;
  Object.assign(shape, { w: d, h: d, x: size.width * 0.72, y: size.height * 0.42, fill: '#fdeef4' });
  return { ...page, elements: [shape, h, b] };
}

const sizeOf = (id: string) => PAGE_SIZES.find((s) => s.id === id)!;
const dims = (id: string) => ({ width: sizeOf(id).width, height: sizeOf(id).height });

export const TEMPLATES: Template[] = [
  {
    id: 'pitch',
    name: 'Pitch deck',
    description: 'A title, the problem, the idea and next steps.',
    kind: 'presentation',
    ...dims('slides-16x9'),
    build() {
      const s = sizeOf('slides-16x9');
      return {
        pages: [
          titleSlide(s, 'Your big idea', 'A short line on why it matters', true),
          contentSlide(s, 'The problem', 'What is hard today, and who feels it.\nKeep it to a few lines.'),
          contentSlide(s, 'Our idea', 'How it works, in plain words.\nOne picture helps more than a paragraph.'),
          contentSlide(s, 'Next steps', 'What happens next, who does it, and by when.'),
        ],
      };
    },
  },
  {
    id: 'lesson',
    name: 'Lesson slides',
    description: 'Clean slides for teaching or a talk.',
    kind: 'presentation',
    ...dims('slides-16x9'),
    build() {
      const s = sizeOf('slides-16x9');
      return {
        pages: [titleSlide(s, 'Lesson title', 'Your name · Date', false), contentSlide(s, 'What we will cover', 'First idea\nSecond idea\nThird idea')],
      };
    },
  },
  {
    id: 'event-poster',
    name: 'Event poster',
    description: 'Bold heading, date and place.',
    kind: 'poster',
    ...dims('a4'),
    build() {
      const s = sizeOf('a4');
      const page = newPage('linear:160:#f59a52:#ec7fa9');
      const title = text(s, 'title', { text: 'SUMMER\nNIGHT\nMARKET', fontFamily: 'Bebas Neue', fontWeight: 400, fontSize: 260, color: '#ffffff', w: s.width * 0.84, x: s.width * 0.08, lineHeight: 0.95 });
      title.h = textHeight(title);
      title.y = s.height * 0.16;
      const when = text(s, 'heading', { text: 'Friday 14 June · 6 pm', color: '#141a2e', w: s.width * 0.84, x: s.width * 0.08 });
      when.y = title.y + title.h + 60;
      const where = text(s, 'body', { text: 'The Old Yard, River Street', color: '#141a2e', align: 'center', w: s.width * 0.84, x: s.width * 0.08 });
      where.y = when.y + when.h + 24;
      return { pages: [{ ...page, elements: [title, when, where] }] };
    },
  },
  {
    id: 'quote-post',
    name: 'Quote post',
    description: 'A square post for a quote or announcement.',
    kind: 'social',
    ...dims('square'),
    build() {
      const s = sizeOf('square');
      const page = newPage('#141a2e');
      const mark = text(s, 'title', { text: '“', fontFamily: 'Playfair Display', fontSize: 260, color: '#ec7fa9', w: 200, x: 90, y: 60, align: 'left' });
      const quote = text(s, 'heading', { text: 'Make something people want to share.', fontFamily: 'Playfair Display', fontWeight: 400, italic: true, color: '#ffffff', align: 'left', w: s.width - 180, x: 90 });
      quote.y = (s.height - quote.h) / 2;
      const by = text(s, 'body', { text: '— Your name', color: '#bacafc', align: 'left', w: s.width - 180, x: 90 });
      by.y = quote.y + quote.h + 40;
      return { pages: [{ ...page, id: uid(), elements: [mark, quote, by] }] };
    },
  },
];
