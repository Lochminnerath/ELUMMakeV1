import type { DesignContent, DesignElement, DesignKind, Page, PathElement, ShapeElement, ShapeType, TextElement } from '../api/types';
import { newPage, newPath, newShape, newText, PAGE_SIZES, textHeight } from './model';

/**
 * Templates that show what the design studio can do: logos and cards, app screens and web pages
 * laid out like a design tool's frames, and posts that use gradients, outlines, shadows, masks
 * and pen shapes. Each builds fresh content (new ids) every time.
 */

export interface StudioTemplate {
  id: string;
  name: string;
  description: string;
  kind: DesignKind;
  width: number;
  height: number;
  build(): DesignContent;
}

type Size = { width: number; height: number };
const sizeOf = (id: string): Size => {
  const s = PAGE_SIZES.find((x) => x.id === id)!;
  return { width: s.width, height: s.height };
};

/** Text at a place in page pixels, sized to its words. */
function t(size: Size, x: number, y: number, w: number, text: string, style: Partial<TextElement> = {}): TextElement {
  const el: TextElement = { ...newText(size, 'body'), x, y, w, text, align: 'left', ...style };
  return { ...el, h: textHeight(el) };
}

/** A shape at a place in page pixels. */
function s(size: Size, type: ShapeType, x: number, y: number, w: number, h: number, fill: string, more: Partial<ShapeElement> = {}): ShapeElement {
  return { ...newShape(size, type), x, y, w, h, fill, strokeWidth: 0, ...more };
}

/** A pen shape from points in page pixels. */
function pen(points: [number, number][], fill: string, more: Partial<PathElement> = {}): PathElement {
  return {
    ...newPath(
      points.map(([x, y]) => ({ x, y })),
      { closed: true, smooth: true, stroke: '#141a2e', strokeWidth: 0, fill },
    ),
    ...more,
  };
}

const page = (background: string, elements: DesignElement[], extra: Partial<Page> = {}): Page => ({ ...newPage(background), elements, ...extra });
const soft = { x: 0, y: 18, blur: 40, color: '#141a2e33' };

// ------------------------------------------------------------------ templates

function logo(): DesignContent {
  const size = sizeOf('logo');
  const mark = s(size, 'burst', 340, 200, 320, 320, 'linear:135:#f59a52:#ec7fa9', { shadow: { x: 0, y: 20, blur: 50, color: '#ec7fa955' } });
  const inner = s(size, 'ellipse', 420, 280, 160, 160, '#ffffff');
  const leaf = pen(
    [
      [470, 400],
      [455, 330],
      [500, 290],
      [545, 330],
      [530, 400],
    ],
    '#3fc4a0',
  );
  const name = t(size, 100, 600, 800, 'Fern & Field', { fontFamily: 'DM Serif Display', fontSize: 104, fontWeight: 400, align: 'center', color: '#141a2e' });
  const line = t(size, 100, 740, 800, 'Flowers · Plants · Workshops', { fontFamily: 'Montserrat', fontSize: 30, fontWeight: 600, letterSpacing: 6, uppercase: true, align: 'center', color: '#5a6178' });
  return { pages: [page('#fffaf5', [mark, inner, leaf, name, line])] };
}

function businessCard(): DesignContent {
  const size = sizeOf('business-card');
  const front = page('linear:135:#141a2e:#3b5bd6', [
    s(size, 'hexagon', 780, 170, 220, 260, 'linear:160:#7093f8:#3fc4a0', { opacity: 0.9 }),
    s(size, 'hexagon', 860, 80, 120, 140, '#ffffff', { opacity: 0.12 }),
    t(size, 80, 210, 640, 'Sam Rivera', { fontFamily: 'Sora', fontSize: 72, fontWeight: 700, color: '#ffffff' }),
    t(size, 80, 310, 640, 'Product designer', { fontFamily: 'Manrope', fontSize: 32, color: '#bacafc' }),
  ]);
  const back = page('#ffffff', [
    s(size, 'rect', 0, 0, 24, 600, 'linear:180:#7093f8:#3fc4a0'),
    t(size, 90, 150, 860, 'sam@studio.example\n+1 555 0142\nstudio.example', { fontFamily: 'Manrope', fontSize: 40, lineHeight: 1.7, color: '#141a2e' }),
    t(size, 90, 440, 860, 'Made by you. Runs without AI.', { fontFamily: 'Manrope', fontSize: 24, color: '#5a6178' }),
  ]);
  return { pages: [front, back] };
}

function appScreen(): DesignContent {
  const size = sizeOf('phone');
  const card = (y: number, title: string, line: string, accent: string): DesignElement[] => [
    s(size, 'rect', 20, y, 350, 120, '#ffffff', { radius: 20, shadow: { x: 0, y: 8, blur: 24, color: '#141a2e1f' } }),
    s(size, 'ellipse', 40, y + 30, 60, 60, accent),
    t(size, 118, y + 30, 230, title, { fontFamily: 'Sora', fontSize: 20, fontWeight: 700, color: '#141a2e' }),
    t(size, 118, y + 62, 230, line, { fontFamily: 'Manrope', fontSize: 15, color: '#5a6178' }),
  ];
  const home = page('#f4f5f8', [
    t(size, 24, 22, 120, '9:41', { fontFamily: 'Manrope', fontSize: 15, fontWeight: 700 }),
    t(size, 24, 80, 340, 'Good morning', { fontFamily: 'Manrope', fontSize: 16, color: '#5a6178' }),
    t(size, 24, 104, 340, 'Your plans', { fontFamily: 'Sora', fontSize: 34, fontWeight: 700, color: '#141a2e' }),
    ...card(176, 'Morning run', '5 km by the river', 'linear:135:#3fc4a0:#7093f8'),
    ...card(316, 'Team call', '10:30 · 30 minutes', 'linear:135:#ec7fa9:#9b84ee'),
    ...card(456, 'Read', 'Chapter 4', 'linear:135:#f59a52:#e9b949'),
    s(size, 'rect', 20, 740, 350, 60, '#3b5bd6', { radius: 30, link: 'page:2' }),
    t(size, 20, 757, 350, 'Add a plan', { fontFamily: 'Manrope', fontSize: 18, fontWeight: 700, align: 'center', color: '#ffffff' }),
  ]);
  const add = page('#ffffff', [
    t(size, 24, 22, 120, '9:41', { fontFamily: 'Manrope', fontSize: 15, fontWeight: 700 }),
    t(size, 24, 80, 340, 'New plan', { fontFamily: 'Sora', fontSize: 34, fontWeight: 700, color: '#141a2e' }),
    s(size, 'rect', 20, 150, 350, 56, '#f4f5f8', { radius: 14 }),
    t(size, 40, 166, 300, 'What is the plan?', { fontFamily: 'Manrope', fontSize: 17, color: '#5a6178' }),
    s(size, 'rect', 20, 222, 350, 56, '#f4f5f8', { radius: 14 }),
    t(size, 40, 238, 300, 'When', { fontFamily: 'Manrope', fontSize: 17, color: '#5a6178' }),
    s(size, 'rect', 20, 740, 350, 60, '#3b5bd6', { radius: 30, link: 'page:1' }),
    t(size, 20, 757, 350, 'Save', { fontFamily: 'Manrope', fontSize: 18, fontWeight: 700, align: 'center', color: '#ffffff' }),
  ]);
  return { pages: [home, add] };
}

function landingPage(): DesignContent {
  const size = sizeOf('desktop');
  const feature = (x: number, title: string, line: string, shape: ShapeType, fill: string): DesignElement[] => [
    s(size, 'rect', x, 700, 400, 240, '#ffffff', { radius: 28, shadow: soft }),
    s(size, shape, x + 32, 732, 64, 64, fill),
    t(size, x + 32, 820, 336, title, { fontFamily: 'Sora', fontSize: 26, fontWeight: 700, color: '#141a2e' }),
    t(size, x + 32, 860, 336, line, { fontFamily: 'Manrope', fontSize: 18, color: '#5a6178' }),
  ];
  return {
    pages: [
      page('#ffffff', [
        s(size, 'ellipse', 680, -180, 760, 760, 'linear:135:#ec7fa9:#9b84ee', { blur: 40, opacity: 0.55 }),
        s(size, 'ellipse', 1000, 160, 420, 420, 'linear:135:#7093f8:#3fc4a0', { blur: 30, opacity: 0.5, blend: 'multiply' }),
        t(size, 80, 40, 300, 'Northwind', { fontFamily: 'Archivo Black', fontSize: 30, color: '#141a2e' }),
        t(size, 900, 46, 460, 'Work    Studio    Journal    Contact', { fontFamily: 'Manrope', fontSize: 18, fontWeight: 600, color: '#141a2e', align: 'right' }),
        t(size, 80, 200, 760, 'Design that feels like you made it.', { fontFamily: 'Sora', fontSize: 76, fontWeight: 700, lineHeight: 1.08, color: '#141a2e' }),
        t(size, 80, 430, 620, 'A small studio for brands, books and websites. We draw everything by hand, then build it with care.', {
          fontFamily: 'Manrope',
          fontSize: 22,
          lineHeight: 1.5,
          color: '#5a6178',
        }),
        s(size, 'rect', 80, 560, 220, 64, '#141a2e', { radius: 32 }),
        t(size, 80, 579, 220, 'See our work', { fontFamily: 'Manrope', fontSize: 18, fontWeight: 700, align: 'center', color: '#ffffff' }),
        ...feature(80, 'Brands', 'Names, marks and the colours that go with them.', 'burst', '#e9b949'),
        ...feature(520, 'Books', 'Covers and pages that are a pleasure to hold.', 'hexagon', '#3fc4a0'),
        ...feature(960, 'Websites', 'Fast, clear pages that say what you do.', 'heart', '#ec7fa9'),
      ]),
    ],
  };
}

function certificate(): DesignContent {
  const size = sizeOf('certificate');
  return {
    pages: [
      page('#fffdf7', [
        s(size, 'rect', 50, 50, 1550, 1175, '#fffdf7', { stroke: '#c9a77c', strokeWidth: 6, radius: 12 }),
        s(size, 'rect', 80, 80, 1490, 1115, '#fffdf7', { stroke: '#c9a77c', strokeWidth: 2, radius: 6 }),
        t(size, 200, 200, 1250, 'Certificate of achievement', { fontFamily: 'Montserrat', fontSize: 40, fontWeight: 600, letterSpacing: 8, uppercase: true, align: 'center', color: '#8a6a3f' }),
        t(size, 200, 360, 1250, 'Alex Morgan', { fontFamily: 'Pacifico', fontSize: 140, fontWeight: 400, align: 'center', color: '#141a2e' }),
        t(size, 300, 610, 1050, 'For finishing the spring design course with care, curiosity and a great deal of hard work.', {
          fontFamily: 'Fraunces',
          fontSize: 36,
          fontWeight: 400,
          lineHeight: 1.5,
          align: 'center',
          color: '#5a4a3a',
        }),
        s(size, 'burst', 735, 860, 180, 180, 'linear:135:#e9b949:#c9a77c', { shadow: { x: 0, y: 10, blur: 24, color: '#8a6a3f55' } }),
        t(size, 735, 925, 180, '2026', { fontFamily: 'Montserrat', fontSize: 34, fontWeight: 800, align: 'center', color: '#ffffff' }),
        t(size, 200, 1080, 400, 'Date', { fontFamily: 'Manrope', fontSize: 24, align: 'center', color: '#8a6a3f' }),
        t(size, 1050, 1080, 400, 'Signed', { fontFamily: 'Manrope', fontSize: 24, align: 'center', color: '#8a6a3f' }),
      ]),
    ],
  };
}

function moodBoard(): DesignContent {
  const size = sizeOf('slides-16x9');
  return {
    pages: [
      page('#f6f1ea', [
        t(size, 100, 90, 900, 'Mood board', { fontFamily: 'DM Serif Display', fontSize: 110, fontWeight: 400, color: '#2b2118' }),
        t(size, 100, 230, 600, 'Warm, quiet, a little wild. Drop your own pictures onto the shapes.', { fontFamily: 'Manrope', fontSize: 28, lineHeight: 1.5, color: '#6b5a48' }),
        s(size, 'ellipse', 1000, 80, 380, 380, 'linear:135:#f59a52:#e9b949', { shadow: soft }),
        s(size, 'rect', 1420, 80, 400, 520, 'linear:160:#9b84ee:#ec7fa9', { radius: 200, shadow: soft }),
        s(size, 'heart', 1020, 520, 340, 300, 'linear:135:#ec7fa9:#f59a52', { shadow: soft }),
        s(size, 'hexagon', 1420, 650, 400, 330, 'linear:135:#3fc4a0:#7093f8', { shadow: soft }),
        ...['#2b2118', '#c9a77c', '#f59a52', '#ec7fa9', '#3fc4a0'].map((c, i) => s(size, 'ellipse', 100 + i * 130, 760, 100, 100, c, { stroke: '#ffffff', strokeWidth: 6 })),
        t(size, 100, 890, 700, 'Palette', { fontFamily: 'Montserrat', fontSize: 24, fontWeight: 600, letterSpacing: 4, uppercase: true, color: '#6b5a48' }),
      ]),
    ],
  };
}

function salePost(): DesignContent {
  const size = sizeOf('square');
  return {
    pages: [
      page('linear:135:#7093f8:#9b84ee', [
        s(size, 'ellipse', 0, 620, 640, 640, '#ffffff', { opacity: 0.12 }),
        s(size, 'burst', 560, 120, 420, 420, '#e9b949', { shadow: { x: 0, y: 24, blur: 50, color: '#141a2e40' } }),
        t(size, 560, 255, 420, '50%\nOFF', { fontFamily: 'Archivo Black', fontSize: 84, lineHeight: 1, align: 'center', color: '#141a2e' }),
        t(size, 90, 560, 900, 'Summer sale', { fontFamily: 'Archivo Black', fontSize: 120, color: '#ffffff', outline: { color: '#141a2e', width: 6 } }),
        t(size, 90, 720, 800, 'Everything in the shop, this weekend only.', { fontFamily: 'Manrope', fontSize: 40, fontWeight: 600, color: '#ffffff', highlight: '#141a2e66' }),
      ]),
    ],
  };
}

function quoteStory(): DesignContent {
  const size = sizeOf('story');
  return {
    pages: [
      page('linear:180:#141a2e:#3b5bd6', [
        pen(
          [
            [0, 1500],
            [300, 1380],
            [700, 1520],
            [1080, 1400],
            [1080, 1920],
            [0, 1920],
          ],
          'linear:90:#ec7fa9:#f59a52',
          { smooth: true, opacity: 0.9 },
        ),
        t(size, 100, 420, 880, '“', { fontFamily: 'DM Serif Display', fontSize: 260, color: '#ec7fa9' }),
        t(size, 100, 640, 880, 'Make the thing you wish you could find.', {
          fontFamily: 'Fraunces',
          fontSize: 88,
          fontWeight: 400,
          italic: true,
          lineHeight: 1.25,
          color: '#ffffff',
        }),
        t(size, 100, 1160, 880, 'Your name', { fontFamily: 'Montserrat', fontSize: 40, fontWeight: 600, letterSpacing: 6, uppercase: true, color: '#bacafc' }),
      ]),
    ],
  };
}

function infographic(): DesignContent {
  const size = sizeOf('a4');
  const step = (n: number, y: number, title: string, line: string, fill: string): DesignElement[] => [
    s(size, 'ellipse', 120, y, 150, 150, fill, { shadow: soft }),
    t(size, 120, y + 40, 150, String(n), { fontFamily: 'Archivo Black', fontSize: 64, align: 'center', color: '#ffffff' }),
    t(size, 320, y + 20, 800, title, { fontFamily: 'Sora', fontSize: 52, fontWeight: 700, color: '#141a2e' }),
    t(size, 320, y + 90, 800, line, { fontFamily: 'Manrope', fontSize: 32, lineHeight: 1.45, color: '#5a6178' }),
  ];
  const arrow = (y: number): DesignElement => s(size, 'arrow', 155, y, 80, 90, '#e2e5ee', { rotation: 90 });
  return {
    pages: [
      page('#ffffff', [
        s(size, 'rect', 0, 0, 1240, 420, 'linear:135:#3fc4a0:#7093f8'),
        t(size, 120, 120, 1000, 'How to start a garden', { fontFamily: 'Sora', fontSize: 84, fontWeight: 700, lineHeight: 1.1, color: '#ffffff' }),
        ...step(1, 520, 'Pick a sunny spot', 'Six hours of sun a day suits most vegetables.', '#f59a52'),
        arrow(705),
        ...step(2, 840, 'Feed the soil', 'Mix in compost before you plant anything.', '#3fc4a0'),
        arrow(1025),
        ...step(3, 1160, 'Plant and water', 'Water deeply, less often, early in the day.', '#7093f8'),
        arrow(1345),
        ...step(4, 1480, 'Enjoy the harvest', 'Pick often, and the plants keep giving.', '#ec7fa9'),
      ]),
    ],
  };
}

function eventTicket(): DesignContent {
  const size = sizeOf('banner');
  return {
    pages: [
      page('#141a2e', [
        s(size, 'rect', 0, 0, 1080, 500, 'linear:120:#ec7fa9:#9b84ee'),
        s(size, 'ellipse', 1050, -30, 60, 60, '#141a2e'),
        s(size, 'ellipse', 1050, 470, 60, 60, '#141a2e'),
        t(size, 70, 70, 900, 'Night Market', { fontFamily: 'Archivo Black', fontSize: 110, color: '#ffffff', shadow: { x: 0, y: 8, blur: 0, color: '#141a2e55' } }),
        t(size, 70, 230, 900, 'Friday 14 June · Doors 6 pm · The Old Yard', { fontFamily: 'Manrope', fontSize: 34, fontWeight: 600, color: '#ffffff' }),
        t(size, 70, 380, 600, 'General admission', { fontFamily: 'Montserrat', fontSize: 26, fontWeight: 600, letterSpacing: 4, uppercase: true, color: '#141a2e', highlight: '#ffffff' }),
        t(size, 1140, 120, 320, 'ADMIT\nONE', { fontFamily: 'Archivo Black', fontSize: 72, lineHeight: 1, align: 'center', color: '#ffffff' }),
        t(size, 1140, 330, 320, 'No. 0042', { fontFamily: 'IBM Plex Mono', fontSize: 30, align: 'center', color: '#bacafc' }),
      ]),
    ],
  };
}

export const STUDIO_TEMPLATES: StudioTemplate[] = [
  { id: 'logo', name: 'Logo', description: 'A mark drawn with the pen, and a name to go with it.', kind: 'custom', ...sizeOf('logo'), build: logo },
  { id: 'business-card', name: 'Business card', description: 'A front and a back, with a gradient and your details.', kind: 'custom', ...sizeOf('business-card'), build: businessCard },
  { id: 'app-screen', name: 'App screen', description: 'Two phone screens that link to each other when presenting.', kind: 'custom', ...sizeOf('phone'), build: appScreen },
  { id: 'landing-page', name: 'Website landing page', description: 'A hero, a button and three features, with soft colour behind.', kind: 'custom', ...sizeOf('desktop'), build: landingPage },
  { id: 'certificate', name: 'Certificate', description: 'A framed certificate with a name in script and a seal.', kind: 'poster', ...sizeOf('certificate'), build: certificate },
  { id: 'mood-board', name: 'Mood board', description: 'Shapes ready for your pictures, and a palette.', kind: 'presentation', ...sizeOf('slides-16x9'), build: moodBoard },
  { id: 'sale-post', name: 'Sale post', description: 'A bold square post with an outlined headline and a burst.', kind: 'social', ...sizeOf('square'), build: salePost },
  { id: 'quote-story', name: 'Quote story', description: 'A tall story with a quote and a flowing wave.', kind: 'social', ...sizeOf('story'), build: quoteStory },
  { id: 'infographic', name: 'Step-by-step infographic', description: 'Four numbered steps joined by arrows.', kind: 'poster', ...sizeOf('a4'), build: infographic },
  { id: 'event-ticket', name: 'Event ticket', description: 'A wide ticket with the date, the place and a stub.', kind: 'custom', ...sizeOf('banner'), build: eventTicket },
];
