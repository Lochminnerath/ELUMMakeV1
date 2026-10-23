# ELUM Make

Slides, posters and social posts, designed by people and shared across ELUM. Built by people. Runs without AI.

Make is one of the ELUM apps (with Write, Type and ELUM Account). Every ELUM app shares one Supabase
project: one account works everywhere, and shares and notifications flow between apps.

## What Make does

- **Designs in any size.** Presentations (16:9, 4:3), square, portrait and story posts, banners, A4
  posters and US Letter flyers. Every design has its own link: `/m/<id>`.
- **Templates.** A pitch deck, lesson slides, an event poster and a quote post to start from.
- **A real canvas.** Text, rectangles, circles, triangles, stars, lines, arrows and pictures. Select,
  move, resize from any side or corner, rotate, and box-select several things at once.
- **Snapping guides.** Things line up with the page's edges and centre and with each other while you
  drag. Hold Shift to keep moves straight, Alt to move freely.
- **Pages.** Add, copy, reorder and delete pages, each with its own background and speaker notes.
- **Layers.** See everything on a page, pick it, hide it, lock it, or move it up and down.
- **Editing panel.** Fonts, sizes, weights, colours from the ELUM palette (or any colour), alignment,
  line spacing, borders, rounded corners, opacity, exact position and size, align and space evenly.
- **Undo and redo** for every change, including drags.
- **Saves itself.** Changes save a moment after you stop. If someone else saved in between, Make
  shows their latest version instead of overwriting it.
- **Present.** Full screen, with arrow keys or a click to move on, and speaker notes on N.
- **Download.** The current page as PNG, or every page as one PDF.
- **Share.** With anyone who has an ELUM account, to view or to edit. They get a notification in every
  ELUM app.
- **Phones.** The editor fits a phone: tools move to a dock at the bottom and the panel slides up.

Keyboard: T text, R rectangle, O circle, L line, Enter to type into selected text, arrows to nudge
(Shift for 10), Ctrl+D duplicate, Ctrl+C / Ctrl+V copy and paste, Delete, Ctrl+Z / Ctrl+Shift+Z.

## Accounts

Accounts are Supabase Auth users (Supabase > Authentication > Users). Signing up calls
`supabase.auth.signUp`; a database trigger then gives the account a row in `public.profiles`, which
is what other people see (name, colour). Nothing about accounts lives in Make's own tables.

- With **Confirm email** on in Supabase, people confirm by the link in their email before they can
  sign in. Supabase's built-in email only reaches your own team, so set up SMTP (Supabase >
  Authentication > Emails > SMTP Settings) before opening sign-ups to everyone.
- People can also sign up with a new **ELUM Type address** (`name@type.elum.services`), created by the
  `type-signup` edge function from the Type repository.
- With `VITE_ELUM_ACCOUNT_URL` set, signing in goes through ELUM Account, so one sign-in covers every
  ELUM app.

## Run it

```sh
npm install
cp .env.example .env.local   # then fill in VITE_SUPABASE_ANON_KEY
npm run dev                  # http://localhost:5176
```

Without the Supabase settings, Make runs in **preview mode**: accounts and designs stay in that browser
and never reach Supabase. That is only for working on the app; Netlify builds refuse to run without
the settings (`scripts/require-supabase.mjs`), so a live site can never quietly lose accounts.

```sh
npm test              # unit tests
npm run typecheck
npm run build
sh supabase/tests/run.sh   # database tests (needs Postgres: PGHOST, PGUSER)
```

## Deploy (Netlify)

1. Create a site from this repository (suggested name: `elummake`, so it lives at
   https://makebyelum.netlify.app). `netlify.toml` has the build settings.
2. Site configuration > Environment variables, for all deploy contexts:
   - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`: the same values as Write and Type.
   - Optional: `VITE_ELUM_ACCOUNT_URL` once ELUM Account is live.
3. In Supabase, run the Make migration (see [supabase/README.md](supabase/README.md)) and add
   `https://makebyelum.netlify.app/**` to Authentication > URL Configuration > Redirect URLs.

## What's new

`src/whatsnew/releases.ts` lists what changed, newest first. When an update ships, add a release at
the top with a new id: everyone sees it once, the next time they open Make, and can read every
release again from the account menu (What's new).
