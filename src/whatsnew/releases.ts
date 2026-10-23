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
    id: '2026-10-22-studio',
    date: '22 October 2026',
    title: 'Make, grown up',
    intro: 'History, comments, brand kits and a handful of tools that make Make feel like a proper studio.',
    features: [
      {
        title: 'Every version, kept',
        text: 'Open History beside the page to look back through earlier versions, see who saved them and when, and put one back. What it replaces stays in the history too.',
        art: 'layers',
      },
      {
        title: 'Comments and pins',
        text: 'Talk about a design right where it lives. Reply, resolve when it is sorted, or drop a pin on the exact spot you mean. People who can only view can comment as well.',
        art: 'share',
      },
      {
        title: 'Your brand, one click away',
        text: 'Keep your colours, fonts and logo in a brand kit. They show first in every colour and font menu, and Apply kit recolours a page in one go.',
        art: 'spark',
      },
      {
        title: 'Favourites, tags and your own templates',
        text: 'Star the designs you keep coming back to, tag them to find them fast, and save any design as a template to start the next one from.',
        art: 'check',
      },
      {
        title: 'Tools for tidy work',
        text: 'Group and ungroup, line things up and space them evenly, copy a style onto something else, and nudge by 10 with Shift held.',
        art: 'layers',
      },
      {
        title: 'Presentations that move',
        text: 'Pages can fade or slide in, and each element can appear on a click with a fade, slide or scale. Everything stays still for people who prefer less motion.',
        art: 'devices',
      },
    ],
  },
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
    intro: 'Slides, posters and social posts, designed by you and shared across ELUM.',
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

/**
 * What to show when Make opens, from the release last seen on the account and on this device.
 * Only releases newer than the newest one seen are shown. Someone with nothing recorded anywhere
 * (a brand-new visitor) sees nothing; the latest release is recorded for them quietly instead.
 * `record` is the id to remember on the account (null when it already holds the latest).
 */
export function whatsNewPlan(releases: Release[], account: string | null, local: string | null): { show: Release[]; record: string | null } {
  if (!releases.length) return { show: [], record: null };
  const latest = releases[0].id;
  const known = [account, local].map((id) => (id ? releases.findIndex((r) => r.id === id) : -1)).filter((i) => i >= 0);
  const record = account === latest ? null : latest;
  if (!known.length) return { show: [], record };
  return { show: releases.slice(0, Math.min(...known)), record };
}
