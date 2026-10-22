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

/** A block of text placed at (x, y) as fractions of the page, with its height worked out. */
function at(size: Size, preset: 'title' | 'heading' | 'body', x: number, y: number, w: number, changes: Partial<TextElement>): TextElement {
  return text(size, preset, {
    x: size.width * x,
    y: size.height * y,
    w: size.width * w,
    ...changes,
  });
}

function box(size: Size, x: number, y: number, w: number, h: number, fill: string, radius = 0, type: 'rect' | 'ellipse' = 'rect') {
  const shape = newShape(size, type);
  Object.assign(shape, {
    x: size.width * x,
    y: size.height * y,
    w: size.width * w,
    h: size.height * h,
    fill,
    radius,
  });
  return shape;
}

/** A dark title slide, then plain content slides: the shape most talks take. */
function deck(title: string, subtitle: string, slides: [string, string][], dark = true): DesignContent {
  const s = sizeOf('slides-16x9');
  return {
    pages: [titleSlide(s, title, subtitle, dark), ...slides.map(([h, b]) => contentSlide(s, h, b))],
  };
}

/** A single-page document: a coloured band with the title, then headed sections. */
function documentPage(title: string, accent: string, sections: [string, string][]): DesignContent {
  const s = sizeOf('letter');
  const els = [
    box(s, 0, 0, 1, 0.16, accent),
    at(s, 'heading', 0.08, 0.05, 0.84, {
      text: title,
      color: '#ffffff',
      align: 'left',
    }),
  ];
  let y = 0.21;
  for (const [h, b] of sections) {
    const head = at(s, 'body', 0.08, y, 0.84, {
      text: h,
      fontFamily: 'Sora',
      fontWeight: 700,
      fontSize: 40,
    });
    const body = at(s, 'body', 0.08, y + head.h / s.height + 0.01, 0.84, {
      text: b,
      color: '#5a6178',
      lineHeight: 1.5,
    });
    els.push(head, body);
    y += (head.h + body.h) / s.height + 0.05;
  }
  return { pages: [{ ...newPage('#ffffff'), elements: els }] };
}

/** A tall poster: big heading over a background, details underneath. */
function poster(sizeId: string, background: string, title: string, details: string, ink = '#ffffff', font = 'Bebas Neue'): DesignContent {
  const s = sizeOf(sizeId);
  const t = at(s, 'title', 0.08, 0.14, 0.84, {
    text: title,
    fontFamily: font,
    fontWeight: font === 'Bebas Neue' ? 400 : 700,
    fontSize: Math.round(s.width * 0.17),
    color: ink,
    lineHeight: 1,
  });
  // Long details get smaller type so they always fit below the heading.
  const room = s.height * 0.92 - (t.y + t.h + s.height * 0.05);
  const fontSize = Math.round(Math.min(s.height * 0.04, room / (details.split('\n').length * 1.4)));
  const d = at(s, 'heading', 0.08, 0, 0.84, { text: details, color: ink, fontWeight: 500, lineHeight: 1.4, fontSize });
  d.y = t.y + t.h + s.height * 0.05;
  return { pages: [{ ...newPage(background), elements: [t, d] }] };
}

/** A wide header or thumbnail: one bold line and a short one. */
function banner(sizeId: string, background: string, title: string, line: string, accent: string): DesignContent {
  const s = sizeOf(sizeId);
  const bar = box(s, 0.06, 0.2, 0.012, 0.6, accent, 6);
  const t = at(s, 'title', 0.1, 0.24, 0.8, {
    text: title,
    align: 'left',
    color: '#ffffff',
  });
  const l = at(s, 'body', 0.1, 0, 0.8, {
    text: line,
    align: 'left',
    color: '#d6dcf5',
  });
  l.y = t.y + t.h + s.height * 0.04;
  return { pages: [{ ...newPage(background), elements: [bar, t, l] }] };
}


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
  {
    id: 'minimal-deck',
    name: 'Minimal presentation',
    description: 'Lots of white space and one idea per slide.',
    kind: 'presentation',
    ...dims('slides-16x9'),
    build: () =>
      deck(
        'A quiet title',
        'Subtitle or your name',
        [
          ['One idea', 'Say it in a sentence.'],
          ['Another idea', 'Keep each slide to one thought.'],
        ],
        false,
      ),
  },
  {
    id: 'annual-report',
    name: 'Annual report',
    description: 'The year in numbers, highlights and what comes next.',
    kind: 'presentation',
    ...dims('slides-16x9'),
    build: () =>
      deck('2026 in review', 'Annual report', [
        ['Highlights', 'Three things we are proud of this year.'],
        ['By the numbers', 'Customers · Revenue · Team'],
        ['Next year', 'Where we are heading and why.'],
      ]),
  },
  {
    id: 'workshop',
    name: 'Workshop slides',
    description: 'An agenda, exercises and a wrap-up.',
    kind: 'presentation',
    ...dims('slides-16x9'),
    build: () =>
      deck(
        'Workshop title',
        'Date · Room',
        [
          ['Agenda', 'Welcome\nExercise one\nBreak\nExercise two\nWrap-up'],
          ['Exercise', 'What to do, in pairs, in ten minutes.'],
          ['Wrap-up', 'What we learned, and one thing to try this week.'],
        ],
        false,
      ),
  },
  {
    id: 'product-launch',
    name: 'Product launch',
    description: 'Introduce something new and why people will love it.',
    kind: 'presentation',
    ...dims('slides-16x9'),
    build: () =>
      deck('Meet the new thing', 'Available today', [
        ['Why we built it', 'The problem in one line.'],
        ['What it does', 'Three features, in plain words.'],
        ['Get it', 'Where, when and how much.'],
      ]),
  },
  {
    id: 'proposal',
    name: 'Proposal',
    description: 'A one-page project proposal.',
    kind: 'poster',
    ...dims('letter'),
    build: () =>
      documentPage('Project proposal', '#3b5bd6', [
        ['Summary', 'What you want to do, in two sentences.'],
        ['Why it matters', 'The problem and who it helps.'],
        ['Plan and timing', 'The steps, who does them and by when.'],
        ['Budget', 'What it costs and what that pays for.'],
      ]),
  },
  {
    id: 'resume',
    name: 'Resume',
    description: 'A clean one-page resume.',
    kind: 'poster',
    ...dims('letter'),
    build: () =>
      documentPage('Your Name', '#141a2e', [
        ['About', 'One or two lines about you and what you do best.'],
        ['Experience', 'Job title · Company · 2023–now\nWhat you achieved, not just what you did.'],
        ['Education', 'Course · School · Year'],
        ['Skills', 'Skill · Skill · Skill · Skill'],
      ]),
  },
  {
    id: 'invoice',
    name: 'Invoice',
    description: 'A simple invoice for freelance work.',
    kind: 'poster',
    ...dims('letter'),
    build: () =>
      documentPage('Invoice', '#3fc4a0', [
        ['From', 'Your name\nYour address\nyou@elum.services'],
        ['To', 'Client name\nClient address'],
        ['Work', 'Design work · 10 hours · $500\nRevisions · 2 hours · $100'],
        ['Total due', '$600 by 30 November. Thank you!'],
      ]),
  },
  {
    id: 'newsletter',
    name: 'Newsletter',
    description: 'A monthly update with a few short stories.',
    kind: 'poster',
    ...dims('letter'),
    build: () =>
      documentPage('The Monthly', '#ec7fa9', [
        ['This month', 'A short welcome and what is inside.'],
        ['Story one', 'A few lines about something that happened.'],
        ['Story two', 'Another short story, a photo works well here.'],
        ['Coming up', 'Dates for your calendar.'],
      ]),
  },
  {
    id: 'conference-poster',
    name: 'Conference poster',
    description: 'A research poster with the key finding up top.',
    kind: 'poster',
    ...dims('a4'),
    build: () => poster('a4', 'linear:180:#141a2e:#3b5bd6', 'YOUR KEY\nFINDING', 'Authors · University\n\nMethod · Results · Conclusion'),
  },
  {
    id: 'recipe',
    name: 'Recipe card',
    description: 'Ingredients and steps for a favourite dish.',
    kind: 'poster',
    ...dims('a4'),
    build: () =>
      poster(
        'a4',
        '#fdf0e4',
        'Lemon\nPasta',
        'Serves 2 · 20 minutes\n\nPasta, lemon, butter, parmesan, pepper\n\n1. Boil the pasta\n2. Melt butter with lemon\n3. Toss and serve',
        '#141a2e',
        'Playfair Display',
      ),
  },
  {
    id: 'workshop-flyer',
    name: 'Workshop flyer',
    description: 'Get people to sign up for a class or workshop.',
    kind: 'poster',
    ...dims('letter'),
    build: () => poster('letter', 'linear:150:#3fc4a0:#3b5bd6', 'LEARN\nSOMETHING\nNEW', 'Saturday 9 November · 10 am\nCommunity Hall · Free'),
  },
  {
    id: 'menu',
    name: 'Menu',
    description: 'A café or restaurant menu.',
    kind: 'poster',
    ...dims('a4'),
    build: () =>
      poster(
        'a4',
        '#141a2e',
        'Menu',
        'Starters\nSoup of the day · 6\n\nMains\nRoast chicken · 16\nMushroom risotto · 14\n\nDesserts\nLemon tart · 7',
        '#fdf0e4',
        'Playfair Display',
      ),
  },
  {
    id: 'invitation',
    name: 'Wedding invitation',
    description: 'An elegant invitation with names, date and place.',
    kind: 'poster',
    ...dims('a4'),
    build: () => poster('a4', '#fbf7f2', 'Alex\n&\nSam', 'Saturday 12 June 2027 · 3 pm\nThe Garden House\n\nPlease reply by 1 May', '#5a4a3a', 'Playfair Display'),
  },
  {
    id: 'birthday',
    name: 'Birthday card',
    description: 'A bright card to say happy birthday.',
    kind: 'social',
    ...dims('square'),
    build: () => poster('square', 'linear:135:#e9b949:#ec7fa9', 'HAPPY\nBIRTHDAY!', 'Have the best day,\nwith love from us'),
  },
  {
    id: 'header',
    name: 'Profile header',
    description: 'A wide header for your profile or page.',
    kind: 'social',
    ...dims('banner'),
    build: () => banner('banner', 'linear:120:#141a2e:#3b5bd6', 'Your Name', 'What you make, in a few words', '#ec7fa9'),
  },
  {
    id: 'thumbnail',
    name: 'Video thumbnail',
    description: 'A bold 16:9 thumbnail that reads at a glance.',
    kind: 'social',
    ...dims('slides-16x9'),
    build: () => banner('slides-16x9', '#141a2e', 'How I did it', 'In 10 minutes', '#e9b949'),
  },
];
