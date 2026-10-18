/**
 * What changed in Make, newest first. Add a release at the top whenever an update ships: people
 * see it once, the next time they open Make, and can read every release again from the account
 * menu (What's new). Give each release a new id; the date is shown as written.
 */

export interface Release {
  /** Unique and never reused, such as 2026-10-18. */
  id: string;
  date: string;
  title: string;
  items: string[];
}

export const RELEASES: Release[] = [
  {
    id: '2026-10-18',
    date: '18 October 2026',
    title: 'ELUM Make is here',
    items: [
      'Slides, posters and social posts in any size, with templates to start from.',
      'Text, shapes, lines and pictures on a canvas with snapping guides, layers, pages and speaker notes.',
      'Designs save as you work. Undo and redo cover every change.',
      'Present full screen, and download as PNG or PDF.',
      'Share with anyone who has an ELUM account, to view or to edit.',
      'Sign up with your email, or with a new ELUM Type address.',
      "This What's new panel, so you always know what changed.",
    ],
  },
];

/** The releases someone has not seen yet, given the last one they saw. New visitors see the latest. */
export function unseenReleases(releases: Release[], lastSeen: string | null): Release[] {
  if (!releases.length) return [];
  const at = lastSeen ? releases.findIndex((r) => r.id === lastSeen) : -1;
  return at === -1 ? releases.slice(0, 1) : releases.slice(0, at);
}
