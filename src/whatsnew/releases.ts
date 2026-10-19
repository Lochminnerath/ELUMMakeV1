import type { Art } from './scenes';

/**
 * What changed in Make, newest first. Add a release at the top whenever an update ships: people
 * get a short animated tour of it the next time they open Make, and can replay every release
 * from the account menu (What's new). Give each release a new id; the date is shown as written.
 *
 * Each feature is one step of the tour. `art` picks its animated picture (see scenes.tsx):
 * mark, share, devices, layers, check or spark.
 */

export interface Feature {
  title: string;
  text: string;
  art: Art;
}

export interface Release {
  /** Unique and never reused, such as 2026-10-18. */
  id: string;
  date: string;
  title: string;
  /** One or two sentences under the title on the opening step. */
  intro: string;
  features: Feature[];
}

export const APP_NAME = 'Make';

export const RELEASES: Release[] = [
  {
    id: '2026-10-19-symbols',
    date: '19 October 2026',
    title: 'Symbols, redrawn',
    intro: 'Every action now has a symbol built from ELUM circles.',
    features: [
      {
        title: 'Symbols drawn from circles',
        text: 'Archive, delete, send, attach, lock and the rest are now drawn from the rings and discs of the ELUM marks, each with its own colour.',
        art: 'layers',
      },
      {
        title: 'Your tab shows what is open',
        text: 'An open design shows the Make design symbol in your browser tab, so you can find it among your tabs.',
        art: 'mark',
      },
    ],
  },
  {
    id: '2026-10-19',
    date: '19 October 2026',
    title: 'Present with confidence',
    intro: 'A few things that make Make feel more at home, and one fix you will notice on stage.',
    features: [
      {
        title: 'Approve new sign-ins',
        text: 'Turn it on in ELUM Account, under Security. Anyone signing in with your password then waits until you pick the matching number on a device you are signed in to.',
        art: 'check',
      },
      {
        title: 'Every action, its own symbol',
        text: 'Archive, delete, share, reply, download and more each have their own ELUM symbol and colour, so you can tell them apart at a glance.',
        art: 'layers',
      },
      {
        title: 'Move between apps',
        text: 'Open the ELUM apps window from the dots at the top of the page, and jump to Write, Type, Make or your account in one click.',
        art: 'spark',
      },
      {
        title: 'Present stays on',
        text: 'Presenting now fills the screen and stays there until you press Esc. Arrows, space or a click move through your pages.',
        art: 'layers',
      },
      {
        title: 'A symbol for sharing',
        text: 'Share now has its own ELUM symbol: three connected people, the one sharing in colour.',
        art: 'share',
      },
      {
        title: 'Every design has a face',
        text: 'Designs get their own symbol, a slide on its stack, wherever Make shows one.',
        art: 'layers',
      },
      {
        title: 'Updates, told properly',
        text: 'This tour. You will see one like it after each update, and can replay them any time from your account menu.',
        art: 'spark',
      },
    ],
  },
  {
    id: '2026-10-18',
    date: '18 October 2026',
    title: 'ELUM Make is here',
    intro: 'Slides, posters and social posts, designed by people and shared across ELUM.',
    features: [
      {
        title: 'Start from any size',
        text: 'Presentations, square and story posts, banners, posters and flyers, or one of the templates.',
        art: 'layers',
      },
      {
        title: 'A real canvas',
        text: 'Text, shapes, lines and pictures, with snapping guides, layers, pages and speaker notes. Undo covers every change.',
        art: 'check',
      },
      {
        title: 'Saved everywhere',
        text: 'Designs save as you work, to your ELUM account, so they are on every device you sign in to.',
        art: 'devices',
      },
      {
        title: 'Share and present',
        text: 'Share with anyone who has an ELUM account, present full screen, or download as PNG or PDF.',
        art: 'share',
      },
    ],
  },
];

/** The releases someone has not seen yet, given the last one they saw. New visitors see the latest. */
export function unseenReleases(releases: Release[], lastSeen: string | null): Release[] {
  if (!releases.length) return [];
  const at = lastSeen ? releases.findIndex((r) => r.id === lastSeen) : -1;
  return at === -1 ? releases.slice(0, 1) : releases.slice(0, at);
}

export interface Step {
  key: string;
  eyebrow: string;
  title: string;
  text: string;
  art: Art;
}

/** The tour for some releases: each opens with its title, then one step per feature. */
export function tourSteps(releases: Release[]): Step[] {
  return releases.flatMap((r) => [
    { key: `${r.id}:intro`, eyebrow: `New in ${APP_NAME} · ${r.date}`, title: r.title, text: r.intro, art: 'mark' as const },
    ...r.features.map((f, i) => ({ key: `${r.id}:${i}`, eyebrow: r.title, title: f.title, text: f.text, art: f.art })),
  ]);
}
