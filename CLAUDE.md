# CLAUDE.md

Roundnet pickup tracker for Taiwan. No login, bilingual (en / zh-TW), old-school UI on purpose.

- `public/` is the static site (Pages output dir). Plain global-function JS, no build, no framework. `app/i18n.js` (strings + `t()`), `app/app.js` (helpers, `renderChrome()`, `api()`, map helpers), `app/style.css` (Win95-style look).
- `functions/` contains the Pages Functions: `api/events.js`, `api/events/[id].js`, `api/events/[id]/signups.js`, `api/signups/[id].js`. `event.js` fills in OG tags on `/event` for link previews. `public/_routes.json` limits Functions to `/api/*` and `/event`.
- `lib/validate.js` is pure server validation, unit-tested in `tests/unit/`. Errors are i18n keys (`err_*`) that the client shows via `t()`.
- Every UI string goes through `t()` and needs both `en` and `zh` entries. `CITIES` is duplicated in `lib/validate.js` and `public/app/app.js`, so keep them in sync.
- Secrets: events have `edit_token` (header `x-edit-token`) and signups have `remove_token` (header `x-remove-token`). Never select them in GET responses.
- Times are stored as Taipei local ISO strings (`+08:00`) plus `starts_ts` (ms) for queries.
- Commands: `npm run dev`, `npm test`, `npm run db -- "<SQL>"`, `npm run db:init`, `npm run deploy`.
